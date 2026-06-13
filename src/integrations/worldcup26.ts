import type { Core } from '@strapi/strapi';

import { resolveSyncedMatchStatus } from './match-status-sync-rules';

const DEFAULT_BASE_URL = 'https://worldcup26.ir';
const DEFAULT_TIMEOUT_MS = 15_000;

type MatchStatus = 'scheduled' | 'live' | 'finished';

type WorldCup26Game = {
  id?: string | number;
  home_score?: string | number | null;
  away_score?: string | number | null;
  finished?: string | boolean;
  time_elapsed?: string | number | null;
};

type WorldCup26Response = {
  games?: WorldCup26Game[];
};

type LocalMatch = {
  documentId: string;
  matchNumber?: number | null;
  homeScore?: number | null;
  awayScore?: number | null;
  matchStatus?: MatchStatus | null;
};

export type WorldCup26Update = {
  matchNumber: number;
  homeScore: number | null;
  awayScore: number | null;
  matchStatus: MatchStatus;
};

function parsePositiveInteger(
  value: string | undefined,
  fallback: number
): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseScore(value: string | number | null | undefined): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function isFinished(value: WorldCup26Game['finished']): boolean {
  return value === true || String(value).toUpperCase() === 'TRUE';
}

export function mapWorldCup26Status(game: WorldCup26Game): MatchStatus {
  if (isFinished(game.finished)) {
    return 'finished';
  }

  const elapsed = String(game.time_elapsed ?? '')
    .trim()
    .toLowerCase();
  if (elapsed && !['notstarted', 'not_started', '0'].includes(elapsed)) {
    return 'live';
  }

  return 'scheduled';
}

export function toWorldCup26Update(
  game: WorldCup26Game
): WorldCup26Update | null {
  const matchNumber = Number(game.id);
  if (!Number.isInteger(matchNumber) || matchNumber <= 0) {
    return null;
  }

  const matchStatus = mapWorldCup26Status(game);
  return {
    matchNumber,
    homeScore: matchStatus === 'scheduled' ? null : parseScore(game.home_score),
    awayScore: matchStatus === 'scheduled' ? null : parseScore(game.away_score),
    matchStatus,
  };
}

export async function fetchWorldCup26Matches(): Promise<WorldCup26Update[]> {
  const baseUrl = (
    process.env.WORLDCUP26_API_URL?.trim() || DEFAULT_BASE_URL
  ).replace(/\/$/, '');
  const timeoutMs = parsePositiveInteger(
    process.env.WORLDCUP26_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS
  );
  const response = await fetch(`${baseUrl}/get/games`, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = (await response.json()) as WorldCup26Response;

  if (!response.ok) {
    throw new Error(`worldcup26 returned HTTP ${response.status}`);
  }

  return (body.games || [])
    .map(toWorldCup26Update)
    .filter((match): match is WorldCup26Update => match !== null);
}

export async function syncWorldCup26Matches(strapi: Core.Strapi): Promise<{
  fetched: number;
  linked: number;
  updated: number;
  unmatched: number;
}> {
  const remoteMatches = await fetchWorldCup26Matches();
  const localMatches = (await strapi.documents('api::match.match').findMany({
    limit: 1000,
  })) as LocalMatch[];
  const localByNumber = new Map(
    localMatches.map((match) => [match.matchNumber, match])
  );

  let updated = 0;
  let unmatched = 0;

  for (const remote of remoteMatches) {
    const local = localByNumber.get(remote.matchNumber);
    if (!local) {
      unmatched++;
      continue;
    }

    const data: Record<string, unknown> = {};
    const nextStatus = resolveSyncedMatchStatus(
      local.matchStatus,
      remote.matchStatus
    );
    if (local.matchStatus !== nextStatus) data.matchStatus = nextStatus;
    if (remote.homeScore != null && local.homeScore !== remote.homeScore)
      data.homeScore = remote.homeScore;
    if (remote.awayScore != null && local.awayScore !== remote.awayScore)
      data.awayScore = remote.awayScore;
    if (Object.keys(data).length === 0) continue;

    await strapi.documents('api::match.match').update({
      documentId: local.documentId,
      data: data as never,
    });
    Object.assign(local, data);
    updated++;
  }

  return { fetched: remoteMatches.length, linked: 0, updated, unmatched };
}
