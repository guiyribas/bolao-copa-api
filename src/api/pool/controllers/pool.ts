import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::pool.pool', ({ strapi }) => ({
  async create(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const { name, description, value } = ctx.request.body?.data || {};

    if (!name) {
      return ctx.badRequest('Pool name is required');
    }

    if (value == null || value < 0) {
      return ctx.badRequest('A valid pool value is required');
    }

    const pool = await strapi.documents('api::pool.pool').create({
      data: {
        name,
        description: description || null,
        value,
        admin: user.documentId,
      },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const inviteLink = pool.inviteCode
      ? `${frontendUrl}/invite/${pool.inviteCode}`
      : null;

    await strapi.documents('api::pool-membership.pool-membership').create({
      data: {
        pool: pool.documentId,
        user: user.documentId,
        hasPaid: true,
        joinedAt: new Date().toISOString(),
      },
    });

    return ctx.send({ data: { ...pool, inviteLink } });
  },
}));
