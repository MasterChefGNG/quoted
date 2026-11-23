// Home (4 swipe pages), session setup sheet and the weak-quotes mode picker (HomeScreen.kt, SetupSheet.kt).
import * as d from './domain.js';
import { vm, MODE_LIST } from './state.js';
import { h, icon, mascot, bigButton, card, toggleChip, progressBar, label, openSheet } from './ui.js';
import * as store from './store.js';

/** Titles of the extra swipe pages after the Hamlet page. Null = untitled. They are empty for now. */
const EXTRA_PAGES = ['Poems', 'Texts', null];
const COUNTS = [5, 10, 20, null]; // null = all
const DEFAULT_COUNT = 10;
/** Learning a quote takes longer than testing it, so Learn starts with fewer. */
const LEARN_DEFAULT_COUNT = 5;

let savedPage = 0;

export function homeScreen() {
  const pages = h('div', { class: 'pager' }, hamletPage(), EXTRA_PAGES.map(emptyPage));
  const dots = h('div', { class: 'dots', 'aria-label': `Page 1 of ${1 + EXTRA_PAGES.length}` },
    [0, ...EXTRA_PAGES].map(() => h('span', { class: 'dot' })));
  const showDot = (page) => {
    [...dots.children].forEach((dot, i) => dot.classList.toggle('on', i === page));
    dots.setAttribute('aria-label', `Page ${page + 1} of ${dots.children.length}`);
  };
  pages.addEventListener('scroll', () => {
    savedPage = Math.round(pages.scrollLeft / pages.clientWidth);
    showDot(savedPage);
  }, { passive: true });
  showDot(savedPage);
  requestAnimationFrame(() => { pages.scrollLeft = savedPage * pages.clientWidth; });
  return h('div', { class: 'screen home' }, pages, dots);
}

/** A blank page with only a title, left for adding things later. */
const emptyPage = (title) => h('section', { class: 'page' }, title ? h('h1', { class: 'hero page-title', text: title }) : null);

function hamletPage() {
  const total = vm.quotes.length;
  const mastered = vm.quotes.filter((q) => d.isMastered(vm.record(q.id))).length;
  const weak = vm.weakIds().length;
  const today = d.epochDay();

  const scroll = h('div', { class: 'page-scroll' },
    h('div', { class: 'home-top' },
      h('div', { class: 'brand', text: 'quoted' }),
      streakBadge(d.currentStreak(vm.streak, today), d.studiedOn(vm.streak, today)),
      h('button', { type: 'button', class: 'settings-button raised', 'aria-label': 'Settings', onClick: () => vm.go({ name: 'settings' }) },
        icon('sliders', 30))),
    installHint(),
    h('div', { class: 'hero-mascot' }, mascot(120)),
    h('h1', { class: 'hero center', text: 'Ready to rehearse?' }),
    h('p', { class: 'secondary center', text: `Hamlet · ${total} quotes · Acts 1–3` }),
    h('div', { class: 'mastered-row' },
      h('span', { class: 'body strong', text: 'Mastered' }),
      h('span', { class: 'secondary strong', text: `${mastered} of ${total}` })),
    progressBar(mastered / total),
    label('Learn', 'section-gap'),
    learnCard(),
    label('Test yourself', 'section-gap'),
    h('div', { class: 'stack' }, MODE_LIST.map((mode) => modeCard(mode, () => openSetup(mode.title, DEFAULT_COUNT,
      (filter, count) => vm.start(mode, filter, count))))),
    h('button', { type: 'button', class: 'text-link center', text: 'All quotes', onClick: () => vm.go({ name: 'list' }) }));

  return h('section', { class: 'page' }, scroll,
    h('div', { class: 'bottom-bar' },
      bigButton(weak > 0 ? 'Practise weak quotes' : 'No weak quotes', openModePicker,
        { enabled: weak > 0, badge: weak > 0 ? weak : null })));
}

/** On iPhone, tells the user how to add the app to the home screen (only in the browser, until dismissed). */
function installHint() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (standalone || store.installHintDismissed()) return null;
  const isApple = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const how = isApple
    ? 'Tap the Share button, then "Add to Home Screen".'
    : 'Open the browser menu, then "Add to Home screen" or "Install app".';
  const box = h('div', { class: 'install-hint' },
    h('div', { class: 'body strong', text: 'Add quoted to your home screen' }),
    h('div', { class: 'secondary', text: `${how} It then opens like an app and keeps your progress safe.` }),
    h('button', {
      type: 'button', class: 'text-link', text: 'Got it',
      onClick: () => { store.dismissInstallHint(); box.remove(); },
    }));
  return box;
}

/** The way into the fade-out drill, in pale green so it stands apart from the test modes. */
const learnCard = () => card([
  h('span', { class: 'card-icon' }, icon('book', 40)),
  h('span', { class: 'card-text' },
    h('span', { class: 'card-title', text: 'Learn quotes' }),
    h('span', { class: 'secondary green-text', text: 'Read them, then hide words until you know them' })),
], { cls: 'mode-card learn-card', onClick: () => openSetup('Learn', LEARN_DEFAULT_COUNT, (f, c) => vm.startLearn(f, c)) });

/** Day streak: the flame lights up once today's session is done, and stays grey until then. */
function streakBadge(days, doneToday) {
  let description = `${days}-day streak, not done today yet`;
  if (days === 0) description = 'No streak yet';
  else if (doneToday) description = `${days}-day streak, done today`;
  return h('div', { class: doneToday ? 'streak done' : 'streak', role: 'img', 'aria-label': description },
    icon('flame', 24), h('span', { text: String(days) }));
}

export const modeCard = (mode, onClick) => card([
  h('span', { class: 'card-icon' }, icon(mode.icon, 40)),
  h('span', { class: 'card-text' },
    h('span', { class: 'card-title', text: mode.title }),
    h('span', { class: 'secondary', text: mode.subtitle })),
], { cls: 'mode-card', onClick });

/** Session setup: how many quotes and optional act/speaker/theme filters. */
function openSetup(title, defaultCount, onStart) {
  openSheet((close) => {
    let count = defaultCount;
    let filter = d.emptyFilter();
    const countRow = h('div', { class: 'chip-flow' });
    const filters = h('div');
    const note = h('p', { class: 'secondary sheet-note' });
    const startSlot = h('div');

    const refresh = () => {
      countRow.replaceChildren(...COUNTS.map((c) => toggleChip(c === null ? 'All' : String(c), count === c,
        () => { count = c; refresh(); })));
      filters.replaceChildren(...filterSections(filter, (f) => { filter = f; refresh(); }));
      const matching = vm.matching(filter).length;
      let text = null;
      if (matching === 0) text = 'No quotes match these filters';
      else if (!d.filterIsEmpty(filter) && (count === null || matching < count)) text = `${matching} quotes match`;
      note.textContent = text ?? '';
      note.hidden = text === null;
      startSlot.replaceChildren(bigButton('Start', () => { close(); onStart(filter, count); }, { enabled: matching > 0 }));
    };
    refresh();
    return h('div', { class: 'sheet-body' },
      h('div', { class: 'sheet-scroll' },
        h('h2', { class: 'title', text: title }),
        label('How many quotes', 'sheet-section'), countRow, filters),
      note, startSlot);
  });
}

const toggle = (set, item) => {
  const out = new Set(set);
  if (out.has(item)) out.delete(item); else out.add(item);
  return out;
};

/** Act, speaker and theme filter chips, shared by session setup and the quote list. */
export function filterSections(filter, onChange) {
  const acts = [...new Set(vm.quotes.map((q) => q.act))].sort((a, b) => a - b);
  const speakers = [...new Set(vm.quotes.flatMap((q) => q.speakers))].sort();
  const themes = [...new Set(vm.quotes.flatMap((q) => q.themes))].sort();
  const group = (title, items, key, text) => [
    label(title, 'sheet-section'),
    h('div', { class: 'chip-flow' }, items.map((item) => toggleChip(text(item), filter[key].has(item),
      () => onChange({ ...filter, [key]: toggle(filter[key], item) })))),
  ];
  return [
    ...group('Act', acts, 'acts', (a) => `Act ${a}`),
    ...group('Speaker', speakers, 'speakers', (s) => s),
    ...group('Theme', themes, 'themes', (t) => t),
  ];
}

/** Which mode to use for a "Practise weak quotes" session. */
function openModePicker() {
  openSheet((close) => h('div', { class: 'sheet-body' },
    h('div', { class: 'sheet-scroll stack' },
      h('h2', { class: 'title', text: 'Practise weak quotes' }),
      h('p', { class: 'secondary', text: 'Pick a mode' }),
      MODE_LIST.map((mode) => modeCard(mode, () => { close(); vm.startWeak(mode); })))));
}
