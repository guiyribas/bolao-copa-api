import type { Core } from '@strapi/strapi';

import { calculatePoints } from './scoring';

export type FinishedMatchForScoring = {
  documentId: string;
  homeScore: number;
  awayScore: number;
  phase?: string;
};

type BetRow = {
  documentId: string;
  homeScore: number | null;
  awayScore: number | null;
  points: number | null;
};

export async function recalculateMatchBetPoints(
  strapi: Core.Strapi,
  match: FinishedMatchForScoring
): Promise<{ updated: number; skipped: number }> {
  const bets = (await strapi.documents('api::bet.bet').findMany({
    filters: { match: { documentId: match.documentId } } as never,
  })) as BetRow[];

  const toUpdate: Array<{ documentId: string; points: number }> = [];
  let skipped = 0;

  for (const bet of bets) {
    if (bet.homeScore == null || bet.awayScore == null) {
      skipped += 1;
      continue;
    }

    const points = calculatePoints(
      { homeScore: bet.homeScore, awayScore: bet.awayScore },
      { homeScore: match.homeScore, awayScore: match.awayScore, phase: match.phase }
    );

    if (bet.points === points) {
      skipped += 1;
      continue;
    }

    toUpdate.push({ documentId: bet.documentId, points });
  }

  if (toUpdate.length === 0) {
    return { updated: 0, skipped };
  }

  await strapi.db.transaction(async () => {
    for (const { documentId, points } of toUpdate) {
      await strapi.db.query('api::bet.bet').update({
        where: { documentId },
        data: { points },
      });
    }
  });

  return { updated: toUpdate.length, skipped };
}
