import type { Core } from '@strapi/strapi';

const DEFAULT_BASE_URL = 'https://api.football-data.org/v4';
const DEFAULT_COMPETITION = 'WC';
const DEFAULT_SEASON = 2026;
const DEFAULT_TIMEOUT_MS = 15_000;
const KICKOFF_TOLERANCE_MS = 5 * 60 * 1000;

type MatchStatus = 'scheduled' | 'live' | 'finished';

type FootballDataMatch = {
  id?: number;
  utcDate?: string;
  status?: string;
  homeTeam?: { tla?: string | null };
  awayTeam?: { tla?: string | null };
  score?: {
    duration?: string;
    fullTime?: {
      home?: number | null;
      away?: number | null;
    };
    penalties?: {
      home?: number | null;
      away?: number | null;
    };
  };
};

type FootballDataResponse = {
  matches?: FootballDataMatch[];
  message?: string;
  errorCode?: number;
};

type LocalMatch = {
  documentId: string;
  externalId?: string | null;
  date?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  matchStatus?: MatchStatus | null;
  homeTeam?: { code?: string | null } | null;
  awayTeam?: { code?: string | null } | null;
};

export type MatchUpdate = {
  externalId: string;
  date: string;
  homeCode: string | null;
  awayCode: string | null;
  homeScore: number | null;
  awayScore: number | null;
  matchStatus: MatchStatus;
};

export type FootballDataConfig = {
  apiKey: string;
  baseUrl: string;
  competition: string;
  season: number;
  timeoutMs: number;
};

const LIVE_STATUSES = new Set(['IN_PLAY', 'PAUSED']);
const FINISHED_STATUSES = new Set(['FINISHED', 'AWARDED']);
const TEAM_CODE_ALIASES: Record<string, string> = {
  URY: 'URU',
};

function normalizeTeamCode(code: string | null): string | null {
  return code ? (TEAM_CODE_ALIASES[code] ?? code) : null;
}

function scoreWithoutPenaltyShootout(score: FootballDataMatch['score']): {
  home: number | null;
  away: number | null;
} {
  const home = score?.fullTime?.home ?? null;
  const away = score?.fullTime?.away ?? null;

  if (score?.duration !== 'PENALTY_SHOOTOUT') {
    return { home, away };
  }

  const homePenalties = score.penalties?.home;
  const awayPenalties = score.penalties?.away;
  return {
    home: home != null && homePenalties != null ? home - homePenalties : home,
    away: away != null && awayPenalties != null ? away - awayPenalties : away,
  };
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number
): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getFootballDataConfig(): FootballDataConfig | null {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    baseUrl: (
      process.env.FOOTBALL_DATA_API_URL?.trim() || DEFAULT_BASE_URL
    ).replace(/\/$/, ''),
    competition:
      process.env.FOOTBALL_DATA_COMPETITION?.trim() || DEFAULT_COMPETITION,
    season: parsePositiveInteger(
      process.env.FOOTBALL_DATA_SEASON,
      DEFAULT_SEASON
    ),
    timeoutMs: parsePositiveInteger(
      process.env.FOOTBALL_DATA_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS
    ),
  };
}

export function mapFootballDataStatus(status: string | undefined): MatchStatus {
  if (status && FINISHED_STATUSES.has(status)) {
    return 'finished';
  }
  if (status && LIVE_STATUSES.has(status)) {
    return 'live';
  }
  return 'scheduled';
}

export function toMatchUpdate(value: FootballDataMatch): MatchUpdate | null {
  if (
    !Number.isInteger(value.id) ||
    !value.utcDate ||
    Number.isNaN(Date.parse(value.utcDate))
  ) {
    return null;
  }

  const score = scoreWithoutPenaltyShootout(value.score);

  return {
    externalId: String(value.id),
    date: value.utcDate,
    homeCode: normalizeTeamCode(value.homeTeam?.tla || null),
    awayCode: normalizeTeamCode(value.awayTeam?.tla || null),
    homeScore: score.home,
    awayScore: score.away,
    matchStatus: mapFootballDataStatus(value.status),
  };
}

export async function fetchWorldCupMatches(
  config: FootballDataConfig
): Promise<MatchUpdate[]> {
  const url = new URL(
    `${config.baseUrl}/competitions/${config.competition}/matches`
  );
  url.searchParams.set('season', String(config.season));

  const response = await fetch(url, {
    headers: {
      'X-Auth-Token': config.apiKey,
    },
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  const body = (await response.json()) as FootballDataResponse;

  if (!response.ok) {
    throw new Error(
      `football-data.org returned HTTP ${response.status}${body.message ? `: ${body.message}` : ''}`
    );
  }

  return (body.matches || [])
    .map(toMatchUpdate)
    .filter((match): match is MatchUpdate => match !== null);
}

function findLocalMatch(
  remote: MatchUpdate,
  localMatches: LocalMatch[]
): LocalMatch | null {
  const linked = localMatches.find(
    (match) => match.externalId === remote.externalId
  );
  if (linked) {
    return linked;
  }

  const remoteKickoff = Date.parse(remote.date);
  const kickoffCandidates = localMatches.filter((match) => {
    if (match.externalId || !match.date) {
      return false;
    }
    return (
      Math.abs(Date.parse(match.date) - remoteKickoff) <= KICKOFF_TOLERANCE_MS
    );
  });

  const teamCandidate = kickoffCandidates.find(
    (match) =>
      remote.homeCode &&
      remote.awayCode &&
      match.homeTeam?.code === remote.homeCode &&
      match.awayTeam?.code === remote.awayCode
  );

  return (
    teamCandidate ||
    (kickoffCandidates.length === 1 ? kickoffCandidates[0] : null)
  );
}

function buildUpdateData(
  local: LocalMatch,
  remote: MatchUpdate
): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  if (local.externalId !== remote.externalId) {
    data.externalId = remote.externalId;
  }
  if (local.matchStatus !== remote.matchStatus) {
    data.matchStatus = remote.matchStatus;
  }
  if (remote.homeScore != null && local.homeScore !== remote.homeScore) {
    data.homeScore = remote.homeScore;
  }
  if (remote.awayScore != null && local.awayScore !== remote.awayScore) {
    data.awayScore = remote.awayScore;
  }

  return data;
}

export async function syncFootballDataMatches(strapi: Core.Strapi): Promise<{
  fetched: number;
  linked: number;
  updated: number;
  unmatched: number;
}> {
  const config = getFootballDataConfig();
  if (!config) {
    throw new Error('FOOTBALL_DATA_API_KEY is not configured');
  }

  const remoteMatches = await fetchWorldCupMatches(config);
  const localMatches = (await strapi.documents('api::match.match').findMany({
    populate: { homeTeam: true, awayTeam: true } as never,
    limit: 1000,
  })) as LocalMatch[];

  let linked = 0;
  let updated = 0;
  let unmatched = 0;

  for (const remote of remoteMatches) {
    const local = findLocalMatch(remote, localMatches);
    if (!local) {
      unmatched++;
      continue;
    }

    const data = buildUpdateData(local, remote);
    if (Object.keys(data).length === 0) {
      continue;
    }

    await strapi.documents('api::match.match').update({
      documentId: local.documentId,
      data: data as never,
    });

    if (!local.externalId && data.externalId) {
      linked++;
    }
    Object.assign(local, data);
    updated++;
  }

  return { fetched: remoteMatches.length, linked, updated, unmatched };
}
