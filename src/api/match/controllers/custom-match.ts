import type { Core } from '@strapi/strapi';

const customMatch = ({ strapi }: { strapi: Core.Strapi }) => ({
  async updateResult(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const { id } = ctx.params;
    const { homeScore, awayScore, matchStatus } = ctx.request.body;

    if (homeScore == null || awayScore == null) {
      return ctx.badRequest('homeScore and awayScore are required');
    }

    if (homeScore < 0 || awayScore < 0) {
      return ctx.badRequest('Scores must be non-negative');
    }

    const updated = await strapi.documents('api::match.match').update({
      documentId: id,
      data: {
        homeScore,
        awayScore,
        matchStatus: matchStatus || 'finished',
      } as any,
    });

    return ctx.send({ data: updated });
  },
});

export default customMatch;
