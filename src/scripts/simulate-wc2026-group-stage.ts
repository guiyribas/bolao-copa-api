/**
 * Simula placares da fase de grupos: em cada jogo vence o time com menor rank em
 * `data/wc2026-team-strength.json` (menor = mais forte). Placar fixo 2–0 para o vencedor.
 *
 * Requer PostgreSQL no ar e o mesmo `.env` que `yarn dev`:
 *   yarn simulate:wc2026:groups
 *
 * Atualiza só partidas `phase: group`; dispara lifecycle das partidas e recalcula pontos das apostas.
 */
import * as core from '@strapi/core';
import fs from 'fs/promises';
import path from 'path';

const FIXTURES_PATH = path.join(process.cwd(), 'data', 'world-cup-2026-fixtures.json');
const STRENGTH_PATH = path.join(process.cwd(), 'data', 'wc2026-team-strength.json');

type FixtureMatch = {
  matchNumber: number;
  phase: string;
  homeCode: string;
  awayCode: string;
};

type FixturesFile = {
  matches: FixtureMatch[];
};

function scoresForFavoriteWin(homeCode: string, awayCode: string, strength: Record<string, number>) {
  const rh = strength[homeCode];
  const ra = strength[awayCode];

  if (rh == null) {
    throw new Error(`Sem rank de força para o código: ${homeCode}`);
  }
  if (ra == null) {
    throw new Error(`Sem rank de força para o código: ${awayCode}`);
  }

  if (rh < ra) {
    return { homeScore: 2, awayScore: 0 };
  }
  if (ra < rh) {
    return { homeScore: 0, awayScore: 2 };
  }

  const tie = homeCode.localeCompare(awayCode);
  if (tie <= 0) {
    return { homeScore: 2, awayScore: 0 };
  }
  return { homeScore: 0, awayScore: 2 };
}

async function main() {
  const [fixturesRaw, strengthRaw] = await Promise.all([
    fs.readFile(FIXTURES_PATH, 'utf8'),
    fs.readFile(STRENGTH_PATH, 'utf8'),
  ]);

  const fixtures = JSON.parse(fixturesRaw) as FixturesFile;
  const strength = JSON.parse(strengthRaw) as Record<string, number>;

  const groupMatches = fixtures.matches.filter((m) => m.phase === 'group');

  console.log(`[simulate-wc2026-groups] ${groupMatches.length} jogos de fase de grupos nos fixtures.`);

  console.log('[simulate-wc2026-groups] Compilando projeto Strapi…');
  const appContext = await core.compileStrapi();

  console.log('[simulate-wc2026-groups] Conectando ao banco…');
  const app = await core.createStrapi(appContext).load();

  try {
    let updated = 0;
    for (const m of groupMatches) {
      const { homeScore, awayScore } = scoresForFavoriteWin(m.homeCode, m.awayCode, strength);

      const existing = await app.documents('api::match.match').findMany({
        filters: { matchNumber: m.matchNumber },
        limit: 1,
      });

      if (existing.length === 0) {
        console.warn(`[simulate-wc2026-groups] Partida matchNumber=${m.matchNumber} não encontrada no banco; rode yarn seed:wc2026 antes.`);
        continue;
      }

      await app.documents('api::match.match').update({
        documentId: existing[0].documentId,
        data: {
          homeScore,
          awayScore,
          matchStatus: 'finished',
        } as never,
      });
      updated++;
    }

    console.log(`[simulate-wc2026-groups] Concluído: ${updated} partidas atualizadas (matchStatus finished).`);
  } finally {
    await app.destroy().catch((err: unknown) => {
      console.error('[simulate-wc2026-groups] destroy:', err);
    });
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('[simulate-wc2026-groups]', err);
  process.exit(1);
});
