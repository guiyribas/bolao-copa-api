import crypto from 'node:crypto';

import type { Core } from '@strapi/strapi';

export const GOOGLE_ONLY_LOGIN_MESSAGE =
  'This account uses Google Sign-In. Please use the Google button to log in.';

export type UpUser = {
  provider?: string | null;
  password?: string | null;
};

export function isGoogleOnlyUser(user: UpUser): boolean {
  const provider = user.provider?.toLowerCase() ?? '';
  if (provider === 'google') {
    return true;
  }
  if (provider !== 'local') {
    return true;
  }
  return !user.password;
}

export function resolveGoogleConnectUser<T extends UpUser>(users: T[]): T | null {
  const byProvider = (provider: string) =>
    users.find((user) => (user.provider ?? '').toLowerCase() === provider);

  return byProvider('google') ?? byProvider('local') ?? null;
}

export function getGoogleOAuthToken(query: Record<string, unknown>): string | null {
  const token =
    query.access_token ?? query.code ?? query.oauth_token ?? query.id_token;
  return token == null ? null : String(token);
}

export type GoogleProfile = {
  email: string;
  username: string;
};

type GoogleIdentityClaims = {
  email?: unknown;
  name?: unknown;
  given_name?: unknown;
};

function decodeGoogleIdTokenPayload(idToken: string): GoogleIdentityClaims | null {
  const parts = idToken.split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    return JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8')
    ) as GoogleIdentityClaims;
  } catch {
    return null;
  }
}

export function getDisplayNameFromGoogleClaims(claims: GoogleIdentityClaims): string | null {
  if (typeof claims.name === 'string' && claims.name.trim()) {
    return claims.name.trim();
  }
  if (typeof claims.given_name === 'string' && claims.given_name.trim()) {
    return claims.given_name.trim();
  }
  if (typeof claims.email === 'string' && claims.email.includes('@')) {
    return claims.email.split('@')[0];
  }
  return null;
}

export function getGoogleProfileFromIdToken(idToken: string): GoogleProfile | null {
  const claims = decodeGoogleIdTokenPayload(idToken);
  if (!claims) {
    return null;
  }

  const email =
    typeof claims.email === 'string' ? claims.email.toLowerCase() : null;
  const username = getDisplayNameFromGoogleClaims(claims);
  if (!email || !username) {
    return null;
  }

  return { email, username };
}

export function getEmailFromGoogleIdToken(idToken: string): string | null {
  return getGoogleProfileFromIdToken(idToken)?.email ?? null;
}

export async function fetchGoogleProfileFromAccessToken(
  accessToken: string
): Promise<GoogleProfile> {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Email was not available.');
  }

  const body = (await response.json()) as GoogleIdentityClaims;
  const email =
    typeof body.email === 'string' ? body.email.toLowerCase() : null;
  const username = getDisplayNameFromGoogleClaims(body);

  if (!email || !username) {
    throw new Error('Email was not available.');
  }

  return { email, username };
}

const MAX_USERNAME_ATTEMPTS = 10;

export async function findValidUsername(
  strapi: Core.Strapi,
  basename: string
): Promise<string> {
  const minLength =
    strapi.getModel('plugin::users-permissions.user')?.attributes?.username?.minLength ?? 3;
  const tryBasenameFirst = basename.length >= minLength;

  let attempt = 0;
  let candidate = basename;
  let taken = true;

  do {
    candidate =
      attempt === 0 && tryBasenameFirst ? basename : `${basename}${crypto.randomInt(1000, 9999)}`;
    const existing = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { username: candidate },
    });
    taken = Boolean(existing);
    attempt += 1;
  } while (taken && attempt <= MAX_USERNAME_ATTEMPTS);

  return taken ? crypto.randomUUID() : candidate;
}
