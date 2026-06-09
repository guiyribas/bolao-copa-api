import * as core from '@strapi/core';

import { syncScores } from '../integrations/score-sync';

async function main() {
  const appContext = await core.compileStrapi();
  const app = await core.createStrapi(appContext).load();

  try {
    const result = await syncScores(app);
    console.log('[score-sync]', result);
  } finally {
    await app.destroy();
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('[score-sync]', error);
  process.exit(1);
});
