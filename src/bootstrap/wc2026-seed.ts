import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import type { Core } from '@strapi/strapi';
import sharp from 'sharp';

import { TEAM_CODE_TO_ISO2 } from '../seed/team-flag-iso2';

const FIXTURES_PATH = path.join(process.cwd(), 'data', 'world-cup-2026-fixtures.json');

const FLAG_WIDTH = 160;
const FLAG_HEIGHT = 120;

type FixtureTeam = { group: string; name: string; code: string };
type FixtureMatch = {
  matchNumber: number;
  phase: string;
  group?: string;
  date: string;
  venue: string;
  homeCode: string;
  awayCode: string;
  slotLabel?: string;
};

type FixturesFile = {
  teams: FixtureTeam[];
  matches: FixtureMatch[];
};

async function loadFixtures(): Promise<FixturesFile> {
  const raw = await fs.readFile(FIXTURES_PATH, 'utf8');
  return JSON.parse(raw) as FixturesFile;
}

function matchTitleFromFixture(m: FixtureMatch, codeToName: Record<string, string>): string {
  const home = m.homeCode ? codeToName[m.homeCode] : undefined;
  const away = m.awayCode ? codeToName[m.awayCode] : undefined;
  if (home && away) {
    return `${home} x ${away}`;
  }
  if (m.slotLabel) {
    return m.slotLabel;
  }
  return `Partida ${m.matchNumber}`;
}

/** Upserts 48 seleções + 104 partidas a partir de `data/world-cup-2026-fixtures.json` (idempotente). */
export async function seedWorldCup2026(strapi: Core.Strapi): Promise<void> {
  let data: FixturesFile;
  try {
    data = await loadFixtures();
  } catch (e) {
    strapi.log.error('WC2026 seed: could not read data/world-cup-2026-fixtures.json', e);
    throw e;
  }

  const codeToDocumentId: Record<string, string> = {};

  for (const t of data.teams) {
    const found = await strapi.documents('api::team.team').findMany({
      filters: { code: t.code },
      limit: 1,
    });

    const groupLetter = t.group as
      | 'A'
      | 'B'
      | 'C'
      | 'D'
      | 'E'
      | 'F'
      | 'G'
      | 'H'
      | 'I'
      | 'J'
      | 'K'
      | 'L';

    if (found.length > 0) {
      await strapi.documents('api::team.team').update({
        documentId: found[0].documentId,
        data: {
          name: t.name,
          group: groupLetter,
        },
      });
      codeToDocumentId[t.code] = found[0].documentId;
    } else {
      const created = await strapi.documents('api::team.team').create({
        data: {
          name: t.name,
          code: t.code,
          group: groupLetter,
        },
      });
      codeToDocumentId[t.code] = created.documentId;
    }
  }

  const codeToName = Object.fromEntries(data.teams.map((t) => [t.code, t.name]));

  for (const m of data.matches) {
    const homeDoc = m.homeCode ? codeToDocumentId[m.homeCode] : undefined;
    const awayDoc = m.awayCode ? codeToDocumentId[m.awayCode] : undefined;

    // Campos seguros de re-sincronizar a cada execução do seed.
    const updatePayload: Record<string, unknown> = {
      title: matchTitleFromFixture(m, codeToName),
      matchNumber: m.matchNumber,
      phase: m.phase,
      date: m.date,
      venue: m.venue,
      homeTeam: homeDoc ?? null,
      awayTeam: awayDoc ?? null,
      group: m.group ?? null,
    };

    const existingMatch = (await strapi.documents('api::match.match').findMany({
      filters: { matchNumber: m.matchNumber },
      limit: 1,
    })) as Array<{ documentId: string; matchStatus?: string | null }>;

    if (existingMatch.length > 0) {
      // Backfill: se a partida está sem status (legado), seta como 'scheduled'.
      // Caso contrário preserva o status atual (admin tem precedência).
      const current = existingMatch[0];
      const finalPayload: Record<string, unknown> = { ...updatePayload };
      if (current.matchStatus == null || current.matchStatus === '') {
        finalPayload.matchStatus = 'scheduled';
      }

      await strapi.documents('api::match.match').update({
        documentId: current.documentId,
        data: finalPayload as never,
      });
    } else {
      await strapi.documents('api::match.match').create({
        data: {
          ...updatePayload,
          matchStatus: 'scheduled',
        } as never,
      });
    }
  }

  strapi.log.info(`WC2026 fixtures seed finished (${data.teams.length} teams, ${data.matches.length} matches).`);
}

async function uploadPng(strapi: Core.Strapi, tmpPath: string, code: string, label: string, sizeBytes: number) {
  const uploadPlugin = strapi.plugin('upload');
  const uploadService = uploadPlugin.service('upload') as {
    upload: (args: { data: Record<string, unknown>; files: Record<string, unknown> }) => Promise<unknown[]>;
  };

  const res = await uploadService.upload({
    data: {
      fileInfo: {
        name: `${code}.png`,
        alternativeText: label,
        caption: code,
      },
    },
    files: {
      filepath: tmpPath,
      originalFilename: `${code}.png`,
      mimetype: 'image/png',
      size: sizeBytes,
    },
  });
  return res[0] as { id?: number };
}

export type SeedFlagsOptions = { force?: boolean };

/** Downloads from flagcdn, normalizes size, uploads via Strapi upload plugin. Opcional ao script; exige rede. */
export async function seedWorldCup2026Flags(
  strapi: Core.Strapi,
  options?: SeedFlagsOptions
): Promise<void> {
  const force = options?.force === true;

  const teams = (await strapi.documents('api::team.team').findMany({
    populate: ['flag'],
  })) as unknown as Array<{ documentId: string; code?: string; name?: string; flag?: unknown | null }>;

  for (const team of teams) {
    const code = team.code;
    if (!code) continue;

    if (team.flag != null && !force) {
      continue;
    }

    const iso2 = TEAM_CODE_TO_ISO2[code];
    if (!iso2) {
      strapi.log.warn(`WC2026 flags: no ISO2 mapping for team code ${code}`);
      continue;
    }

    const url = `https://flagcdn.com/w320/${iso2}.png`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        strapi.log.warn(`WC2026 flags: HTTP ${res.status} for ${code} (${url})`);
        continue;
      }

      const input = Buffer.from(await res.arrayBuffer());
      const png = await sharp(input)
        .resize(FLAG_WIDTH, FLAG_HEIGHT, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();

      const tmp = path.join(os.tmpdir(), `wc2026-flag-${code}.png`);
      await fs.writeFile(tmp, png);

      try {
        const file = await uploadPng(strapi, tmp, code, team.name || code, png.length);

        if (typeof file?.id !== 'number') {
          strapi.log.warn(`WC2026 flags: upload returned no numeric id for ${code}`);
          continue;
        }

        await strapi.documents('api::team.team').update({
          documentId: team.documentId,
          data: {
            flag: file.id,
          } as never,
        });

        strapi.log.info(`WC2026 flags: uploaded for ${code}`);
      } finally {
        await fs.unlink(tmp).catch(() => undefined);
      }
    } catch (e) {
      strapi.log.error(`WC2026 flags: failed for ${code}`, e);
    }
  }

  strapi.log.info('WC2026 flags pass completed.');
}
