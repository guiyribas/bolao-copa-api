import type { Core } from '@strapi/strapi';

export const DEFAULT_TOURNAMENT_PHASE = 'group';

const VALID_PHASES = new Set([
  'group',
  'round_of_32',
  'round_of_16',
  'quarter',
  'semi',
  'third_place',
  'final',
]);

type TournamentConfigRow = {
  currentPhase?: string | null;
};

export async function getCurrentTournamentPhase(strapi: Core.Strapi): Promise<string> {
  const row = (await strapi.documents('api::tournament-config.tournament-config').findFirst()) as
    | TournamentConfigRow
    | null
    | undefined;

  const phase = row?.currentPhase?.trim();
  if (phase && VALID_PHASES.has(phase)) {
    return phase;
  }

  return DEFAULT_TOURNAMENT_PHASE;
}
