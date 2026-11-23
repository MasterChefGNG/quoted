// Ports of the Android unit tests (MarkingTest, BlanksAndProgressTest, LearnTest, StudyTest, QuoteDataTest).
// Run from quoted-web: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as d from '../js/domain.js';
import { QUOTES } from '../js/quotes.js';

/** Small seeded generator so picks are repeatable (stands in for Kotlin's Random(seed)). */
function seeded(seed) {
  let a = (seed + 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const mark = (answer, quote) => d.markFull(answer, d.normalise(quote));
const quotes = d.prepareQuotes(QUOTES);
const byId = (id) => quotes.find((q) => q.id === id);
const rec = (o) => ({ ...d.emptyRecord(), ...o });

// ---------- Marking ----------

test('capitals, punctuation and line breaks are ignored', () => {
  assert.equal(mark('how weary stale flat and unprofitable seem to me all the uses of this world',
    'How weary, stale, flat and unprofitable, / Seem to me all the uses of this world!').percent, 100);
});

test('straight and curly apostrophes are the same', () => {
  assert.deepEqual(d.normalise("Denmark's a prison."), d.normalise('Denmark’s a prison'));
  assert.equal(mark('Denmark’s a prison', "Denmark's a prison.").percent, 100);
});

test("in 't and in't are the same", () => {
  const quote = "Though this be madness, yet there is method in 't.";
  assert.equal(mark("though this be madness yet there is method in't", quote).percent, 100);
  assert.equal(mark("though this be madness yet there is method in 't", quote).percent, 100);
  assert.deepEqual(d.normalise('in t').slice(0, 2), ['in', 't']);
});

test("'d endings match ed", () => {
  assert.deepEqual(d.normalise("I am still possess'd"), d.normalise('I am still possessed'));
  assert.deepEqual(d.normalise("pardon'd season'd"), d.normalise('pardoned seasoned'));
});

test('hyphens and em dashes split words', () => {
  assert.deepEqual(d.normalise('So to seduce!—won to'), ['so', 'to', 'seduce', 'won', 'to']);
  assert.deepEqual(d.normalise('north-north-west:'), ['north', 'north', 'west']);
  assert.deepEqual(d.normalise('gifts,— / O'), ['gifts', 'o']);
});

test('ellipsis is not required', () => {
  assert.equal(mark('To be or not to be that is the question', 'To be, or not to be: that is the question...').percent, 100);
});

test('typo allowance depends on word length', () => {
  assert.equal(d.allowedEdits('thy'), 0);
  assert.equal(d.allowedEdits('serpent'), 1);
  assert.equal(d.allowedEdits('dexterity'), 2);
  assert.equal(d.markBlank('the', 'thy'), false);
  assert.equal(d.markBlank('this', 'his'), false);
  assert.equal(d.markBlank('serpant', 'serpent'), true);
  assert.equal(d.markBlank('sarpant', 'serpent'), false);
  assert.equal(d.markBlank('dextirety', 'dexterity'), true);
  assert.equal(d.markBlank('dxtrty', 'dexterity'), false);
  assert.equal(d.markBlank('Unprofitable,', 'unprofitable'), true);
});

test('the concept screen example scores 92 and passes', () => {
  const m = mark('the serpent that did sting thy fathers life now wears the crown',
    "The serpent that did sting thy father's life / Now wears his crown.");
  assert.equal(m.percent, 92);
  assert.equal(m.isCorrect, true);
  assert.ok(m.diffs.some((x) => x.kind === 'wrong' && x.realIndex === 10 && x.typed === 'the'));
});

test('a small slip still passes but is not word perfect', () => {
  const quote = 'Get thee to a nunnery: why wouldst thou be a breeder of sinners?';
  const slip = mark('get thee to a nunnery why wouldst thou be a breeder of sinner', quote);
  assert.equal(slip.percent, 100);
  assert.equal(slip.isWordPerfect, false);
  assert.deepEqual(slip.slips, [{ kind: 'match', realIndex: 12, typed: 'sinner' }]);
  assert.equal(mark(quote, quote).isWordPerfect, true);
  assert.equal(d.isExactBlank('Sinners', 'sinners'), true);
  assert.equal(d.isExactBlank('sinner', 'sinners'), false);
});

test('a missing word does not shift later words', () => {
  const m = mark('something is rotten in state of denmark', 'Something is rotten in the state of Denmark.');
  assert.equal(m.percent, 88);
  assert.deepEqual([...m.wrongRealIndices], [4]);
  assert.ok(m.diffs.some((x) => x.kind === 'missing' && x.realIndex === 4));
});

test('an extra word counts against the score', () => {
  const m = mark('something is rotten in the state of old denmark', 'Something is rotten in the state of Denmark.');
  assert.equal(m.percent, 89);
  assert.equal(m.isCorrect, false);
  assert.ok(m.diffs.some((x) => x.kind === 'extra' && x.typed === 'old'));
});

test('ninety percent is the pass mark', () => {
  const quote = 'a1 b2 c3 d4 e5 f6 g7 h8 i9 j10';
  assert.equal(mark('a1 b2 c3 d4 e5 f6 g7 h8 i9 zz', quote).isCorrect, true);
  assert.equal(mark('a1 b2 c3 d4 e5 f6 g7 h8 yy zz', quote).isCorrect, false);
});

test('an empty answer scores zero', () => {
  assert.equal(mark('', 'The Mousetrap.').percent, 0);
});

// ---------- Blanks and progress ----------

test('blank levels follow the streak', () => {
  assert.equal(d.blankCount(12, 0), 4);
  assert.equal(d.blankCount(12, 1), 6);
  assert.equal(d.blankCount(12, 2), 6);
  assert.equal(d.blankCount(12, 3), 8);
  assert.equal(d.blankCount(2, 0), 1);
  assert.equal(d.blankCount(3, 1), 2);
});

test('the mousetrap at streak 0 blanks only Mousetrap', () => {
  const toks = d.tokens('The Mousetrap.');
  for (let s = 0; s < 20; s++) assert.deepEqual([...d.pickBlanks(toks, 0, seeded(s))], [1]);
});

test('blanks never cover every word before mastery', () => {
  const toks = d.tokens('I shall obey, my lord.');
  for (let s = 0; s < 20; s++) assert.ok(d.pickBlanks(toks, 2, seeded(s)).size < toks.length);
});

test('stop words are avoided when there is a choice', () => {
  const toks = d.tokens('Something is rotten in the state of Denmark.');
  for (let s = 0; s < 20; s++) {
    const picked = [...d.pickBlanks(toks, 0, seeded(s))].map((i) => toks[i].words[0]);
    assert.ok(picked.every((w) => !['is', 'in', 'the', 'of'].includes(w)));
  }
});

test('joined and dashed tokens are never blanks', () => {
  const toks = d.tokens("So to seduce!—won to his shameful lust / yet there is method in 't.");
  for (let s = 0; s < 20; s++) {
    const picked = [...d.pickBlanks(toks, 3, seeded(s))].map((i) => toks[i].text);
    assert.ok(!picked.some((t) => t.startsWith('seduce') || (t.startsWith('in') && t.length > 2)));
  }
});

test('a new blank set differs from the last one when possible', () => {
  const toks = d.tokens('How weary, stale, flat and unprofitable, / Seem to me all the uses of this world!');
  const first = d.pickBlanks(toks, 0, seeded(1));
  for (let s = 0; s < 10; s++) {
    const next = d.pickBlanks(toks, 0, seeded(s + 100), first);
    assert.ok(!(next.size === first.size && [...next].every((x) => first.has(x))));
  }
});

test('mastered after three in a row and lost on a wrong answer', () => {
  let r = d.withResult(d.withResult(d.emptyRecord(), true, 1), true, 1);
  assert.equal(d.isMastered(r), false);
  r = d.withResult(r, true, 1);
  assert.equal(d.isMastered(r), true);
  r = d.withResult(r, false, 2);
  assert.equal(d.isMastered(r), false);
  assert.equal(r.streak, 0);
  assert.equal(d.isWeak(r), true);
});

test('weak rules', () => {
  const run = (...results) => results.reduce((r, ok) => d.withResult(r, ok, 1), d.emptyRecord());
  assert.equal(d.isWeak(d.emptyRecord()), false);
  assert.equal(d.isWeak(run(false)), true);
  assert.equal(d.isWeak(run(false, true, true)), true);
  assert.equal(d.isWeak(run(false, true, true, true)), false);
});

test('mastered beats weak', () => {
  const r = [false, false, true, true, true].reduce((acc, ok) => d.withResult(acc, ok, 1), d.emptyRecord());
  assert.equal(d.isMastered(r), true);
  assert.equal(d.isWeak(r), false);
});

test('weights favour weak and unseen but never drop mastered', () => {
  assert.equal(d.pickWeight(d.withResult(d.emptyRecord(), false, 1)), 4);
  assert.equal(d.pickWeight(d.emptyRecord()), 3);
  assert.equal(d.pickWeight(d.withResult(d.emptyRecord(), true, 1)), 2);
  assert.equal(d.pickWeight(rec({ seen: 3, correct: 3, streak: 3, lastCorrect: true })), 1);
});

test('picking returns distinct ids and respects the count', () => {
  const ids = range(1, 32);
  const picked = d.pickQuotes(ids, {}, 10, seeded(7));
  assert.equal(picked.length, 10);
  assert.equal(new Set(picked).size, 10);
  assert.equal(d.pickQuotes(ids, {}, 40, seeded(7)).length, 32);
});

test('weak quotes come up more often than mastered', () => {
  const records = {};
  range(1, 16).forEach((id) => { records[id] = rec({ seen: 3, correct: 3, streak: 3, lastCorrect: true }); });
  range(17, 32).forEach((id) => { records[id] = d.withResult(d.emptyRecord(), false, 1); });
  let weakPicks = 0;
  for (let s = 0; s < 200; s++) weakPicks += d.pickQuotes(range(1, 32), records, 5, seeded(s)).filter((id) => id > 16).length;
  assert.ok(weakPicks > 650, `weak picks ${weakPicks} of 1000`);
});

// ---------- Learn ----------

const learnTokens = d.tokens('Something is rotten in the state of Denmark.');

test('nothing is hidden at the start and everything at the end', () => {
  const order = d.fadeOrder(learnTokens, seeded(1));
  assert.equal(d.hiddenAtStep(order, 0).size, 0);
  assert.deepEqual([...d.hiddenAtStep(order, d.MAX_FADE_STEPS)].sort((a, b) => a - b), learnTokens.map((_, i) => i));
});

test('every step hides more words and keeps the ones already hidden', () => {
  for (let s = 0; s < 10; s++) {
    const order = d.fadeOrder(learnTokens, seeded(s));
    for (let step = 1; step <= d.fadeSteps(order); step++) {
      const before = d.hiddenAtStep(order, step - 1);
      const now = d.hiddenAtStep(order, step);
      assert.ok(now.size > before.size);
      assert.ok([...before].every((x) => now.has(x)));
    }
  }
});

test('short quotes take fewer steps so each one still changes something', () => {
  const order = d.fadeOrder(d.tokens('The Mousetrap.'), seeded(3));
  assert.equal(d.fadeSteps(order), 2);
  assert.equal(d.hiddenAtStep(order, 1).size, 1);
  assert.equal(d.hiddenAtStep(order, 2).size, 2);
});

test('a new order each time', () => {
  const orders = new Set(range(0, 9).map((s) => d.fadeOrder(learnTokens, seeded(s)).join(',')));
  assert.ok(orders.size > 1);
});

test('bare punctuation is never hidden', () => {
  const dashed = d.tokens('I loved Ophelia — forty thousand brothers');
  d.fadeOrder(dashed, seeded(0)).forEach((i) => assert.ok(dashed[i].words.length > 0));
});

test('quotes never tested come first, then the weakest, in quote order', () => {
  const records = {
    1: rec({ seen: 3, correct: 3, streak: 3, lastCorrect: true }),
    2: rec({ seen: 1, correct: 0, lastCorrect: false }),
    4: rec({ seen: 1, correct: 1, streak: 1, lastCorrect: true }),
  };
  assert.deepEqual(d.learnOrder([1, 2, 3, 4, 5], records), [3, 5, 2, 4, 1]);
});

// ---------- Day streak ----------

test('day streak: starts, grows, ignores a second session, resets after a missed day', () => {
  assert.deepEqual(d.afterStudy(d.emptyStreak(), 100), { lastDay: 100, days: 1 });
  assert.deepEqual(d.afterStudy({ lastDay: 100, days: 3 }, 101), { lastDay: 101, days: 4 });
  assert.deepEqual(d.afterStudy({ lastDay: 100, days: 3 }, 100), { lastDay: 100, days: 3 });
  assert.deepEqual(d.afterStudy({ lastDay: 100, days: 3 }, 102), { lastDay: 102, days: 1 });
});

test('the streak shows until the end of the day after the last session', () => {
  const s = { lastDay: 100, days: 5 };
  assert.equal(d.currentStreak(s, 100), 5);
  assert.equal(d.currentStreak(s, 101), 5);
  assert.equal(d.currentStreak(s, 102), 0);
  assert.equal(d.currentStreak(d.emptyStreak(), 100), 0);
  assert.equal(d.studiedOn({ lastDay: 100, days: 2 }, 100), true);
  assert.equal(d.studiedOn({ lastDay: 99, days: 2 }, 100), false);
});

test('epoch days use the local calendar date', () => {
  assert.equal(d.epochDay(new Date(1970, 0, 1, 23, 59)), 0);
  assert.equal(d.epochDay(new Date(2026, 10, 23, 0, 1)), d.epochDay(new Date(2026, 10, 23, 23, 59)));
  assert.equal(d.epochDay(new Date(2026, 10, 24)) - d.epochDay(new Date(2026, 10, 23)), 1);
});

// ---------- Quote data ----------

test('all 32 quotes load with a speaker and a theme', () => {
  assert.deepEqual(quotes.map((q) => q.id), range(1, 32));
  quotes.forEach((q) => {
    assert.ok(q.speakers.length > 0 && q.themes.length > 0 && q.act >= 1 && q.act <= 3, `quote ${q.id}`);
  });
});

test('token words always equal the whole-quote words', () => {
  quotes.forEach((q) => assert.deepEqual(q.words, d.normalise(q.text), `quote ${q.id}`));
});

test('quote text matches the original list exactly', () => {
  const file = new URL('../../hamlet_quotes_list_act_1_act_3_scene_3.txt', import.meta.url);
  if (!existsSync(file)) return;
  const pattern = /^(\d+)\. (.*) \(Act (\d), Scene (\d)\)$/;
  readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l.trim()).forEach((line) => {
    const m = pattern.exec(line);
    assert.ok(m, `unparsed: ${line}`);
    const text = m[2].replace(/^"/, '').replace(/"$/, '').replace('" / "', ' / ');
    const q = byId(Number(m[1]));
    assert.equal(q.text, text);
    assert.equal(q.act, Number(m[3]));
    assert.equal(q.scene, Number(m[4]));
  });
});

test('quote 23 matches a filter on either speaker', () => {
  const q23 = byId(23);
  assert.ok(d.filterMatches({ ...d.emptyFilter(), speakers: new Set(['Ophelia']) }, q23));
  assert.ok(d.filterMatches({ ...d.emptyFilter(), speakers: new Set(['Hamlet']) }, q23));
  assert.equal(q23.speakerLabel, 'Ophelia → Hamlet');
});

test('starts with hints never give a short quote away', () => {
  assert.equal(d.startsWithHint(byId(25)), 'Starts with "The..."');
  assert.equal(d.startsWithHint(byId(19)), 'Starts with "Denmark\'s..."');
  assert.equal(d.startsWithHint(byId(12)), 'Starts with "The serpent..."');
  assert.equal(d.startsWithHint(byId(1)), 'Starts with "O, most..."');
  assert.equal(d.startsWithHint(byId(23)), 'Starts with "\'Tis brief..."');
});
