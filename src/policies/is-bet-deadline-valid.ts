export default async (policyContext, config, { strapi }) => {
  const { body } = policyContext.request;

  if (!body?.data?.match) {
    return true;
  }

  const matchId = body.data.match;

  const match = await strapi.documents('api::match.match').findOne({
    documentId: matchId,
  });

  if (!match) {
    return false;
  }

  const matchDate = new Date(match.date);
  const now = new Date();

  if (now >= matchDate) {
    return policyContext.badRequest('Bet deadline has passed. Match has already started.');
  }

  return true;
};
