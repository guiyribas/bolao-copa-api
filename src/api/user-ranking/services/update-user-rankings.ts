import type { Core } from '@strapi/strapi';

import { computeUserRankingTotals } from './compute-user-ranking';

async function resolveUserDocumentId(
  strapi: Core.Strapi,
  userId: number
): Promise<string | null> {
  const users = await strapi.documents('plugin::users-permissions.user').findMany({
    filters: { id: userId },
    limit: 1,
  });
  const documentId = users[0]?.documentId;
  return typeof documentId === 'string' && documentId.length > 0 ? documentId : null;
}

export async function upsertUserRanking(
  strapi: Core.Strapi,
  userId: number
): Promise<'created' | 'updated' | 'skipped'> {
  const userDocumentId = await resolveUserDocumentId(strapi, userId);
  if (!userDocumentId) {
    return 'skipped';
  }

  const totals = await computeUserRankingTotals(strapi, userId);

  const existing = await strapi.documents('api::user-ranking.user-ranking').findMany({
    filters: { user: { documentId: userDocumentId } },
    limit: 1,
  });

  const data = {
    user: userDocumentId,
    totalPoints: totals.totalPoints,
    groupPhasePoints: totals.groupPhasePoints,
    knockoutPoints: totals.knockoutPoints,
    exactHitCount: totals.exactHitCount,
  };

  if (existing.length > 0) {
    await strapi.documents('api::user-ranking.user-ranking').update({
      documentId: existing[0].documentId,
      data: data as never,
    });
    return 'updated';
  }

  await strapi.documents('api::user-ranking.user-ranking').create({
    data: data as never,
  });
  return 'created';
}

export async function updateUserRankings(
  strapi: Core.Strapi,
  userIds: number[]
): Promise<{ processed: number; created: number; updated: number; skipped: number }> {
  const uniqueIds = [...new Set(userIds.filter((id) => Number.isFinite(id) && id > 0))];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const userId of uniqueIds) {
    const result = await upsertUserRanking(strapi, userId);
    if (result === 'created') created += 1;
    else if (result === 'updated') updated += 1;
    else skipped += 1;
  }

  return { processed: uniqueIds.length, created, updated, skipped };
}

export async function recomputeAllUserRankings(
  strapi: Core.Strapi
): Promise<{ processed: number; created: number; updated: number; skipped: number }> {
  const bets = (await strapi.documents('api::bet.bet').findMany({
    populate: ['user'],
  })) as Array<{ user?: { id?: number | string } | null }>;

  const userIds: number[] = [];
  for (const bet of bets) {
    const rawId = bet.user?.id;
    if (rawId == null) continue;
    const id = Number(rawId);
    if (Number.isFinite(id) && id > 0) {
      userIds.push(id);
    }
  }

  return updateUserRankings(strapi, userIds);
}
