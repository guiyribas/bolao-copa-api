import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::bet.bet', ({ strapi }) => ({
  async create(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const { match: matchId, homeScore, awayScore } = ctx.request.body?.data || {};

    if (!matchId || homeScore == null || awayScore == null) {
      return ctx.badRequest('match, homeScore, and awayScore are required');
    }

    const match = await strapi.documents('api::match.match').findOne({
      documentId: matchId,
    });

    if (!match) {
      return ctx.notFound('Match not found');
    }

    if (match.status === 'finished') {
      return ctx.badRequest('Não é possível alterar o palpite após o jogo finalizado.');
    }

    const existingBets = await strapi.documents('api::bet.bet').findMany({
      filters: {
        user: { id: user.id },
        match: { documentId: matchId },
      },
    });

    if (existingBets.length > 0) {
      const updated = await strapi.documents('api::bet.bet').update({
        documentId: existingBets[0].documentId,
        data: { homeScore, awayScore } as any,
      });
      return ctx.send({ data: updated });
    }

    const bet = await strapi.documents('api::bet.bet').create({
      data: {
        user: user.id,
        match: matchId,
        homeScore,
        awayScore,
      } as any,
    });

    return ctx.send({ data: bet });
  },
}));
