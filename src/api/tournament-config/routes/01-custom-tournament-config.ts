export default {
  routes: [
    {
      method: 'GET',
      path: '/tournament/current-phase',
      handler: 'custom-tournament-config.currentPhase',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
