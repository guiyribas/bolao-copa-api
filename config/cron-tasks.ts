import type { Core } from '@strapi/strapi';

import { syncMatchStatuses } from '../src/bootstrap/match-status-sync';

export default {
  matchStatusSync: {
    task: async ({ strapi }: { strapi: Core.Strapi }) => {
      await syncMatchStatuses(strapi);
    },
    options: {
      rule: '0 * * * * *',
    },
  },
};
