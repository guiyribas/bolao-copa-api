export default {
  routes: [
    {
      method: 'GET',
      path: '/global-ranking',
      handler: 'global-ranking.list',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
