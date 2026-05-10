import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { calculatePoints, isExactScorePoints } from './scoring';

describe('calculatePoints', () => {
  const group = { phase: 'group' as const };
  const ko = { phase: 'quarter' as const };

  it('placar exato — grupos', () => {
    assert.equal(
      calculatePoints({ homeScore: 2, awayScore: 2 }, { ...group, homeScore: 2, awayScore: 2 }),
      10
    );
  });

  it('placar exato — mata-mata', () => {
    assert.equal(
      calculatePoints({ homeScore: 1, awayScore: 0 }, { ...ko, homeScore: 1, awayScore: 0 }),
      15
    );
  });

  it('acertou empate — grupos', () => {
    assert.equal(
      calculatePoints({ homeScore: 2, awayScore: 2 }, { ...group, homeScore: 1, awayScore: 1 }),
      6
    );
  });

  it('vencedor errado — 0 pts', () => {
    assert.equal(
      calculatePoints({ homeScore: 2, awayScore: 1 }, { ...group, homeScore: 1, awayScore: 2 }),
      0
    );
  });

  it('vencedor + gols do vencedor — grupos (ex. 2×1 vs 2×0)', () => {
    assert.equal(
      calculatePoints({ homeScore: 2, awayScore: 1 }, { ...group, homeScore: 2, awayScore: 0 }),
      8
    );
  });

  it('vencedor + saldo — grupos (ex. 3×2 vs 2×1)', () => {
    assert.equal(
      calculatePoints({ homeScore: 3, awayScore: 2 }, { ...group, homeScore: 2, awayScore: 1 }),
      7
    );
  });

  it('vencedor + gols do perdedor — grupos (ex. 3×1 vs 2×1)', () => {
    assert.equal(
      calculatePoints({ homeScore: 3, awayScore: 1 }, { ...group, homeScore: 2, awayScore: 1 }),
      5
    );
  });

  it('apenas vencedor — grupos', () => {
    assert.equal(
      calculatePoints({ homeScore: 2, awayScore: 0 }, { ...group, homeScore: 4, awayScore: 1 }),
      3
    );
  });

  it('placar exato 0×0 — grupos', () => {
    assert.equal(
      calculatePoints({ homeScore: 0, awayScore: 0 }, { ...group, homeScore: 0, awayScore: 0 }),
      10
    );
  });

  it('acertou empate 0×0 — placar diferente — grupos', () => {
    assert.equal(
      calculatePoints({ homeScore: 0, awayScore: 0 }, { ...group, homeScore: 1, awayScore: 1 }),
      6
    );
  });

  it('fase desconhecida usa pontuação de grupos', () => {
    const unknownPhase = { phase: 'friendly' as const };
    assert.equal(
      calculatePoints({ homeScore: 2, awayScore: 1 }, { ...unknownPhase, homeScore: 2, awayScore: 0 }),
      8
    );
  });
});

describe('calculatePoints (mata-mata — mesmas regras, pontos maiores)', () => {
  const ko = { phase: 'round_of_16' as const };

  it('acertou empate — mata-mata', () => {
    assert.equal(
      calculatePoints({ homeScore: 2, awayScore: 2 }, { ...ko, homeScore: 1, awayScore: 1 }),
      9
    );
  });

  it('vencedor errado — mata-mata', () => {
    assert.equal(
      calculatePoints({ homeScore: 2, awayScore: 1 }, { ...ko, homeScore: 1, awayScore: 2 }),
      0
    );
  });

  it('vencedor + gols do vencedor — mata-mata', () => {
    assert.equal(
      calculatePoints({ homeScore: 2, awayScore: 1 }, { ...ko, homeScore: 2, awayScore: 0 }),
      12
    );
  });

  it('vencedor + saldo — mata-mata', () => {
    assert.equal(
      calculatePoints({ homeScore: 3, awayScore: 2 }, { ...ko, homeScore: 2, awayScore: 1 }),
      10
    );
  });

  it('vencedor + gols do perdedor — mata-mata', () => {
    assert.equal(
      calculatePoints({ homeScore: 3, awayScore: 1 }, { ...ko, homeScore: 2, awayScore: 1 }),
      7
    );
  });

  it('apenas vencedor — mata-mata', () => {
    assert.equal(
      calculatePoints({ homeScore: 2, awayScore: 0 }, { ...ko, homeScore: 4, awayScore: 1 }),
      5
    );
  });

  it('placar exato 0×0 — mata-mata', () => {
    assert.equal(
      calculatePoints({ homeScore: 0, awayScore: 0 }, { ...ko, homeScore: 0, awayScore: 0 }),
      15
    );
  });
});

describe('isExactScorePoints', () => {
  it('identifica placar exato na fase de grupos', () => {
    assert.equal(isExactScorePoints('group', 10), true);
    assert.equal(isExactScorePoints('group', 8), false);
  });

  it('identifica placar exato no mata-mata', () => {
    assert.equal(isExactScorePoints('semi', 15), true);
    assert.equal(isExactScorePoints('semi', 12), false);
  });

  it('considera todas as fases de mata-mata com 15 pts', () => {
    assert.equal(isExactScorePoints('round_of_32', 15), true);
    assert.equal(isExactScorePoints('round_of_16', 15), true);
    assert.equal(isExactScorePoints('quarter', 15), true);
    assert.equal(isExactScorePoints('third_place', 15), true);
    assert.equal(isExactScorePoints('final', 15), true);
  });

  it('retorna false para fase ou pontos ausentes', () => {
    assert.equal(isExactScorePoints(null, 10), false);
    assert.equal(isExactScorePoints('group', null), false);
    assert.equal(isExactScorePoints(undefined, 15), false);
    assert.equal(isExactScorePoints('semi', undefined), false);
  });

  it('retorna false para fase não mapeada', () => {
    assert.equal(isExactScorePoints('group_stage', 10), false);
    assert.equal(isExactScorePoints('friendly', 15), false);
  });
});
