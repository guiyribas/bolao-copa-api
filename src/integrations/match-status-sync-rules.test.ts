import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  resolveSyncedMatchStatus,
  shouldApplyRemoteScores,
} from './match-status-sync-rules';

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

describe('shouldApplyRemoteScores', () => {
  it('não aplica placar remoto quando local já está finished', () => {
    assert.equal(shouldApplyRemoteScores('finished'), false);
  });

  it('aplica placar remoto quando local está scheduled ou live', () => {
    assert.equal(shouldApplyRemoteScores('scheduled'), true);
    assert.equal(shouldApplyRemoteScores('live'), true);
  });

  it('trata status local ausente como scheduled', () => {
    assert.equal(shouldApplyRemoteScores(null), true);
    assert.equal(shouldApplyRemoteScores(undefined), true);
  });
});
