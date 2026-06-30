import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildUpdateData, mapFootballDataStatus, toMatchUpdate } from './football-data';

describe('mapFootballDataStatus', () => {
  it('mapeia estados em andamento para live', () => {
    assert.equal(mapFootballDataStatus('IN_PLAY'), 'live');
    assert.equal(mapFootballDataStatus('PAUSED'), 'live');
  });

  it('mapeia estados encerrados para finished', () => {
    assert.equal(mapFootballDataStatus('FINISHED'), 'finished');
    assert.equal(mapFootballDataStatus('AWARDED'), 'finished');
  });

  it('mantém outros estados como scheduled', () => {
    for (const status of [
      'SCHEDULED',
      'TIMED',
      'POSTPONED',
      'SUSPENDED',
      'CANCELLED',
      undefined,
    ]) {
      assert.equal(mapFootballDataStatus(status), 'scheduled');
    }
  });
});

describe('toMatchUpdate', () => {
  it('normaliza partida válida', () => {
    assert.deepEqual(
      toMatchUpdate({
        id: 123,
        utcDate: '2026-06-11T19:00:00Z',
        status: 'FINISHED',
        homeTeam: { tla: 'MEX' },
        awayTeam: { tla: 'RSA' },
        score: { fullTime: { home: 2, away: 1 } },
      }),
      {
        externalId: '123',
        date: '2026-06-11T19:00:00Z',
        homeCode: 'MEX',
        awayCode: 'RSA',
        homeScore: 2,
        awayScore: 1,
        matchStatus: 'finished',
      }
    );
  });

  it('ignora partida sem id ou data válida', () => {
    assert.equal(toMatchUpdate({ utcDate: '2026-06-11T19:00:00Z' }), null);
    assert.equal(toMatchUpdate({ id: 123, utcDate: 'inválida' }), null);
  });

  it('normaliza códigos divergentes do provedor', () => {
    const match = toMatchUpdate({
      id: 123,
      utcDate: '2026-06-27T00:00:00Z',
      homeTeam: { tla: 'URY' },
      awayTeam: { tla: 'ESP' },
    });

    assert.equal(match?.homeCode, 'URU');
    assert.equal(match?.awayCode, 'ESP');
  });

  it('remove os gols da disputa por pênaltis do placar usado pelo bolão', () => {
    const match = toMatchUpdate({
      id: 123,
      utcDate: '2026-07-19T19:00:00Z',
      status: 'FINISHED',
      score: {
        duration: 'PENALTY_SHOOTOUT',
        fullTime: { home: 7, away: 6 },
        penalties: { home: 6, away: 5 },
      },
    });

    assert.equal(match?.homeScore, 1);
    assert.equal(match?.awayScore, 1);
  });
});

describe('buildUpdateData', () => {
  const remote = {
    externalId: '123',
    date: '2026-06-27T00:00:00Z',
    homeCode: 'PAR',
    awayCode: 'GER',
    homeScore: 1,
    awayScore: 0,
    matchStatus: 'finished' as const,
  };

  it('não sobrescreve placar quando local já está finished', () => {
    const data = buildUpdateData(
      {
        documentId: 'doc-1',
        externalId: '123',
        homeScore: 1,
        awayScore: 1,
        matchStatus: 'finished',
      },
      remote
    );

    assert.deepEqual(data, {});
  });

  it('aplica placar ao transicionar de live para finished', () => {
    const data = buildUpdateData(
      {
        documentId: 'doc-1',
        externalId: '123',
        homeScore: 0,
        awayScore: null,
        matchStatus: 'live',
      },
      remote
    );

    assert.deepEqual(data, {
      matchStatus: 'finished',
      homeScore: 1,
      awayScore: 0,
    });
  });
});
