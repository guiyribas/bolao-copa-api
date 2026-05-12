import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';

import {
  fetchGoogleProfileFromAccessToken,
  findValidUsername,
  getGoogleOAuthToken,
  getGoogleProfileFromIdToken,
  GOOGLE_ONLY_LOGIN_MESSAGE,
  isGoogleOnlyUser,
  resolveGoogleConnectUser,
  type GoogleProfile,
} from '../../auth/users-permissions-auth';

const { ValidationError } = errors;

type AuthController = (args: { strapi: Core.Strapi }) => Record<string, unknown>;
type ProvidersService = (args: { strapi: Core.Strapi }) => {
  connect: (provider: string, query: Record<string, unknown>) => Promise<unknown>;
  buildRedirectUri: (provider?: string) => string;
};

async function resolveGoogleProfile(
  query: Record<string, unknown>
): Promise<GoogleProfile> {
  const oauthToken = getGoogleOAuthToken(query);
  if (!oauthToken) {
    throw new Error('No access_token.');
  }

  if (query.access_token || query.code || query.oauth_token) {
    return fetchGoogleProfileFromAccessToken(oauthToken);
  }

  const profile = getGoogleProfileFromIdToken(oauthToken);
  if (!profile) {
    throw new Error('Email was not available.');
  }

  return profile;
}

export default (plugin: {
  controllers: { auth: AuthController };
  services: { providers: ProvidersService };
}) => {
  const originalAuthFactory = plugin.controllers.auth;
  const originalProvidersFactory = plugin.services.providers;

  plugin.services.providers = ({ strapi }: { strapi: Core.Strapi }) => {
    const original = originalProvidersFactory({ strapi });

    return {
      ...original,
      async connect(provider: string, query: Record<string, unknown>) {
        if (provider !== 'google') {
          return original.connect(provider, query);
        }

        const profile = await resolveGoogleProfile(query);
        const email = profile.email;
        const users = await strapi.db.query('plugin::users-permissions.user').findMany({
          where: { email },
        });
        const linkedUser = resolveGoogleConnectUser(users);
        if (linkedUser) {
          return linkedUser;
        }

        const pluginStore = strapi.store({ type: 'plugin', name: 'users-permissions' });
        const advancedSettings = (await pluginStore.get({ key: 'advanced' })) as {
          allow_register?: boolean;
          unique_email?: boolean;
          default_role?: string;
        };

        if (!advancedSettings.allow_register) {
          throw new Error('Register action is actually not available.');
        }

        if (users.length && advancedSettings.unique_email) {
          throw new Error('Email is already taken.');
        }

        const defaultRole = await strapi.db
          .query('plugin::users-permissions.role')
          .findOne({ where: { type: advancedSettings.default_role } });
        const username = await findValidUsername(strapi, profile.username);

        return strapi.db.query('plugin::users-permissions.user').create({
          data: {
            username,
            email,
            provider: 'google',
            role: defaultRole.id,
            confirmed: true,
          },
        });
      },
    };
  };

  plugin.controllers.auth = ({ strapi }: { strapi: Core.Strapi }) => {
    const original = originalAuthFactory({ strapi }) as {
      callback: (ctx: {
        params: { provider?: string };
        request: { body?: { identifier?: string } };
      }) => Promise<unknown>;
    };

    return {
      ...original,
      async callback(ctx: {
        params: { provider?: string };
        request: { body?: { identifier?: string } };
      }) {
        const provider = ctx.params.provider || 'local';
        if (provider === 'local') {
          const identifier = String(ctx.request.body?.identifier ?? '').toLowerCase();
          if (identifier) {
            const existing = await strapi.db.query('plugin::users-permissions.user').findOne({
              where: {
                $or: [{ email: identifier }, { username: identifier }],
              },
            });

            if (existing && isGoogleOnlyUser(existing)) {
              throw new ValidationError(GOOGLE_ONLY_LOGIN_MESSAGE);
            }
          }
        }

        return original.callback(ctx);
      },
    };
  };

  return plugin;
};
