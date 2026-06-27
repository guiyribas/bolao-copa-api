import type { Core } from '@strapi/strapi';

import { getCurrentTournamentPhase } from '../services/get-current-phase';

const customTournamentConfig = ({ strapi }: { strapi: Core.Strapi }) => ({
  async currentPhase(ctx) {
    const currentPhase = await getCurrentTournamentPhase(strapi);
    return ctx.send({ currentPhase });
  },
});

export default customTournamentConfig;
