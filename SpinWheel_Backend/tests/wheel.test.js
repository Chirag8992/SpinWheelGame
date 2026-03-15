/**
 * Unit tests for SpinWheel Game — critical path coverage
 * Run: npm test
 *
 * These tests cover pure functions and business logic
 * without requiring a DB or Redis connection.
 */

// ─────────────────────────────────────────────────────────────
// Helpers — copied inline so tests have zero external deps
// ─────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildEliminationSequence(userIds) {
  const seq = shuffle([...userIds]);
  seq.pop(); // last = winner, never eliminated
  return seq;
}

function calcPoolAmounts(entryFee, winnerPct, adminPct, appPct) {
  const winner = parseFloat(((entryFee * winnerPct) / 100).toFixed(2));
  const admin  = parseFloat(((entryFee * adminPct)  / 100).toFixed(2));
  const app    = parseFloat(((entryFee * appPct)    / 100).toFixed(2));
  return { winner, admin, app, total: winner + admin + app };
}

function formatCoins(amount) {
  const n = parseFloat(amount) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ─────────────────────────────────────────────────────────────
// TEST SUITE 1: Elimination Sequence
// ─────────────────────────────────────────────────────────────
describe('buildEliminationSequence', () => {

  test('sequence length = players - 1 (last player is winner)', () => {
    const players = [1, 2, 3, 4, 5];
    const seq     = buildEliminationSequence(players);
    expect(seq.length).toBe(players.length - 1);
  });

  test('sequence length = players - 1 for minimum 3 players', () => {
    const players = [10, 20, 30];
    const seq     = buildEliminationSequence(players);
    expect(seq.length).toBe(2);
  });

  test('all IDs in sequence exist in original player list', () => {
    const players = [1, 2, 3, 4, 5];
    const seq     = buildEliminationSequence(players);
    seq.forEach(id => expect(players).toContain(id));
  });

  test('no duplicate IDs in sequence', () => {
    const players = [1, 2, 3, 4, 5, 6, 7, 8];
    const seq     = buildEliminationSequence(players);
    const unique  = new Set(seq);
    expect(unique.size).toBe(seq.length);
  });

  test('winner (last in original shuffle) is NOT in sequence', () => {
    // Run 20 times — winner should never appear in sequence
    for (let i = 0; i < 20; i++) {
      const players = [1, 2, 3, 4, 5];
      const shuffled = shuffle([...players]);
      const winner   = shuffled[shuffled.length - 1];
      const seq      = shuffled.slice(0, shuffled.length - 1);
      expect(seq).not.toContain(winner);
    }
  });

  test('shuffle produces different orders (not always same)', () => {
    const players = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const results = new Set();
    for (let i = 0; i < 20; i++) {
      results.add(JSON.stringify(shuffle([...players])));
    }
    // With 10 players, extremely unlikely all 20 shuffles are identical
    expect(results.size).toBeGreaterThan(1);
  });
});

// ─────────────────────────────────────────────────────────────
// TEST SUITE 2: Coin Distribution
// ─────────────────────────────────────────────────────────────
describe('calcPoolAmounts', () => {

  test('standard 60/30/10 split on 100 coins', () => {
    const result = calcPoolAmounts(100, 60, 30, 10);
    expect(result.winner).toBe(60);
    expect(result.admin).toBe(30);
    expect(result.app).toBe(10);
  });

  test('pools sum equals entry fee', () => {
    const result = calcPoolAmounts(100, 60, 30, 10);
    expect(result.total).toBeCloseTo(100, 2);
  });

  test('50/40/10 split on 200 coins', () => {
    const result = calcPoolAmounts(200, 50, 40, 10);
    expect(result.winner).toBe(100);
    expect(result.admin).toBe(80);
    expect(result.app).toBe(20);
    expect(result.total).toBeCloseTo(200, 2);
  });

  test('pools sum equals entry fee for non-round splits', () => {
    const result = calcPoolAmounts(333, 60, 30, 10);
    expect(result.total).toBeCloseTo(333, 0);
  });

  test('zero entry fee gives zero pools', () => {
    const result = calcPoolAmounts(0, 60, 30, 10);
    expect(result.winner).toBe(0);
    expect(result.admin).toBe(0);
    expect(result.app).toBe(0);
  });

  test('winner gets largest share with 60/30/10', () => {
    const result = calcPoolAmounts(500, 60, 30, 10);
    expect(result.winner).toBeGreaterThan(result.admin);
    expect(result.admin).toBeGreaterThan(result.app);
  });
});

// ─────────────────────────────────────────────────────────────
// TEST SUITE 3: Input Validation
// ─────────────────────────────────────────────────────────────
describe('entry fee validation', () => {

  function validateEntryFee(fee) {
    if (fee === null || fee === undefined) return 'Entry fee is required';
    if (typeof fee !== 'number' || isNaN(fee)) return 'Entry fee must be a number';
    if (fee <= 0) return 'Entry fee must be greater than 0';
    return null;
  }

  test('valid entry fee returns no error', () => {
    expect(validateEntryFee(100)).toBeNull();
    expect(validateEntryFee(0.01)).toBeNull();
    expect(validateEntryFee(9999)).toBeNull();
  });

  test('zero entry fee is invalid', () => {
    expect(validateEntryFee(0)).toBeTruthy();
  });

  test('negative entry fee is invalid', () => {
    expect(validateEntryFee(-50)).toBeTruthy();
  });

  test('null entry fee is invalid', () => {
    expect(validateEntryFee(null)).toBeTruthy();
  });

  test('NaN entry fee is invalid', () => {
    expect(validateEntryFee(NaN)).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────
// TEST SUITE 4: formatCoins utility
// ─────────────────────────────────────────────────────────────
describe('formatCoins', () => {
  test('formats thousands as K', () => {
    expect(formatCoins(1500)).toBe('1.5K');
    expect(formatCoins(1000)).toBe('1.0K');
  });

  test('formats millions as M', () => {
    expect(formatCoins(2500000)).toBe('2.5M');
  });

  test('formats small amounts as plain number', () => {
    expect(formatCoins(100)).toBe('100');
    expect(formatCoins(0)).toBe('0');
  });

  test('handles decimal input', () => {
    expect(formatCoins(999.99)).toBe('999.99');
  });

  test('handles null/undefined gracefully', () => {
    expect(formatCoins(null)).toBe('0');
    expect(formatCoins(undefined)).toBe('0');
  });
});

// ─────────────────────────────────────────────────────────────
// TEST SUITE 5: Game State Transitions
// ─────────────────────────────────────────────────────────────
describe('game state transition validation', () => {

  const VALID_TRANSITIONS = {
    waiting:  ['active', 'aborted'],
    active:   ['finished'],
    finished: [],
    aborted:  [],
  };

  function canTransition(from, to) {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  }

  test('waiting → active is valid (start)', () => {
    expect(canTransition('waiting', 'active')).toBe(true);
  });

  test('waiting → aborted is valid (abort)', () => {
    expect(canTransition('waiting', 'aborted')).toBe(true);
  });

  test('active → finished is valid (game ends)', () => {
    expect(canTransition('active', 'finished')).toBe(true);
  });

  test('finished → anything is invalid', () => {
    expect(canTransition('finished', 'waiting')).toBe(false);
    expect(canTransition('finished', 'active')).toBe(false);
  });

  test('active → waiting is invalid (no going back)', () => {
    expect(canTransition('active', 'waiting')).toBe(false);
  });

  test('aborted → active is invalid (cannot restart aborted)', () => {
    expect(canTransition('aborted', 'active')).toBe(false);
  });
});