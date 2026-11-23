// The "Latest update" screen, shown once after each update.
// To announce a new update: give LATEST_UPDATE a new `id` and new notes, and bump VERSION in sw.js.
import { h, bigButton, mascot } from './ui.js';
import * as store from './store.js';

export const LATEST_UPDATE = {
  id: '2026-11-23-dark-mode',
  date: '23 November 2026',
  notes: [
    'Dark mode: turn it on in Settings, under Appearance.',
  ],
};

/**
 * Whether to show the screen: only if this update hasn't been seen yet, and only to someone who used
 * the app before it (a brand-new user has nothing to compare against, so it's marked seen quietly).
 */
export function shouldShowUpdate() {
  if (store.lastSeenUpdate() === LATEST_UPDATE.id) return false;
  if (!store.hasUsedAppBefore()) {
    store.markUpdateSeen(LATEST_UPDATE.id);
    return false;
  }
  return true;
}

/** Full-screen notice over the app, with the quoted mascot bobbing next to the heading. */
// Added to <body> rather than the overlay layer, so redrawing a screen never removes it unseen.
export function showUpdateScreen(parent = document.body) {
  const close = () => {
    store.markUpdateSeen(LATEST_UPDATE.id);
    screen.classList.remove('open');
    setTimeout(() => screen.remove(), 220);
  };
  const screen = h('div', { class: 'update-screen', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'update-title' },
    h('div', { class: 'update-body' },
      h('div', { class: 'update-head' },
        h('div', { class: 'update-mascot' }, mascot(84)),
        h('div', {},
          h('h1', { class: 'title', id: 'update-title', text: 'Latest update' }),
          h('p', { class: 'secondary', text: LATEST_UPDATE.date }))),
      h('ul', { class: 'update-notes' }, LATEST_UPDATE.notes.map((note) => h('li', { class: 'body', text: note })))),
    h('div', { class: 'bottom-bar' }, bigButton('Got it', close)));
  parent.append(screen);
  requestAnimationFrame(() => screen.classList.add('open'));
}
