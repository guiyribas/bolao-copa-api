import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mapWorldCup26Status, toWorldCup26Update } from './worldcup26';

describe('mapWorldCup26Status', () => {
  it('mapeia estados agendado, ao vivo e finalizado', () => {
    assert.equal(
      mapWorldCup26Status({ finished: 'FALSE', time_elapsed: 'notstarted' }),
      'scheduled'
    );
    assert.equal(
      mapWorldCup26Status({ finished: 'FALSE', time_elapsed: '45' }),
      'live'
    );
    assert.equal(
      mapWorldCup26Status({ finished: 'TRUE', time_elapsed: '90' }),
      'finished'
    );
  });
});

describe('toWorldCup26Update', () => {
  it('normaliza partida em andamento', () => {
    assert.deepEqual(
      toWorldCup26Update({
        id: '7',
        home_score: '2',
        away_score: '1',
        finished: 'FALSE',
        time_elapsed: '55',
      }),
      { matchNumber: 7, homeScore: 2, awayScore: 1, matchStatus: 'live' }
    );
  });

  it('não aplica o 0-0 placeholder antes do jogo', () => {
    assert.deepEqual(
      toWorldCup26Update({
        id: '7',
        home_score: '0',
        away_score: '0',
        finished: 'FALSE',
        time_elapsed: 'notstarted',
      }),
      {
        matchNumber: 7,
        homeScore: null,
        awayScore: null,
        matchStatus: 'scheduled',
      }
    );
  });
});
