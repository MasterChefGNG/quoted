// Pure logic ported line for line from the Android app's domain/ package (Words, Marking, Blanks,
// Progress, Learn, Study, Quote). No DOM here, so it runs under Node for the tests.
// `random` is always a function returning a number in [0, 1), so tests can pass a seeded one.

// ---------- Words ----------

/** Glues a lone 't to the word before it so "in 't" is one token (a no-break space, as on Android). */
export const JOINER = ' ';

const LINE_BREAK = ' / ';
// Java's \s is ASCII-only; JS's \s also matches the no-break space, so spell the class out.
const WS = '[ \\t\\n\\x0B\\f\\r]';
const loneT = new RegExp(`${WS}+(['’‘ʼ][tT])(?![A-Za-z])`, 'g');
const apostrophes = /[’‘ʼ`´]/g;
const dashes = /[-‐‑‒–—―]/g;
const dEnding = /([a-z])'d(?![a-z])/g;
const notWordChars = /[^a-z0-9 \t\n\x0B\f\r]/g;
const spaces = new RegExp(`${WS}+`);
const edgePunctuation = /^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu;

const joinLoneT = (text) => text.replace(loneT, (_, t) => JOINER + t);

/** Lower-cases, unifies apostrophes, splits dashes, joins 't, expands 'd and drops punctuation. */
export function normalise(text) {
  const s = joinLoneT(text).toLowerCase()
    .replace(apostrophes, "'")
    .split(LINE_BREAK).join(' ')
    .replace(dashes, ' ')
    .replace(dEnding, '$1ed')
    .replace(notWordChars, '');
  return s.split(spaces).filter((w) => w.length > 0);
}

/** Strips leading and trailing punctuation but keeps apostrophes ("'Tis brief," -> "'Tis brief"). */
export const trimPunctuation = (text) => text.replace(edgePunctuation, '');

/** Splits a quote into display tokens {text, words, startsLine, core}, keeping verse line breaks. */
export function tokens(text) {
  return text.split(LINE_BREAK).flatMap((line, lineIndex) =>
    joinLoneT(line).split(' ').filter((t) => t.trim().length > 0).map((raw, i) => ({
      text: raw,
      words: normalise(raw),
      startsLine: lineIndex > 0 && i === 0,
      core: trimPunctuation(raw),
    })),
  );
}

// ---------- Marking ----------

export const PASS_PERCENT = 90;
const SHORT_WORD = 3;
const MEDIUM_WORD = 7;

/** Typos allowed for a real word: exact up to 3 letters, 1 edit up to 7, 2 edits for 8 or more. */
export function allowedEdits(realWord) {
  if (realWord.length <= SHORT_WORD) return 0;
  if (realWord.length <= MEDIUM_WORD) return 1;
  return 2;
}

export function editDistance(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

export const wordMatches = (typed, real) => editDistance(typed, real) <= allowedEdits(real);

// Diffs: {kind:'match', realIndex, typed?} | {kind:'wrong', realIndex, typed} | {kind:'missing', realIndex} | {kind:'extra', typed}

function align(real, typed) {
  const n = real.length;
  const m = typed.length;
  const cost = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) cost[i][0] = i;
  for (let j = 0; j <= m; j++) cost[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sub = wordMatches(typed[j - 1], real[i - 1]) ? 0 : 1;
      cost[i][j] = Math.min(cost[i - 1][j - 1] + sub, Math.min(cost[i - 1][j], cost[i][j - 1]) + 1);
    }
  }
  const out = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const canDiagonal = i > 0 && j > 0;
    const isMatch = canDiagonal && wordMatches(typed[j - 1], real[i - 1]);
    if (canDiagonal && cost[i][j] === cost[i - 1][j - 1] + (isMatch ? 0 : 1)) {
      const word = typed[j - 1];
      if (!isMatch) out.unshift({ kind: 'wrong', realIndex: i - 1, typed: word });
      else if (word === real[i - 1]) out.unshift({ kind: 'match', realIndex: i - 1, typed: null });
      else out.unshift({ kind: 'match', realIndex: i - 1, typed: word });
      i--; j--;
    } else if (i > 0 && cost[i][j] === cost[i - 1][j] + 1) {
      out.unshift({ kind: 'missing', realIndex: i - 1 });
      i--;
    } else {
      out.unshift({ kind: 'extra', typed: typed[j - 1] });
      j--;
    }
  }
  return out;
}

/**
 * Marks a typed quote. Words are lined up with a word-level diff so one missing or extra word does not
 * knock later words out of place. Score = matched words / the larger of real and typed word counts.
 */
export function markFull(answer, real) {
  const typed = normalise(answer);
  const diffs = align(real, typed);
  const matched = diffs.filter((d) => d.kind === 'match').length;
  const denominator = Math.max(real.length, typed.length);
  const percent = denominator === 0 ? 0 : Math.round((matched * 100) / denominator);
  const slips = diffs.filter((d) => d.kind === 'match' && d.typed !== null);
  return {
    percent,
    diffs,
    isCorrect: percent >= PASS_PERCENT,
    isWordPerfect: diffs.every((d) => d.kind === 'match' && d.typed === null),
    slips,
    wrongRealIndices: new Set(diffs.filter((d) => d.kind === 'wrong' || d.kind === 'missing').map((d) => d.realIndex)),
  };
}

/** Marks one blank: my typed text against the single real word it hides. */
export const markBlank = (input, realWord) => wordMatches(normalise(input).join(''), realWord);

/** Whether a blank was spelt exactly (not just within the typo allowance). */
export const isExactBlank = (input, realWord) => normalise(input).join('') === realWord;

// ---------- Progress ----------

export const MASTERED_STREAK = 3;
const WEAK_ACCURACY = 0.7;
const MIN_ATTEMPTS_FOR_ACCURACY = 2;

export const emptyRecord = () => ({ seen: 0, correct: 0, streak: 0, lastCorrect: null, lastSeenDay: null });

export const isUnseen = (r) => r.seen === 0;
export const isMastered = (r) => r.streak >= MASTERED_STREAK;

/** Weak: not mastered, and the last attempt was wrong or accuracy is under 70% after two tries. */
export const isWeak = (r) => !isMastered(r) && r.seen > 0 &&
  (r.lastCorrect === false || (r.seen >= MIN_ATTEMPTS_FOR_ACCURACY && r.correct / r.seen < WEAK_ACCURACY));

export const withResult = (r, isCorrect, day) => ({
  seen: r.seen + 1,
  correct: r.correct + (isCorrect ? 1 : 0),
  streak: isCorrect ? r.streak + 1 : 0,
  lastCorrect: isCorrect,
  lastSeenDay: day,
});

/** Picking weight: weak 4, unseen 3, learning 2, mastered 1 (never zero). */
export function pickWeight(r) {
  if (isWeak(r)) return 4;
  if (isUnseen(r)) return 3;
  if (isMastered(r)) return 1;
  return 2;
}

/** Weighted random sample without replacement. */
export function weightedSample(items, count, random, weight) {
  const pool = [...items];
  const out = [];
  while (out.length < count && pool.length > 0) {
    const total = pool.reduce((sum, it) => sum + weight(it), 0);
    let roll = random() * total;
    let index = pool.findIndex((it) => { roll -= weight(it); return roll < 0; });
    if (index < 0) index = pool.length - 1;
    out.push(pool.splice(index, 1)[0]);
  }
  return out;
}

/** Chooses up to `count` quote ids, weighted towards weak and unseen quotes, without repeats. */
export const pickQuotes = (ids, records, count, random) =>
  weightedSample(ids, count, random, (id) => pickWeight(records[id] ?? emptyRecord()));

export function shuffled(items, random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------- Blanks ----------

/** Words only blanked when a quote has nothing more distinctive left. */
export const STOP_WORDS = new Set(['a', 'an', 'and', 'the', 'to', 'of', 'in', 'is', 'it', 'my', 'his', 'her', 'our',
  'thy', 'but', 'so', 'with', 'as']);
const PICK_ATTEMPTS = 6;

/** A third of the words at streak 0, a half at streak 1-2, two thirds once mastered. */
export function blankFraction(streak) {
  if (streak <= 0) return 1 / 3;
  if (streak < MASTERED_STREAK) return 1 / 2;
  return 2 / 3;
}

/** How many tokens to blank: rounded up, at least one, and never all of them before mastery. */
export function blankCount(totalTokens, streak) {
  // Rounded to 9 places first so 12 * (1/3) is 4, not 4.000000000000001 (Kotlin's ceil has the same input).
  const wanted = Math.ceil(Number((totalTokens * blankFraction(streak)).toFixed(9)));
  const cap = streak >= MASTERED_STREAK ? totalTokens : totalTokens - 1;
  return Math.max(1, Math.min(wanted, cap));
}

/** A token can be a blank if it stands for exactly one word (not "seduce!—won" or "in 't"). */
export const isBlankable = (token) => token.words.length === 1 && !token.text.includes(JOINER);

const sameSet = (a, b) => b != null && a.size === b.size && [...a].every((x) => b.has(x));

function pickOnce(toks, blankable, count, random) {
  const stop = blankable.filter((i) => STOP_WORDS.has(toks[i].words[0]));
  const distinctive = blankable.filter((i) => !STOP_WORDS.has(toks[i].words[0]));
  const chosen = weightedSample(distinctive, count, random, (i) => toks[i].words[0].length);
  const rest = shuffled(stop, random).slice(0, Math.max(0, count - chosen.length));
  return new Set([...chosen, ...rest]);
}

/**
 * Picks which token indices to blank. Longer, more distinctive words are more likely; stop words only
 * fill in when needed. Tries not to repeat `previous` exactly.
 */
export function pickBlanks(toks, streak, random, previous = null) {
  const blankable = toks.map((_, i) => i).filter((i) => isBlankable(toks[i]));
  if (blankable.length === 0) return new Set();
  const count = Math.min(blankCount(toks.length, streak), blankable.length);
  let pick = pickOnce(toks, blankable, count, random);
  for (let a = 0; a < PICK_ATTEMPTS; a++) {
    if (!sameSet(pick, previous)) return pick;
    pick = pickOnce(toks, blankable, count, random);
  }
  return pick;
}

// ---------- Quotes ----------

/** Adds tokens, words and labels to the raw quote data, sorted by id. */
export function prepareQuotes(raw) {
  return [...raw].sort((a, b) => a.id - b.id).map((q) => {
    const toks = tokens(q.text);
    return {
      ...q,
      tokens: toks,
      words: toks.flatMap((t) => t.words),
      speakerLabel: q.speakers.join(' → '),
      actScene: `Act ${q.act}, Scene ${q.scene}`,
    };
  });
}

export const emptyFilter = () => ({ acts: new Set(), speakers: new Set(), themes: new Set() });
export const filterIsEmpty = (f) => f.acts.size === 0 && f.speakers.size === 0 && f.themes.size === 0;

/** Within a group any match counts; every non-empty group must match. */
export const filterMatches = (f, q) =>
  (f.acts.size === 0 || f.acts.has(q.act)) &&
  (f.speakers.size === 0 || q.speakers.some((s) => f.speakers.has(s))) &&
  (f.themes.size === 0 || q.themes.some((t) => f.themes.has(t)));

const SHORT_QUOTE_WORDS = 4;

/** The "Starts with" hint: two words, or one for quotes of four words or fewer. */
export function startsWithHint(quote) {
  const take = quote.words.length <= SHORT_QUOTE_WORDS ? 1 : 2;
  const start = quote.tokens.slice(0, take).map((t) => t.text).join(' ');
  return `Starts with "${trimPunctuation(start)}..."`;
}

// ---------- Learn (fade-out drill) ----------

export const MAX_FADE_STEPS = 4;

/** The order words disappear in: every real word once, shuffled. Bare punctuation is never hidden. */
export const fadeOrder = (toks, random) =>
  shuffled(toks.map((_, i) => i).filter((i) => toks[i].words.length > 0), random);

/** Steps for this quote: up to MAX_FADE_STEPS, but never more than its words. */
export const fadeSteps = (order) => Math.min(Math.max(order.length, 1), MAX_FADE_STEPS);

/** Words hidden at `step`: none at step 0, all at the last step, growing evenly in between. */
export function hiddenAtStep(order, step) {
  const steps = fadeSteps(order);
  const clamped = Math.min(Math.max(step, 0), steps);
  const count = Math.ceil(Number(((order.length * clamped) / steps).toFixed(9)));
  return new Set(order.slice(0, count));
}

/** Learning order: quotes never tested come first, then the weakest, each group in quote order. */
export function learnOrder(ids, records) {
  const rec = (id) => records[id] ?? emptyRecord();
  return [...ids].sort((a, b) =>
    (Number(isUnseen(rec(b))) - Number(isUnseen(rec(a)))) ||
    (pickWeight(rec(b)) - pickWeight(rec(a))) ||
    (a - b));
}

// ---------- Day streak ----------

/** Days since 1970-01-01 in local time, like Android's LocalDate.now().toEpochDay(). */
export function epochDay(date = new Date()) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}

export const emptyStreak = () => ({ lastDay: null, days: 0 });
export const studiedOn = (s, today) => s.lastDay === today;

/** The streak as it stands today: still alive if I studied today or yesterday, otherwise 0. */
export const currentStreak = (s, today) => (s.lastDay !== null && s.lastDay >= today - 1 ? s.days : 0);

/** Records a finished session today. A second session on the same day changes nothing. */
export function afterStudy(s, today) {
  if (s.lastDay === today) return s;
  if (s.lastDay === today - 1) return { lastDay: today, days: s.days + 1 };
  return { lastDay: today, days: 1 };
}
