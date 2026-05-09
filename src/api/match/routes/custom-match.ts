export default {
  routes: [
    {
      method: 'PATCH',
      path: '/matches/:id/result',
      handler: 'custom-match.updateResult',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
