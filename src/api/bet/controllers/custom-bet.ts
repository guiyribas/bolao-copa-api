import type { Core } from '@strapi/strapi';

const customBet = ({ strapi }: { strapi: Core.Strapi }) => ({
  async myBets(ctx) {
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

    const filters: Record<string, unknown> = {
      ...(userDocumentId ? { user: { documentId: userDocumentId } } : { user: { id: user.id } }),
    };

    const bets = await strapi.documents('api::bet.bet').findMany({
      filters,
      populate: ['match', 'match.homeTeam', 'match.awayTeam'],
      sort: { createdAt: 'asc' } as any,
    });

    return ctx.send({ data: bets });
  },
});

export default customBet;
