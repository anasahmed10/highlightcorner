const { test } = require('node:test');
const assert = require('node:assert/strict');
const { page } = require('./helpers/page.cjs');

const game = (away, home) => ({
  id: 'verdict-fixture', state: 'post', completed: true,
  away: { score: away }, home: { score: home }
});
const play = (id, period, clock, awayScore, homeScore) => ({
  id, period: { number: period }, clock: { value: clock }, awayScore, homeScore
});

test('score-only boundaries and tied finals remain deterministic', t => {
  const { w } = page(t, 'privacy.html');
  for (const [margin, expected] of [[8, 'nail-biter'], [9, 'comfortable'],
    [16, 'comfortable'], [17, 'blowout']]) {
    assert.equal(w.HC.gameVerdict(game(10, 10 + margin)), expected, `margin ${margin}`);
  }
  assert.equal(w.HC.gameVerdict(game(21, 21)), 'nail-biter');
  assert.equal(w.HC.gameVerdict(game(null, 21)), null);
});

test('late lead change through a tie stays a nail-biter despite a 14-point final margin', t => {
  const { w } = page(t, 'privacy.html');
  const scoringPlays = [
    play('a', 1, 600, 7, 0), play('b', 2, 600, 7, 7),
    play('c', 2, 300, 14, 7), play('d', 3, 600, 14, 14),
    play('e', 4, 500, 17, 14), play('f', 4, 400, 24, 14),
    play('g', 4, 90, 24, 21), play('h', 4, 50, 24, 24),
    play('i', 4, 20, 24, 31), play('j', 4, 0, 24, 38)
  ];
  assert.equal(w.HC.gameVerdict(game(24, 38), { scoringPlays }), 'nail-biter');
});

test('a close game remains a nail-biter after late defensive scores make the final margin 17', t => {
  const { w } = page(t, 'privacy.html');
  const scoringPlays = [
    play('a', 1, 600, 7, 0), play('b', 2, 600, 7, 7),
    play('c', 2, 300, 14, 7), play('d', 3, 600, 14, 14),
    play('e', 3, 100, 21, 14), play('f', 4, 400, 21, 21),
    play('g', 4, 200, 24, 21), play('h', 4, 130, 24, 27),
    play('i', 4, 90, 24, 34), play('j', 4, 10, 24, 41)
  ];
  assert.equal(w.HC.gameVerdict(game(24, 41), { scoringPlays }), 'nail-biter');
  const scoreAtExactlyTwo = [
    play('a', 1, 600, 0, 7), play('b', 2, 600, 7, 7),
    play('c', 2, 300, 7, 14), play('d', 3, 600, 14, 14),
    play('e', 3, 100, 14, 21), play('f', 4, 500, 21, 21),
    play('g', 4, 400, 21, 24), play('h', 4, 120, 21, 31),
    play('i', 4, 20, 21, 38)
  ];
  assert.equal(w.HC.gameVerdict(game(21, 38), { scoringPlays: scoreAtExactlyTwo }), 'nail-biter',
    'the game was close at five minutes before late scores made it a blowout on paper');
});

test('late scoring at exactly two minutes counts as a close finish', t => {
  const { w } = page(t, 'privacy.html');
  const scoringPlays = [
    play('a', 1, 600, 0, 7), play('b', 2, 600, 0, 10),
    play('c', 3, 600, 7, 10), play('d', 4, 400, 7, 17),
    play('e', 4, 120, 14, 17), play('f', 4, 10, 14, 24)
  ];
  assert.equal(w.HC.gameVerdict(game(14, 24), { scoringPlays }), 'nail-biter');
});

test('late score to an eight-point final margin stays comfortable without comeback evidence', t => {
  const { w } = page(t, 'privacy.html');
  const scoringPlays = [
    play('a', 1, 600, 0, 7), play('b', 2, 600, 0, 14),
    play('c', 2, 300, 6, 14), play('d', 3, 600, 6, 21),
    play('e', 4, 500, 12, 21), play('f', 4, 400, 12, 28),
    play('g', 4, 10, 20, 28)
  ];
  assert.equal(w.HC.gameVerdict(game(20, 28), { scoringPlays }), 'comfortable');
});

test('garbage-time requires a low, unrecovered win chance or a clear two-possession fallback', t => {
  const { w } = page(t, 'privacy.html');
  const scoringPlays = [
    play('a', 1, 600, 0, 7), play('b', 2, 600, 0, 14),
    play('c', 2, 300, 0, 21), play('d', 3, 600, 6, 21),
    play('e', 3, 300, 6, 24), play('f', 4, 500, 12, 24),
    play('g', 4, 72, 18, 24)
  ];
  const lowChance = [
    { playId: 'g', homeWinPercentage: 0.9892 },
    { playId: 'next', homeWinPercentage: 0.916 },
    { playId: 'final', homeWinPercentage: 1 }
  ];
  assert.equal(w.HC.gameVerdict(game(18, 24), { scoringPlays, winprobability: lowChance }), 'garbage-time');
  assert.equal(w.HC.gameVerdict(game(18, 24), { scoringPlays,
    winprobability: [{ playId: 'g', homeWinPercentage: 0.95 },
      { playId: 'next', homeWinPercentage: 0.9 },
      { playId: 'final', homeWinPercentage: 1 }]
  }), 'garbage-time', '5% afterward and 10% later are included');
  assert.equal(w.HC.gameVerdict(game(18, 24), { scoringPlays,
    winprobability: [{ playId: 'g', homeWinPercentage: 0.949 },
      { playId: 'final', homeWinPercentage: 1 }]
  }), 'comfortable', 'more than 5% afterward is not garbage time');
  const homeLoser = scoringPlays.map(p => ({ ...p, awayScore: p.homeScore, homeScore: p.awayScore }));
  assert.equal(w.HC.gameVerdict(game(24, 18), { scoringPlays: homeLoser,
    winprobability: [{ playId: 'g', homeWinPercentage: 0.0108 },
      { playId: 'next', homeWinPercentage: 0.084 },
      { playId: 'final', homeWinPercentage: 0 }]
  }), 'garbage-time', 'home win probability is interpreted from the eventual loser’s side');
  assert.equal(w.HC.gameVerdict(game(18, 24), { scoringPlays,
    winprobability: [{ playId: 'g', homeWinPercentage: 0.9892 }]
  }), 'comfortable', 'truncated win probability is not enough to claim garbage time');
  assert.equal(w.HC.gameVerdict(game(18, 24), { scoringPlays,
    winprobability: [{ playId: 'g', homeWinPercentage: 0.9892 },
      { playId: 'bad', homeWinPercentage: 1.2 },
      { playId: 'final', homeWinPercentage: 1 }]
  }), 'comfortable', 'invalid probability values are not skipped to claim garbage time');
  assert.equal(w.HC.gameVerdict(game(18, 24), { scoringPlays,
    winprobability: [null, { playId: 'g', homeWinPercentage: 0.9892 },
      { playId: 'final', homeWinPercentage: 1 }]
  }), 'garbage-time', 'unrelated malformed probability entries do not crash classification');
  assert.equal(w.HC.gameVerdict(game(18, 24), { scoringPlays,
    winprobability: [{ playId: 'g', homeWinPercentage: 0.9892 },
      { playId: 'recovery', homeWinPercentage: 0.75 },
      { playId: 'final', homeWinPercentage: 1 }]
  }), 'comfortable', 'a later recovery above 10% rules out garbage time');
  assert.equal(w.HC.gameVerdict(game(18, 24), { scoringPlays }), 'comfortable',
    'missing probability data does not make a one-score finish garbage time');

  const clearConsolation = [
    play('a', 1, 600, 0, 7), play('b', 2, 600, 0, 14),
    play('c', 3, 600, 0, 21), play('d', 4, 500, 7, 21),
    play('e', 4, 400, 7, 24), play('f', 4, 60, 14, 24)
  ];
  assert.equal(w.HC.gameVerdict(game(14, 24), { scoringPlays: clearConsolation }), 'garbage-time');
});

test('overtime, missing chronology, and corrected scores have safe labels', t => {
  const { w } = page(t, 'privacy.html');
  const overtime = [play('a', 1, 600, 7, 0), play('b', 2, 600, 7, 7),
    play('c', 3, 600, 14, 7), play('d', 4, 600, 14, 14),
    play('e', 5, 400, 20, 14)];
  assert.equal(w.HC.gameVerdict(game(20, 14), { scoringPlays: overtime }), 'nail-biter');
  assert.equal(w.HC.gameVerdict(game(10, 23), { scoringPlays: [
    play('a', 1, 600, 0, 7), play('b', 2, 600, 0, 14),
    play('c', 3, 600, 3, 14), play('d', 4, 600, 3, 20),
    play('e', 3, 500, 10, 20), play('f', 4, 100, 10, 23)
  ] }), 'comfortable', 'out-of-order periods use the final-margin fallback');
  assert.equal(w.HC.gameVerdict(game(10, 23), { scoringPlays: [
    play('a', 1, 600, 0, 7), play('b', 2, 600, 0, 14),
    play('c', 3, 600, 7, 14), play('d', 4, 300, 10, 20)
  ] }), 'comfortable', 'a stale last scoring play uses the final-margin fallback');
});
