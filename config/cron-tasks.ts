import type { Core } from '@strapi/strapi';

import { syncMatchStatuses } from '../src/bootstrap/match-status-sync';
import {
  getScoreProvider,
  isScoreSyncEnabled,
  type ScoreProvider,
  syncScores,
} from '../src/integrations/score-sync';

let scoreSyncRunning = false;

function cronRule(envName: string, fallback: string): string {
  return process.env[envName]?.trim() || fallback;
}

async function runScoreSync(strapi: Core.Strapi, provider: ScoreProvider) {
  if (!isScoreSyncEnabled() || getScoreProvider() !== provider) {
    return;
  }
  if (scoreSyncRunning) {
    strapi.log.warn('[score-sync] Previous sync is still running; skipping');
    return;
  }

  scoreSyncRunning = true;
  try {
    const result = await syncScores(strapi);
    strapi.log.info(`[score-sync] ${JSON.stringify(result)}`);
  } catch (error) {
    strapi.log.error(
      `[score-sync] ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    scoreSyncRunning = false;
  }
}

export default {
  matchStatusSync: {
    task: async ({ strapi }: { strapi: Core.Strapi }) => {
      await syncMatchStatuses(strapi);
    },
    options: {
      rule: '0 * * * * *',
    },
  },
  footballDataScoreSync: {
    task: async ({ strapi }: { strapi: Core.Strapi }) => {
      await runScoreSync(strapi, 'football-data');
    },
    options: {
      rule: cronRule('FOOTBALL_DATA_CRON', '0 */15 * * * *'),
    },
  },
  worldCup26ScoreSync: {
    task: async ({ strapi }: { strapi: Core.Strapi }) => {
      await runScoreSync(strapi, 'worldcup26');
    },
    options: {
      rule: cronRule('WORLDCUP26_CRON', '0 */3 * * * *'),
    },
  },
};
