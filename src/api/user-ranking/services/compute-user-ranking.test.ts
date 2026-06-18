import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Core } from '@strapi/strapi';

import { computeUserRankingTotals } from './compute-user-ranking';

function makeStrapiWithBets(bets: Array<Record<string, unknown>>) {
  return {
    documents: () => ({
      findMany: async () => bets,
    }),
  } as unknown as Core.Strapi;
}

describe('computeUserRankingTotals', () => {
  it('soma pontos por fase e conta placares exatos', async () => {
    const strapi = makeStrapiWithBets([
      { points: 10, match: { phase: 'group' } },
      { points: 5, match: { phase: 'round_of_16' } },
      { points: 3, match: { phase: 'group' } },
      { points: null, match: { phase: 'group' } },
    ]);

    const totals = await computeUserRankingTotals(strapi, 1);

    assert.deepEqual(totals, {
      totalPoints: 18,
      groupPhasePoints: 13,
      knockoutPoints: 5,
      exactHitCount: 1,
    });
  });
});
