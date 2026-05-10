import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { assertMatchAcceptsBet, assertUserIsBetOwner } from './bet-guards';

describe('assertMatchAcceptsBet', () => {
  const futureKickoff = '2099-06-01T18:00:00.000Z';
  const nowBefore = new Date('2099-06-01T17:59:59.999Z');
  const nowAtKickoff = new Date('2099-06-01T18:00:00.000Z');
  const nowAfter = new Date('2099-06-01T18:00:00.001Z');

  it('permite antes do horário de início quando status não bloqueia', () => {
    const r = assertMatchAcceptsBet({ date: futureKickoff, matchStatus: null }, nowBefore);
    assert.equal(r.ok, true);
  });

  it('bloqueia no instante do apito (hora de início <= agora)', () => {
    const r = assertMatchAcceptsBet({ date: futureKickoff, matchStatus: null }, nowAtKickoff);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.message, /início/);
  });

  it('bloqueia após o horário de início', () => {
    const r = assertMatchAcceptsBet({ date: futureKickoff, matchStatus: null }, nowAfter);
    assert.equal(r.ok, false);
  });

  it('prioriza bloqueio por jogo finalizado', () => {
    const r = assertMatchAcceptsBet(
      { date: futureKickoff, matchStatus: 'finished' },
      nowBefore
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.message, /finalizado/);
  });

  it('bloqueia com jogo ao vivo mesmo antes da data gravada (cenário estranho mas defensivo)', () => {
    const r = assertMatchAcceptsBet(
      { date: futureKickoff, matchStatus: 'live' },
      nowBefore
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.message, /andamento/);
  });

  it('rejeita partida sem data', () => {
    const r = assertMatchAcceptsBet({ date: null, matchStatus: null }, nowBefore);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.message, /data/);
  });

  it('rejeita data inválida', () => {
    const r = assertMatchAcceptsBet({ date: 'não é data', matchStatus: null }, nowBefore);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.message, /inválida/);
  });

  it('aceita objeto Date como data da partida', () => {
    const kickDate = new Date(futureKickoff);
    const r = assertMatchAcceptsBet({ date: kickDate, matchStatus: 'scheduled' }, nowBefore);
    assert.equal(r.ok, true);
  });
});

describe('assertUserIsBetOwner', () => {
  it('aceita mesmo utilizador com tipos diferentes (number vs string)', () => {
    assert.equal(assertUserIsBetOwner(7, '7').ok, true);
    assert.equal(assertUserIsBetOwner('42', 42).ok, true);
  });

  it('rejeita quando dono é undefined ou diferente', () => {
    const r = assertUserIsBetOwner(1, 2);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.message, 'You can only update your own bets');

    assert.equal(assertUserIsBetOwner(1, undefined).ok, false);
    assert.equal(assertUserIsBetOwner(1, null).ok, false);
  });
});
