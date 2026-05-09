import crypto from 'crypto';

function generatePoolInviteCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

export default {
  register({ strapi }) {
    strapi.documents.use(async (context, next) => {
      if (context.uid !== 'api::pool.pool' || context.action !== 'create') {
        return next();
      }

      const data = context.params.data;
      if (!data) {
        return next();
      }

      const raw = data.inviteCode;
      const missing =
        raw == null || (typeof raw === 'string' && raw.trim() === '');

      if (missing) {
        data.inviteCode = generatePoolInviteCode();
      }

      const result = await next();
      return result;
    });
  },
};
