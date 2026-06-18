import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Core } from '@strapi/strapi';

import { recalculateMatchBetPoints } from './recalculate-match-points';

function makeStrapiMock(
  bets: Array<Record<string, unknown>>,
  updates: Array<{ documentId: string; points: number }>
) {
  const strapi = {
    documents: (uid?: string) => ({
      findMany: async () => {
        if (uid === 'api::user-ranking.user-ranking') return [];
        if (uid === 'plugin::users-permissions.user') {
          return [{ documentId: 'user-1' }];
        }
        return bets;
      },
      create: async () => ({}),
      update: async () => ({}),
    }),
    db: {
      transaction: async (fn: () => Promise<void>) => fn(),
      query: () => ({
        update: async ({
          where,
          data,
        }: {
          where: { documentId: string };
          data: { points: number };
        }) => {
          updates.push({ documentId: where.documentId, points: data.points });
        },
      }),
    },
  } as unknown as Core.Strapi;

  return { strapi, updates };
}

describe('recalculateMatchBetPoints', () => {
  it('atualiza apenas bets cujo points mudou', async () => {
    const updates: Array<{ documentId: string; points: number }> = [];
    const { strapi } = makeStrapiMock(
      [
        {
          documentId: 'bet-1',
          homeScore: 2,
          awayScore: 1,
          points: null,
          user: { id: 1 },
        },
        {
          documentId: 'bet-2',
          homeScore: 2,
          awayScore: 1,
          points: 10,
          user: { id: 2 },
        },
      ],
      updates
    );

    const result = await recalculateMatchBetPoints(strapi, {
      documentId: 'match-1',
      homeScore: 2,
      awayScore: 1,
      phase: 'group',
    });

    assert.equal(result.updated, 1);
    assert.equal(result.skipped, 1);
    assert.deepEqual(updates, [{ documentId: 'bet-1', points: 10 }]);
  });

  it('ignora bets sem placar de palpite', async () => {
    const updates: Array<{ documentId: string; points: number }> = [];
    const { strapi } = makeStrapiMock(
      [
        {
          documentId: 'bet-1',
          homeScore: null,
          awayScore: 1,
          points: null,
        },
      ],
      updates
    );

    const result = await recalculateMatchBetPoints(strapi, {
      documentId: 'match-1',
      homeScore: 2,
      awayScore: 1,
    });

    assert.equal(result.updated, 0);
    assert.equal(result.skipped, 1);
    assert.equal(updates.length, 0);
  });
});
