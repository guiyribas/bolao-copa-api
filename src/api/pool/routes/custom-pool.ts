export default {
  routes: [
    {
      method: 'GET',
      path: '/pools/match/:matchDocumentId/bets',
      handler: 'custom-pool.poolMatchBets',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/pools/mine/memberships',
      handler: 'custom-pool.myMemberships',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/pools/join',
      handler: 'custom-pool.join',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/pools/join/:inviteCode',
      handler: 'custom-pool.join',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/pools/:id/ranking',
      handler: 'custom-pool.ranking',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/pools/:id/session',
      handler: 'custom-pool.poolSession',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/pools/:id/members',
      handler: 'custom-pool.members',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PATCH',
      path: '/pools/:id/members/:userId/payment',
      handler: 'custom-pool.updatePayment',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/pools/:id/members/:userId',
      handler: 'custom-pool.removeMember',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PATCH',
      path: '/pools/:id/settings',
      handler: 'custom-pool.updatePoolSettings',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
