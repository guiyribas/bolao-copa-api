import type { Core } from '@strapi/strapi';

import { syncFootballDataMatches } from './football-data';
import { syncWorldCup26Matches } from './worldcup26';

export type ScoreProvider = 'football-data' | 'worldcup26';

export function getScoreProvider(): ScoreProvider {
  const provider = process.env.SCORE_PROVIDER?.trim() || 'football-data';
  if (provider === 'football-data' || provider === 'worldcup26') {
    return provider;
  }
  throw new Error(`Unsupported SCORE_PROVIDER: ${provider}`);
}

export function isScoreSyncEnabled(): boolean {
  return process.env.SCORE_SYNC_ENABLED === 'true';
}

export async function syncScores(strapi: Core.Strapi) {
  const provider = getScoreProvider();
  const result =
    provider === 'worldcup26'
      ? await syncWorldCup26Matches(strapi)
      : await syncFootballDataMatches(strapi);

  return { provider, ...result };
}
