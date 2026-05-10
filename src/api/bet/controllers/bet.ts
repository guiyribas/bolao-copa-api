import { factories } from '@strapi/strapi';

import { assertMatchAcceptsBet, assertUserIsBetOwner, parseBetScores } from '../services/bet-guards';

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

    const parsed = parseBetScores(homeScore, awayScore);
    if (parsed.ok === false) {
      return ctx.badRequest(parsed.message);
    }

    const match = await strapi.documents('api::match.match').findOne({
      documentId: matchId,
    });

    if (!match) {
      return ctx.notFound('Match not found');
    }

    const gate = assertMatchAcceptsBet(match as { date?: string; matchStatus?: string | null });
    if (gate.ok === false) {
      return ctx.badRequest(gate.message);
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
        data: { homeScore: parsed.homeScore, awayScore: parsed.awayScore } as any,
      });
      return ctx.send({ data: updated });
    }

    const bet = await strapi.documents('api::bet.bet').create({
      data: {
        user: user.id,
        match: matchId,
        homeScore: parsed.homeScore,
        awayScore: parsed.awayScore,
      } as any,
    });

    return ctx.send({ data: bet });
  },

  async update(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const documentId = (ctx.params as { documentId?: string }).documentId ?? ctx.params.id;
    if (!documentId) {
      return ctx.badRequest('Missing document id');
    }

    const existing = await strapi.documents('api::bet.bet').findOne({
      documentId: String(documentId),
      populate: ['match', 'user'],
    });

    if (!existing) {
      return ctx.notFound('Bet not found');
    }

    const ownerId = (existing as { user?: { id?: number } }).user?.id;
    const ownerGate = assertUserIsBetOwner(user.id, ownerId);
    if (ownerGate.ok === false) {
      return ctx.forbidden(ownerGate.message);
    }

    const body = ctx.request.body?.data || {};
    const homeScore = body.homeScore ?? (existing as { homeScore?: number }).homeScore;
    const awayScore = body.awayScore ?? (existing as { awayScore?: number }).awayScore;

    const parsed = parseBetScores(homeScore, awayScore);
    if (parsed.ok === false) {
      return ctx.badRequest(parsed.message);
    }

    const matchRel = (existing as { match?: unknown }).match;
    let match: { date?: string; matchStatus?: string | null } | null = null;
    if (matchRel && typeof matchRel === 'object' && 'date' in (matchRel as object)) {
      match = matchRel as { date?: string; matchStatus?: string | null };
    } else {
      const mid =
        typeof matchRel === 'object' && matchRel && 'documentId' in (matchRel as object)
          ? (matchRel as { documentId: string }).documentId
          : matchRel;
      if (mid == null || mid === '') {
        return ctx.badRequest('Match not found for bet');
      }
      const loaded = await strapi.documents('api::match.match').findOne({
        documentId: String(mid),
      });
      match = loaded as { date?: string; matchStatus?: string | null } | null;
    }

    if (!match) {
      return ctx.badRequest('Match not found for bet');
    }

    const gate = assertMatchAcceptsBet(match);
    if (gate.ok === false) {
      return ctx.badRequest(gate.message);
    }

    const updated = await strapi.documents('api::bet.bet').update({
      documentId: String(documentId),
      data: { homeScore: parsed.homeScore, awayScore: parsed.awayScore } as any,
    });

    return ctx.send({ data: updated });
  },
}));
