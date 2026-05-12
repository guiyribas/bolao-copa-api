import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getDisplayNameFromGoogleClaims,
  getEmailFromGoogleIdToken,
  getGoogleOAuthToken,
  getGoogleProfileFromIdToken,
  GOOGLE_ONLY_LOGIN_MESSAGE,
  isGoogleOnlyUser,
  resolveGoogleConnectUser,
} from './users-permissions-auth';

describe('isGoogleOnlyUser', () => {
  it('treats Google provider accounts as Google-only', () => {
    assert.equal(isGoogleOnlyUser({ provider: 'google' }), true);
  });

  it('treats local accounts without a password as Google-only', () => {
    assert.equal(isGoogleOnlyUser({ provider: 'local', password: null }), true);
  });

  it('allows local accounts with a password to use email login', () => {
    assert.equal(isGoogleOnlyUser({ provider: 'local', password: 'hashed' }), false);
  });
});

describe('resolveGoogleConnectUser', () => {
  it('reuses the Google account when one already exists', () => {
    const users = [
      { id: 1, provider: 'local', email: 'a@example.com' },
      { id: 2, provider: 'google', email: 'a@example.com' },
    ];

    assert.equal(resolveGoogleConnectUser(users)?.id, 2);
  });

  it('links Google sign-in to an existing local account with the same email', () => {
    const users = [{ id: 1, provider: 'local', email: 'a@example.com' }];

    assert.equal(resolveGoogleConnectUser(users)?.id, 1);
  });

  it('returns null when no matching account exists', () => {
    assert.equal(resolveGoogleConnectUser([]), null);
  });
});

describe('GOOGLE_ONLY_LOGIN_MESSAGE', () => {
  it('uses the product copy for Google-only password attempts', () => {
    assert.match(GOOGLE_ONLY_LOGIN_MESSAGE, /Google Sign-In/);
  });
});

describe('getGoogleOAuthToken', () => {
  it('falls back to id_token when access_token is missing', () => {
    assert.equal(
      getGoogleOAuthToken({ id_token: 'google-id-token' }),
      'google-id-token'
    );
  });
});

describe('getEmailFromGoogleIdToken', () => {
  it('reads the email claim from a JWT payload', () => {
    const payload = Buffer.from(
      JSON.stringify({ email: 'user@example.com' })
    ).toString('base64url');
    const idToken = `header.${payload}.signature`;

    assert.equal(getEmailFromGoogleIdToken(idToken), 'user@example.com');
  });
});

describe('getDisplayNameFromGoogleClaims', () => {
  it('prefers the Google display name over the email prefix', () => {
    assert.equal(
      getDisplayNameFromGoogleClaims({
        name: 'João',
        email: 'joazinhoooooo@gmail.com',
      }),
      'João'
    );
  });

  it('falls back to given_name when name is missing', () => {
    assert.equal(
      getDisplayNameFromGoogleClaims({
        given_name: 'Maria',
        email: 'maria.silva@gmail.com',
      }),
      'Maria'
    );
  });
});

describe('getGoogleProfileFromIdToken', () => {
  it('builds a profile from id_token claims', () => {
    const payload = Buffer.from(
      JSON.stringify({
        email: 'joazinhoooooo@gmail.com',
        name: 'João',
      })
    ).toString('base64url');
    const idToken = `header.${payload}.signature`;

    assert.deepEqual(getGoogleProfileFromIdToken(idToken), {
      email: 'joazinhoooooo@gmail.com',
      username: 'João',
    });
  });
});
