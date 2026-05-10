import type { Core } from '@strapi/strapi';

/** Bandeiras dos times nas partidas aninhadas (igual ao REST com `populate[homeTeam][populate]=flag`). */
const betMatchPopulate = {
  match: {
    populate: {
      homeTeam: { populate: { flag: true } },
      awayTeam: { populate: { flag: true } },
    },
  },
} as const;

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
      populate: betMatchPopulate as any,
      sort: { createdAt: 'asc' } as any,
    });

    return ctx.send({ data: bets });
  },

  /**
   * Palpites públicos por username: apenas partidas ao vivo ou finalizadas.
   * Não expõe email nem outros dados sensíveis do utilizador.
   */
  async publicBetsByUsername(ctx) {
    const raw = ctx.params.username as string | undefined;
    const username = raw != null ? decodeURIComponent(raw).trim() : '';
    if (!username) {
      return ctx.badRequest('username is required');
    }

    const users = await strapi.documents('plugin::users-permissions.user').findMany({
      filters: { username },
      limit: 1,
    });

    const target = users[0] as { documentId?: string; username?: string } | undefined;
    if (!target?.documentId) {
      return ctx.notFound('User not found');
    }

    const displayName = target.username ?? username;

    const allBets = await strapi.documents('api::bet.bet').findMany({
      filters: {
        user: { documentId: target.documentId },
      },
      populate: betMatchPopulate as any,
      sort: { createdAt: 'asc' } as any,
    });

    const bets = (allBets as Array<{ match?: { matchStatus?: string } }>).filter((b) => {
      const st = b.match?.matchStatus;
      return st === 'live' || st === 'finished';
    });

    return ctx.send({
      data: {
        bets,
        username: displayName,
      },
    });
  },
});

export default customBet;
