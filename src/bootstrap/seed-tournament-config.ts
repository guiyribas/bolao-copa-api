import type { Core } from '@strapi/strapi';

import { DEFAULT_TOURNAMENT_PHASE } from '../api/tournament-config/services/get-current-phase';

/** Creates the tournament-config single type with default phase when missing. */
export async function seedTournamentConfigIfEmpty(strapi: Core.Strapi): Promise<void> {
  const existing = await strapi.documents('api::tournament-config.tournament-config').findFirst();

  if (existing) {
    strapi.log.info('Tournament config seed: record already exists, skipping.');
    return;
  }

  await strapi.documents('api::tournament-config.tournament-config').create({
    data: {
      currentPhase: DEFAULT_TOURNAMENT_PHASE,
    },
  });

  strapi.log.info(
    `Tournament config seed: created with currentPhase=${DEFAULT_TOURNAMENT_PHASE}.`
  );
}
