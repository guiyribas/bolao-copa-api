import crypto from 'crypto';

import { runProductionBootstrap } from './bootstrap/production-bootstrap';
import { ensureGoogleFrontendRedirect } from './bootstrap/users-permissions-bootstrap';

function generatePoolInviteCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

export default {
  async bootstrap({ strapi }) {
    try {
      await ensureGoogleFrontendRedirect(strapi);
    } catch (error) {
      strapi.log.error('Users & Permissions Google redirect bootstrap failed.', error);
      throw error;
    }

    if (process.env.AUTO_BOOTSTRAP_PRODUCTION !== 'true') {
      return;
    }

    try {
      await runProductionBootstrap(strapi);
    } catch (error) {
      strapi.log.error('Production bootstrap failed.', error);
      throw error;
    }
  },

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
