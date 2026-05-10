import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import createBetController from './bet';

describe('Bet controller — prazo e dono do palpite', () => {
  const futureKickoff = '2099-06-15T20:00:00.000Z';
  const futureMatch = {
    date: futureKickoff,
    matchStatus: 'scheduled',
  };

  function makeCtx(opts: {
    user: { id: number } | null;
    body: { data?: Record<string, unknown> };
    params?: Record<string, string>;
  }) {
    const outcomes: unknown[] = [];
    const ctx = {
      state: { user: opts.user },
      request: { body: opts.body },
      params: opts.params ?? {},
      unauthorized(msg?: string) {
        outcomes.push(['unauthorized', msg]);
      },
      badRequest(msg?: string) {
        outcomes.push(['badRequest', msg]);
      },
      notFound(msg?: string) {
        outcomes.push(['notFound', msg]);
      },
      forbidden(msg?: string) {
        outcomes.push(['forbidden', msg]);
      },
      send(body: unknown) {
        outcomes.push(['send', body]);
      },
    };
    return { ctx, outcomes };
  }

  function docsMock(handlers: {
    matchFindOne?: (args: { documentId?: string }) => Promise<unknown>;
    betFindMany?: (args: unknown) => Promise<unknown[]>;
    betCreate?: (args: { data: Record<string, unknown>; documentId?: string }) => Promise<unknown>;
    betUpdate?: (args: { data: Record<string, unknown>; documentId?: string }) => Promise<unknown>;
    betFindOne?: (args: { documentId?: string; populate?: string[] }) => Promise<unknown>;
  }) {
    return (uid: string) => {
      if (uid === 'api::match.match') {
        return {
          findOne: handlers.matchFindOne ?? (async () => null),
        };
      }
      if (uid === 'api::bet.bet') {
        return {
          findMany: handlers.betFindMany ?? (async () => []),
          create: handlers.betCreate ?? (async () => ({})),
          update:
            handlers.betUpdate ??
            (async (args: { documentId?: string; data?: unknown }) => ({
              documentId: args.documentId,
              ...((args.data as object) ?? {}),
            })),
          findOne: handlers.betFindOne ?? (async () => null),
        };
      }
      throw new Error(`documents mock: unexpected uid ${uid}`);
    };
  }

  it('create: badRequest quando o horário de início da partida já passou', async () => {
    const passedKickoff = '2000-01-01T12:00:00.000Z';
    const { ctx, outcomes } = makeCtx({
      user: { id: 1 },
      body: {
        data: { match: 'match-uuid', homeScore: 1, awayScore: 1 },
      },
    });
    const strapi = {
      contentType: () => ({}),
      documents: docsMock({
        matchFindOne: async () => ({ date: passedKickoff, matchStatus: 'scheduled' }),
      }),
    };

    const controller = createBetController({ strapi: strapi as any });
    await controller.create(ctx as never);

    assert.deepEqual(outcomes[0]?.[0], 'badRequest');
    const msg = String(outcomes[0]?.[1] ?? '');
    assert.match(msg, /início/);
  });

  it('create: após deadline não chama create no document service', async () => {
    let createCalls = 0;
    const { ctx, outcomes } = makeCtx({
      user: { id: 1 },
      body: {
        data: { match: 'm1', homeScore: 0, awayScore: 0 },
      },
    });
    const strapi = {
      contentType: () => ({}),
      documents: docsMock({
        matchFindOne: async () => ({ date: '2010-01-01T00:00:00.000Z', matchStatus: 'scheduled' }),
        betFindMany: async () => [],
        betCreate: async () => {
          createCalls++;
          return {};
        },
      }),
    };

    const controller = createBetController({ strapi: strapi as any });
    await controller.create(ctx as never);

    assert.equal(createCalls, 0);
    assert.deepEqual(outcomes[0]?.[0], 'badRequest');
  });

  it('create: sucesso associa sempre o utilizador da sessão (ignora user no body)', async () => {
    let persisted: Record<string, unknown> | null = null;

    const { ctx, outcomes } = makeCtx({
      user: { id: 100 },
      body: {
        data: {
          match: 'm-future',
          homeScore: 2,
          awayScore: 0,
          user: 999,
        },
      },
    });

    const strapi = {
      contentType: () => ({}),
      documents: docsMock({
        matchFindOne: async () => futureMatch,
        betFindMany: async () => [],
        betCreate: async ({ data }: { data: Record<string, unknown> }) => {
          persisted = { ...data };
          return { data };
        },
      }),
    };

    const controller = createBetController({ strapi: strapi as any });
    await controller.create(ctx as never);

    assert.deepEqual(outcomes[0]?.[0], 'send');
    assert.equal(persisted?.user, 100);
    assert.notEqual((persisted as { user?: number })?.user, 999);
    assert.equal(persisted?.match, 'm-future');
  });

  it('create: reutiliza update se já existe palpite (mesmo user + match)', async () => {
    let updateArgs: { documentId?: string; data?: Record<string, unknown> } | null = null;

    const { ctx, outcomes } = makeCtx({
      user: { id: 3 },
      body: { data: { match: 'm1', homeScore: 1, awayScore: 1 } },
    });

    const strapi = {
      contentType: () => ({}),
      documents: docsMock({
        matchFindOne: async () => futureMatch,
        betFindMany: async () => [{ documentId: 'bet-existing' }] as unknown[],
        betUpdate: async (args) => {
          updateArgs = args;
          return { ok: true };
        },
      }),
    };

    const controller = createBetController({ strapi: strapi as any });
    await controller.create(ctx as never);

    assert.deepEqual(outcomes[0]?.[0], 'send');
    assert.equal(updateArgs?.documentId, 'bet-existing');
    assert.deepEqual(updateArgs?.data, { homeScore: 1, awayScore: 1 });
  });

  it('update: forbidden se o palpite não é do utilizador autenticado', async () => {
    const { ctx, outcomes } = makeCtx({
      user: { id: 1 },
      body: { data: { homeScore: 2, awayScore: 2 } },
      params: { documentId: 'bet-other' },
    });

    const strapi = {
      contentType: () => ({}),
      documents: docsMock({
        betFindOne: async () => ({
          documentId: 'bet-other',
          user: { id: 999 },
          homeScore: 0,
          awayScore: 0,
          match: { date: futureKickoff, matchStatus: 'scheduled' },
        }),
      }),
    };

    const controller = createBetController({ strapi: strapi as any });
    await controller.update(ctx as never);

    assert.deepEqual(outcomes[0]?.[0], 'forbidden');
  });

  it('update: badRequest quando a partida já começou', async () => {
    let updateCalls = 0;

    const { ctx, outcomes } = makeCtx({
      user: { id: 2 },
      body: { data: { homeScore: 1, awayScore: 0 } },
      params: { documentId: 'bet-mine' },
    });

    const strapi = {
      contentType: () => ({}),
      documents: docsMock({
        betFindOne: async () => ({
          documentId: 'bet-mine',
          user: { id: 2 },
          homeScore: 0,
          awayScore: 0,
          match: {
            date: '2001-03-03T18:00:00.000Z',
            matchStatus: 'scheduled',
          },
        }),
        betUpdate: async () => {
          updateCalls++;
          return {};
        },
      }),
    };

    const controller = createBetController({ strapi: strapi as any });
    await controller.update(ctx as never);

    assert.equal(updateCalls, 0);
    assert.deepEqual(outcomes[0]?.[0], 'badRequest');
  });

  it('update: sucesso apenas para dono e partida futura', async () => {
    let updateCalls = 0;
    let lastData: Record<string, unknown> | undefined;

    const { ctx, outcomes } = makeCtx({
      user: { id: 5 },
      body: { data: { homeScore: 3, awayScore: 1 } },
      params: { documentId: 'own-bet' },
    });

    const strapi = {
      contentType: () => ({}),
      documents: docsMock({
        betFindOne: async () => ({
          documentId: 'own-bet',
          user: { id: 5 },
          homeScore: 1,
          awayScore: 1,
          match: futureMatch,
        }),
        betUpdate: async ({ data }: { data: Record<string, unknown> }) => {
          updateCalls++;
          lastData = data;
          return { merged: true };
        },
      }),
    };

    const controller = createBetController({ strapi: strapi as any });
    await controller.update(ctx as never);

    assert.equal(updateCalls, 1);
    assert.deepEqual(outcomes[0]?.[0], 'send');
    assert.deepEqual(lastData, { homeScore: 3, awayScore: 1 });
  });
});
