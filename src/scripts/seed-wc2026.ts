/**
 * Rode na raiz do projeto (PostgreSQL no ar, mesmo .env que `yarn dev`):
 *   yarn seed:wc2026
 * Com palpites no banco, exige confirmação explícita:
 *   yarn seed:wc2026 -- --force
 * Bandeiras opcionais (HTTPS + plugin Upload):
 *   yarn seed:wc2026:flags
 *   yarn seed:wc2026 -- --flags --flags-force
 *
 * Se `strapi.load()` falhar ao carregar o sharp do plugin upload (libvips dylib),
 * reinstale deps: `rm -rf node_modules && yarn install`
 */
import type { Core } from '@strapi/strapi';
import * as core from '@strapi/core';

import { seedWorldCup2026, seedWorldCup2026Flags } from '../bootstrap/wc2026-seed';

async function hasExistingBets(strapi: Core.Strapi): Promise<boolean> {
  const bets = await strapi.documents('api::bet.bet').findMany({ limit: 1 });
  return bets.length > 0;
}

function parseArgv() {
  const argv = process.argv.slice(2);
  return {
    force: argv.includes('--force'),
    flags: argv.includes('--flags'),
    flagsForce: argv.includes('--flags-force'),
  };
}

async function main() {
  const { force, flags, flagsForce } = parseArgv();

  console.log('[seed-wc2026] Compilando projeto Strapi…');
  const appContext = await core.compileStrapi();

  console.log('[seed-wc2026] Conectando ao banco…');
  const app = await core.createStrapi(appContext).load();

  try {
    if ((await hasExistingBets(app)) && !force) {
      console.error(
        '[seed-wc2026] Abortado: já existem palpites no banco. Use --force se realmente precisar re-sincronizar fixtures.'
      );
      process.exit(1);
    }

    console.log('[seed-wc2026] Inserindo/atualizando seleções e partidas…');
    await seedWorldCup2026(app);

    if (flags || flagsForce) {
      console.log('[seed-wc2026] Bandeiras (HTTP + biblioteca upload)…');
      await seedWorldCup2026Flags(app, { force: flagsForce });
    } else {
      console.log('[seed-wc2026] (Pule `--flags` se quiser importar ícones; exige rede.)');
    }

    console.log('[seed-wc2026] Concluído.');
  } finally {
    await app.destroy().catch((err: unknown) => {
      console.error('[seed-wc2026] destroy:', err);
    });
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('[seed-wc2026]', err);
  process.exit(1);
});
