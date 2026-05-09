import { calculatePoints } from '../../../../api/bet/services/scoring';

export default {
  async afterUpdate(event) {
    const { result } = event;

    if (result.status !== 'finished' || result.homeScore == null || result.awayScore == null) {
      return;
    }

    const bets = await strapi.documents('api::bet.bet').findMany({
      filters: { match: { documentId: result.documentId } } as any,
      populate: ['match'],
    });

    for (const bet of bets as any[]) {
      const points = calculatePoints(
        { homeScore: bet.homeScore, awayScore: bet.awayScore },
        { homeScore: result.homeScore, awayScore: result.awayScore, phase: result.phase }
      );

      await strapi.documents('api::bet.bet').update({
        documentId: bet.documentId,
        data: { points } as any,
      });
    }
  },
};
