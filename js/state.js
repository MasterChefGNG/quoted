// App state and actions: the web version of AppViewModel.kt. Screens read `vm` and call its actions;
// changing the screen calls the renderer that app.js registers.
import * as d from './domain.js';
import { QUOTES } from './quotes.js';
import * as store from './store.js';

export const MODES = {
  FillBlanks: { key: 'FillBlanks', title: 'Fill in the blanks', subtitle: 'Type the missing words', icon: 'blanks' },
  TypeFull: { key: 'TypeFull', title: 'Type the full quote', subtitle: 'Write it from memory', icon: 'pencil' },
  Flashcards: { key: 'Flashcards', title: 'Flashcards', subtitle: 'Flip and mark yourself', icon: 'cards' },
};
export const MODE_LIST = Object.values(MODES);

const WEAK_SESSION_MAX = 20;
const random = Math.random;

// Screens: {name:'home'|'list'|'settings'} | {name:'test', session} | {name:'summary', mode, answers}
//          | {name:'learn', quoteIds, index} | {name:'learnDone', quoteIds}
// session = {mode, quoteIds, index, answers:[{quoteId, isCorrect}]}

let onScreenChange = () => {};
export const setRenderer = (fn) => { onScreenChange = fn; };

const lastBlanks = new Map();

export const vm = {
  quotes: d.prepareQuotes(QUOTES),
  records: store.loadRecords(),
  streak: store.loadStreak(),
  screen: { name: 'home' },

  get quoteById() {
    return this._byId ??= new Map(this.quotes.map((q) => [q.id, q]));
  },

  record(id) {
    return this.records[id] ?? d.emptyRecord();
  },

  weakIds() {
    return this.quotes.map((q) => q.id).filter((id) => d.isWeak(this.record(id)));
  },

  matching(filter) {
    return this.quotes.filter((q) => d.filterMatches(filter, q)).map((q) => q.id);
  },

  go(screen) {
    this.screen = screen;
    onScreenChange(screen);
  },

  /** Starts a session; count null means every matching quote. */
  start(mode, filter, count) {
    const ids = this.matching(filter);
    if (ids.length === 0) return;
    const picked = d.pickQuotes(ids, this.records, count ?? ids.length, random);
    this.go({ name: 'test', session: { mode, quoteIds: picked, index: 0, answers: [] } });
  },

  startWeak(mode) {
    const ids = this.weakIds();
    if (ids.length === 0) return;
    const picked = d.pickQuotes(ids, this.records, WEAK_SESSION_MAX, random);
    this.go({ name: 'test', session: { mode, quoteIds: picked, index: 0, answers: [] } });
  },

  /** Starts a fade-out learning run; count null means every matching quote. */
  startLearn(filter, count) {
    const ids = d.learnOrder(this.matching(filter), this.records);
    if (ids.length === 0) return;
    this.go({ name: 'learn', quoteIds: ids.slice(0, count ?? ids.length), index: 0 });
  },

  fadeOrderFor(quote) {
    return d.fadeOrder(quote.tokens, random);
  },

  learnNext() {
    const s = this.screen;
    if (s.name !== 'learn') return;
    if (s.index + 1 < s.quoteIds.length) {
      this.go({ ...s, index: s.index + 1 });
    } else {
      this.markStudiedToday();
      this.go({ name: 'learnDone', quoteIds: s.quoteIds });
    }
  },

  /** "Test me on these" after learning: Fill in the blanks on the same quotes, shuffled. */
  testLearned(ids) {
    if (ids.length === 0) return;
    this.go({ name: 'test', session: { mode: MODES.FillBlanks, quoteIds: d.shuffled(ids, random), index: 0, answers: [] } });
  },

  retryWrong(summary) {
    const wrong = [...new Set(summary.answers.filter((a) => !a.isCorrect).map((a) => a.quoteId))];
    if (wrong.length === 0) return;
    this.go({ name: 'test', session: { mode: summary.mode, quoteIds: d.shuffled(wrong, random), index: 0, answers: [] } });
  },

  /** Blank token indices for this quote, different from last time where possible. */
  blanksFor(quote) {
    const picked = d.pickBlanks(quote.tokens, this.record(quote.id).streak, random, lastBlanks.get(quote.id) ?? null);
    lastBlanks.set(quote.id, picked);
    return picked;
  },

  /** Saves the result straight away, so closing mid-session keeps what was answered. */
  answer(isCorrect) {
    const s = this.screen;
    if (s.name !== 'test') return;
    const session = s.session;
    if (session.answers.length > session.index) return; // already answered this one
    const id = session.quoteIds[session.index];
    this.records = { ...this.records, [id]: d.withResult(this.record(id), isCorrect, d.epochDay()) };
    store.saveRecords(this.records);
    // Updated in place of a re-render: the question screen stays as it is to show feedback.
    this.screen = { name: 'test', session: { ...session, answers: [...session.answers, { quoteId: id, isCorrect }] } };
  },

  next() {
    const s = this.screen;
    if (s.name !== 'test') return;
    const session = s.session;
    if (session.index + 1 < session.quoteIds.length) {
      this.go({ name: 'test', session: { ...session, index: session.index + 1 } });
    } else {
      this.markStudiedToday();
      this.go({ name: 'summary', mode: session.mode, answers: session.answers });
    }
  },

  /** Finishing a session counts as today's study for the day streak. */
  markStudiedToday() {
    const updated = d.afterStudy(this.streak, d.epochDay());
    if (updated === this.streak) return;
    this.streak = updated;
    store.saveStreak(updated);
  },

  resetProgress() {
    store.resetAll();
    this.streak = d.emptyStreak();
    lastBlanks.clear();
    this.records = {};
  },
};
