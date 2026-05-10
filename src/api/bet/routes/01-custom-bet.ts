export default {
  routes: [
    {
      method: 'GET',
      path: '/bets/my-bets',
      handler: 'custom-bet.myBets',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/bets/group-simulation',
      handler: 'group-simulation.simulate',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/bets/by-username/:username/public',
      handler: 'custom-bet.publicBetsByUsername',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
