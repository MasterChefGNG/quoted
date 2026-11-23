// Summary, All quotes and Settings (OtherScreens.kt). The daily reminder is left out on the web:
// iPhones can't schedule a notification from a web app without a server.
import * as d from './domain.js';
import { vm } from './state.js';
import { h, mascot, bigButton, card, chip, topBar, label, openDialog } from './ui.js';
import { quoteText } from './test-screen.js';
import { filterSections } from './home.js';

const GREAT = 0.9;
const GOOD = 0.6;

export function summaryScreen(summary) {
  const total = summary.answers.length;
  const right = summary.answers.filter((a) => a.isCorrect).length;
  const wrong = [...new Set(summary.answers.filter((a) => !a.isCorrect).map((a) => a.quoteId))];
  let line = 'Keep rehearsing';
  if (total > 0 && right === total) line = 'Word perfect!';
  else if (total > 0 && right >= total * GREAT) line = 'Nearly there';
  else if (total > 0 && right >= total * GOOD) line = 'Good going';

  return h('div', { class: 'screen' },
    h('div', { class: 'list-scroll' },
      h('div', { class: 'summary-top' },
        mascot(110),
        h('h1', { class: 'hero', text: `${right} of ${total}` }),
        h('p', { class: 'secondary', text: line })),
      wrong.length > 0 ? label('To work on') : null,
      wrong.map((id) => {
        const q = vm.quoteById.get(id);
        return card([quoteText(q, undefined, undefined, 'body'), h('p', { class: 'secondary', text: `${q.speakerLabel} · ${q.actScene}` })],
          { cls: 'quote-card' });
      })),
    h('div', { class: 'bottom-stack' },
      wrong.length > 0 ? bigButton('Retry the wrong ones', () => vm.retryWrong(summary)) : null,
      bigButton('Done', () => vm.go({ name: 'home' }), { primary: wrong.length === 0 })));
}

let listFilter = d.emptyFilter();
let showFilters = false;

export function quoteListScreen() {
  const body = h('div', { class: 'list-scroll' });
  const draw = () => {
    const shown = vm.quotes.filter((q) => d.filterMatches(listFilter, q));
    let toggleText = d.filterIsEmpty(listFilter) ? 'Filter' : 'Filter (on)';
    if (showFilters) toggleText = 'Hide filters';
    body.replaceChildren(...[
      h('button', { type: 'button', class: 'text-link plain', text: toggleText, onClick: () => { showFilters = !showFilters; draw(); } }),
      showFilters ? h('div', {}, filterSections(listFilter, (f) => { listFilter = f; draw(); })) : null,
      h('p', { class: 'secondary', text: `${shown.length} quotes` }),
      ...shown.map((q) => {
        const r = vm.record(q.id);
        let status = null;
        if (d.isMastered(r)) status = chip('Mastered', true);
        else if (d.isWeak(r)) status = chip('Weak');
        return card([
          h('div', { class: 'quote-card-top' }, h('span', { class: 'label', text: String(q.id) }), status),
          quoteText(q, undefined, undefined, 'body'),
          h('p', { class: 'secondary', text: `${q.speakerLabel} · ${q.actScene}` }),
          h('p', { class: 'secondary', text: q.themes.join(' · ') }),
          h('p', { class: 'secondary dark', text: `Seen ${r.seen} · Correct ${r.correct} · Streak ${r.streak}` }),
        ], { cls: 'quote-card' });
      }),
    ].filter(Boolean));
  };
  draw();
  return h('div', { class: 'screen' }, topBar('All quotes', () => vm.go({ name: 'home' })), body);
}

export function settingsScreen() {
  const confirmReset = () => openDialog({
    title: 'Reset progress?',
    text: `This clears your record on all ${vm.quotes.length} quotes.`,
    confirm: 'Reset', cancel: 'Cancel', danger: true,
    onConfirm: () => { vm.resetProgress(); vm.go({ name: 'home' }); },
  });
  return h('div', { class: 'screen' },
    topBar('Settings', () => vm.go({ name: 'home' })),
    h('div', { class: 'list-scroll settings' },
      h('h2', { class: 'card-title', text: 'Progress' }),
      h('p', { class: 'secondary', text: 'Clear your record on every quote and your day streak, and start again.' }),
      bigButton('Reset progress', confirmReset, { primary: false }),
      h('h2', { class: 'card-title gap-top', text: 'Your progress is saved on this device' }),
      h('p', { class: 'secondary', text: 'It stays in this browser. On iPhone, add quoted to your home screen and open it from there, so Safari never clears it.' })));
}
