import type { Core } from '@strapi/strapi';

const PUBLIC_ACTIONS = [
  'api::pool.pool.find',
  'api::match.match.find',
  'api::team.team.find',
  'api::bet.custom-bet.publicBetsByUsername',
  'plugin::upload.content-api.find',
  'plugin::upload.content-api.findOne',
] as const;

const AUTHENTICATED_ACTIONS = [
  'api::match.match.find',
  'api::team.team.find',
  'api::pool.pool.find',
  'api::pool-membership.pool-membership.find',
  'api::bet.bet.create',
  'api::pool.custom-pool.join',
  'api::pool.custom-pool.myMemberships',
  'api::pool.custom-pool.poolSession',
  'api::pool.custom-pool.members',
  'api::pool.custom-pool.updatePayment',
  'api::pool.custom-pool.updatePoolSettings',
  'api::pool.custom-pool.ranking',
  'api::pool.custom-pool.poolMatchBets',
  'api::bet.custom-bet.myBets',
  'api::bet.group-simulation.simulate',
] as const;

async function ensurePermission(
  strapi: Core.Strapi,
  roleId: number,
  action: string
): Promise<boolean> {
  const existing = await strapi.db.query('plugin::users-permissions.permission').findOne({
    where: {
      action,
      role: { id: roleId },
    },
  });

  if (existing) {
    return false;
  }

  await strapi.db.query('plugin::users-permissions.permission').create({
    data: {
      action,
      role: roleId,
    },
  });

  return true;
}

async function ensureRolePermissions(
  strapi: Core.Strapi,
  roleType: string,
  actions: readonly string[]
): Promise<number> {
  const role = await strapi.db.query('plugin::users-permissions.role').findOne({
    where: { type: roleType },
  });

  if (!role) {
    throw new Error(`Users & Permissions role not found: ${roleType}`);
  }

  let created = 0;
  for (const action of actions) {
    if (await ensurePermission(strapi, role.id, action)) {
      created += 1;
    }
  }

  strapi.log.info(
    `Users & Permissions (${roleType}): ensured ${actions.length} actions (${created} created).`
  );

  return created;
}

/** Idempotent allowlist for Public and Authenticated roles (README + custom routes). */
export async function bootstrapUsersPermissions(strapi: Core.Strapi): Promise<void> {
  const usersPermissions = strapi.plugin('users-permissions').service('users-permissions');
  await usersPermissions.syncPermissions();

  await ensureRolePermissions(strapi, 'public', PUBLIC_ACTIONS);
  await ensureRolePermissions(strapi, 'authenticated', AUTHENTICATED_ACTIONS);
}
