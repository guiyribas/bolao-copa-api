import type { Core } from '@strapi/strapi';

const customPool = ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Lista memberships do usuário logado. O REST genérico não aceita
   * `filters[user]` (ValidationError: Invalid key user) em Strapi 5.
   */
  async myMemberships(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    let userDocumentId = user.documentId as string | undefined;
    if (!userDocumentId && user.id != null) {
      const found = await strapi.documents('plugin::users-permissions.user').findMany({
        filters: { id: user.id },
        limit: 1,
      });
      userDocumentId = found[0]?.documentId;
    }

    if (!userDocumentId) {
      return ctx.badRequest('Could not resolve user');
    }

    const memberships = await strapi.documents('api::pool-membership.pool-membership').findMany({
      filters: {
        user: { documentId: userDocumentId },
      },
      populate: ['pool'],
    });

    return ctx.send({ data: memberships });
  },

  async join(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const inviteCode = ctx.params.inviteCode || ctx.request.body?.inviteCode;
    if (!inviteCode) {
      return ctx.badRequest('inviteCode is required');
    }

    const pools = await strapi.documents('api::pool.pool').findMany({
      filters: { inviteCode },
    });

    if (!pools.length) {
      return ctx.notFound('Pool not found with this invite code');
    }

    const pool = pools[0];

    const existingMembership = await strapi.documents('api::pool-membership.pool-membership').findMany({
      filters: {
        pool: { documentId: pool.documentId },
        user: { documentId: user.documentId },
      },
    });

    if (existingMembership.length > 0) {
      return ctx.badRequest('You are already a member of this pool');
    }

    const membership = await strapi.documents('api::pool-membership.pool-membership').create({
      data: {
        pool: pool.documentId,
        user: user.documentId,
        hasPaid: false,
        joinedAt: new Date().toISOString(),
      },
    });

    return ctx.send({ data: membership });
  },

  async ranking(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const { id } = ctx.params;

    const memberships = await strapi.documents('api::pool-membership.pool-membership').findMany({
      filters: { pool: { documentId: id } },
      populate: ['user'],
    });

    const rankingMap: Record<string, { userId: string; username: string; points: number }> = {};

    for (const m of memberships as any[]) {
      const u = m.user;
      if (!u?.id) continue;
      const key = String(u.id);
      rankingMap[key] = {
        userId: String(u.id),
        username: u.username || String(u.id),
        points: 0,
      };
    }

    const memberIds = Object.keys(rankingMap).map((k) => Number(k));

    if (memberIds.length > 0) {
      const bets = await strapi.documents('api::bet.bet').findMany({
        filters: {
          $or: memberIds.map((memberId) => ({ user: { id: memberId } })),
        } as any,
        populate: ['user'],
      });

      for (const bet of bets as any[]) {
        if (!bet.user?.id) continue;
        const key = String(bet.user.id);
        if (!rankingMap[key]) continue;
        rankingMap[key].points += bet.points || 0;
      }
    }

    const qualificationBets = await strapi.documents('api::qualification-bet.qualification-bet').findMany({
      filters: { pool: { documentId: id } },
      populate: ['user'],
    });

    for (const qBet of qualificationBets as any[]) {
      if (!qBet.user?.id) continue;
      const key = String(qBet.user.id);
      if (!rankingMap[key]) continue;
      rankingMap[key].points += qBet.points || 0;
    }

    const ranking = Object.values(rankingMap).sort((a, b) => b.points - a.points);

    return ctx.send({ data: ranking });
  },

  async members(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const { id } = ctx.params;

    const pool = await strapi.documents('api::pool.pool').findOne({
      documentId: id,
      populate: ['admin'],
    });

    if (!pool) {
      return ctx.notFound('Pool not found');
    }

    if (pool.admin?.id !== user.id) {
      return ctx.forbidden('Only the pool admin can view members');
    }

    const memberships = await strapi.documents('api::pool-membership.pool-membership').findMany({
      filters: { pool: { documentId: id } },
      populate: ['user'],
    });

    const members = memberships.map((m) => ({
      id: m.user?.id,
      userDocumentId: m.user?.documentId,
      username: m.user?.username,
      email: m.user?.email,
      hasPaid: m.hasPaid,
      joinedAt: m.joinedAt,
      membershipId: m.documentId,
    }));

    return ctx.send({ data: members });
  },

  async updatePayment(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const { id, userId } = ctx.params;
    const { hasPaid } = ctx.request.body;

    const pool = await strapi.documents('api::pool.pool').findOne({
      documentId: id,
      populate: ['admin'],
    });

    if (!pool) {
      return ctx.notFound('Pool not found');
    }

    if (pool.admin?.id !== user.id) {
      return ctx.forbidden('Only the pool admin can update payment status');
    }

    const memberships = await strapi.documents('api::pool-membership.pool-membership').findMany({
      filters: {
        pool: { documentId: id },
        user: { documentId: userId },
      },
    });

    if (!memberships.length) {
      return ctx.notFound('Membership not found');
    }

    const updated = await strapi.documents('api::pool-membership.pool-membership').update({
      documentId: memberships[0].documentId,
      data: { hasPaid: Boolean(hasPaid) } as any,
    });

    return ctx.send({ data: updated });
  },
});

export default customPool;
