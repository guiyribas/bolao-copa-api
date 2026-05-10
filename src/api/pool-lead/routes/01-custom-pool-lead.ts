export default {
  routes: [
    {
      method: 'POST',
      path: '/pool-leads/submit',
      handler: 'custom-pool-lead.submitPublic',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
