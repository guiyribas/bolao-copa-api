export default async (policyContext, config, { strapi }) => {
  const user = policyContext.state.user;

  if (!user) {
    return false;
  }

  const { id } = policyContext.params;
  if (!id) {
    return true;
  }

  const contentType = config.contentType;
  if (!contentType) {
    return true;
  }

  const entity = await strapi.documents(contentType).findOne({
    documentId: id,
    populate: ['user'],
  });

  if (!entity) {
    return false;
  }

  return entity.user?.id === user.id;
};
