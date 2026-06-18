import type { Core } from '@strapi/strapi';

import { isExactScorePoints, isKnockoutPhase } from '../../bet/services/scoring';

export type UserRankingTotals = {
  totalPoints: number;
  groupPhasePoints: number;
  knockoutPoints: number;
  exactHitCount: number;
};

type BetRow = {
  points?: number | null;
  match?: { phase?: string | null };
};

export async function computeUserRankingTotals(
  strapi: Core.Strapi,
  userId: number
): Promise<UserRankingTotals> {
  const bets = (await strapi.documents('api::bet.bet').findMany({
    filters: { user: { id: userId } } as never,
    populate: ['match'],
  })) as BetRow[];

  let totalPoints = 0;
  let groupPhasePoints = 0;
  let knockoutPoints = 0;
  let exactHitCount = 0;

  for (const bet of bets) {
    const pts = bet.points ?? 0;
    totalPoints += pts;
    const phase = bet.match?.phase ?? undefined;
    if (isKnockoutPhase(phase)) {
      knockoutPoints += pts;
    } else {
      groupPhasePoints += pts;
    }
    if (isExactScorePoints(phase, pts)) {
      exactHitCount += 1;
    }
  }

  return { totalPoints, groupPhasePoints, knockoutPoints, exactHitCount };
}
