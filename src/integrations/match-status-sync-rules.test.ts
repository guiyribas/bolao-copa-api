import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveSyncedMatchStatus } from './match-status-sync-rules';

describe('resolveSyncedMatchStatus', () => {
  it('mantém live quando remoto tenta regredir para scheduled', () => {
    assert.equal(resolveSyncedMatchStatus('live', 'scheduled'), 'live');
  });

  it('permite live avançar para finished', () => {
    assert.equal(resolveSyncedMatchStatus('live', 'finished'), 'finished');
  });

  it('permite scheduled avançar para live', () => {
    assert.equal(resolveSyncedMatchStatus('scheduled', 'live'), 'live');
  });

  it('nunca regride finished', () => {
    assert.equal(resolveSyncedMatchStatus('finished', 'scheduled'), 'finished');
    assert.equal(resolveSyncedMatchStatus('finished', 'live'), 'finished');
  });

  it('trata status local ausente como scheduled', () => {
    assert.equal(resolveSyncedMatchStatus(null, 'live'), 'live');
    assert.equal(resolveSyncedMatchStatus(undefined, 'scheduled'), 'scheduled');
  });
});
