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
});
