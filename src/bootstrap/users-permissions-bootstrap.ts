import type { Core } from '@strapi/strapi';

const PUBLIC_ACTIONS = [
  'api::pool.pool.find',
  'api::match.match.find',
  'api::team.team.find',
  'api::bet.custom-bet.publicBetsByUsername',
  'plugin::upload.content-api.find',
  'plugin::upload.content-api.findOne',
  'plugin::users-permissions.auth.forgotPassword',
  'plugin::users-permissions.auth.resetPassword',
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

async function ensureResetPasswordUrl(strapi: Core.Strapi): Promise<void> {
  const pluginStore = strapi.store({ type: 'plugin', name: 'users-permissions' });
  const advanced = (await pluginStore.get({ key: 'advanced' })) as
    | { email_reset_password?: string | null }
    | null
    | undefined;
  const current = advanced?.email_reset_password?.trim();

  if (current) {
    return;
  }

  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  const resetUrl = `${frontendUrl}/reset-password`;

  await pluginStore.set({
    key: 'advanced',
    value: {
      ...(advanced ?? {}),
      email_reset_password: resetUrl,
    },
  });

  strapi.log.info(`Users & Permissions: reset password page set to ${resetUrl}.`);
}

export async function ensureGoogleFrontendRedirect(strapi: Core.Strapi): Promise<void> {
  const pluginStore = strapi.store({ type: 'plugin', name: 'users-permissions' });
  const grant = (await pluginStore.get({ key: 'grant' })) as
    | ({ google?: { callback?: string | null; scope?: string[] } } & Record<string, unknown>)
    | null
    | undefined;
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  const redirectUrl = `${frontendUrl}/connect/google/redirect`;
  const current = grant?.google?.callback?.trim();
  const currentScope = grant?.google?.scope ?? [];
  const desiredScope = ['email', 'profile'];
  const scopeMatches =
    desiredScope.length === currentScope.length &&
    desiredScope.every((scope) => currentScope.includes(scope));

  if (current === redirectUrl && scopeMatches) {
    return;
  }

  await pluginStore.set({
    key: 'grant',
    value: {
      ...(grant ?? {}),
      google: {
        ...(grant?.google ?? {}),
        callback: redirectUrl,
        scope: desiredScope,
      },
    },
  });

  strapi.log.info(`Users & Permissions: Google front-end redirect set to ${redirectUrl}.`);
}

/** Idempotent allowlist for Public and Authenticated roles (README + custom routes). */
export async function bootstrapUsersPermissions(strapi: Core.Strapi): Promise<void> {
  const usersPermissions = strapi.plugin('users-permissions').service('users-permissions');
  await usersPermissions.syncPermissions();

  await ensureResetPasswordUrl(strapi);
  await ensureGoogleFrontendRedirect(strapi);
  await ensureRolePermissions(strapi, 'public', PUBLIC_ACTIONS);
  await ensureRolePermissions(strapi, 'authenticated', AUTHENTICATED_ACTIONS);
}
