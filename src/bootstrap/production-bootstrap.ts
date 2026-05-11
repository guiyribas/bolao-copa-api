import type { Core } from '@strapi/strapi';

import { bootstrapUsersPermissions } from './users-permissions-bootstrap';
import { seedWorldCup2026, seedWorldCup2026Flags } from './wc2026-seed';

/** WC2026 fixtures, flags, and Users & Permissions allowlist for a fresh production database. */
export async function runProductionBootstrap(strapi: Core.Strapi): Promise<void> {
  strapi.log.info('Production bootstrap: WC2026 fixtures…');
  await seedWorldCup2026(strapi);

  strapi.log.info('Production bootstrap: team flags…');
  try {
    await seedWorldCup2026Flags(strapi);
  } catch (error) {
    strapi.log.error('Production bootstrap: flag import failed (continuing).', error);
  }

  strapi.log.info('Production bootstrap: Users & Permissions…');
  await bootstrapUsersPermissions(strapi);

  strapi.log.info('Production bootstrap finished.');
}
