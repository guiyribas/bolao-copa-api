import type { Core } from '@strapi/strapi';

import { updateUserRankings } from '../../user-ranking/services/update-user-rankings';
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
  user?: { id?: number | string } | null;
};

export async function recalculateMatchBetPoints(
  strapi: Core.Strapi,
  match: FinishedMatchForScoring
): Promise<{ updated: number; skipped: number }> {
  const bets = (await strapi.documents('api::bet.bet').findMany({
    filters: { match: { documentId: match.documentId } } as never,
    populate: ['user'],
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

  const affectedUserIds: number[] = [];

  await strapi.db.transaction(async () => {
    for (const { documentId, points } of toUpdate) {
      await strapi.db.query('api::bet.bet').update({
        where: { documentId },
        data: { points },
      });
    }
  });

  for (const bet of bets) {
    const rawId = bet.user?.id;
    if (rawId == null) continue;
    const id = Number(rawId);
    if (Number.isFinite(id) && id > 0) {
      affectedUserIds.push(id);
    }
  }

  if (affectedUserIds.length > 0) {
    await updateUserRankings(strapi, affectedUserIds);
  }

  return { updated: toUpdate.length, skipped };
}
