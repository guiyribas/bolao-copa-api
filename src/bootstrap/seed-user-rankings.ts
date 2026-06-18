import type { Core } from '@strapi/strapi';

import { recomputeAllUserRankings } from '../api/user-ranking/services/update-user-rankings';

/** Populates `user_rankings` from existing bets when the table is empty. */
export async function seedUserRankingsIfEmpty(strapi: Core.Strapi): Promise<void> {
  const existing = await strapi.documents('api::user-ranking.user-ranking').findMany({
    limit: 1,
  });

  if (existing.length > 0) {
    strapi.log.info('User rankings seed: table already populated, skipping.');
    return;
  }

  strapi.log.info('User rankings seed: recomputing from existing bets…');
  const result = await recomputeAllUserRankings(strapi);
  strapi.log.info(
    `User rankings seed finished: processed=${result.processed}, created=${result.created}, updated=${result.updated}, skipped=${result.skipped}.`
  );
}
