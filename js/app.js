// Entry point: draws the current screen, handles the back gesture/button, and registers the offline worker.
import { vm, setRenderer } from './state.js';
import { setOverlayRoot, closeOverlays, openDialog } from './ui.js';
import { homeScreen } from './home.js';
import { testScreen } from './test-screen.js';
import { learnScreen, learnDoneScreen } from './learn.js';
import { summaryScreen, quoteListScreen, settingsScreen } from './other-screens.js';
import { askToKeepStorage } from './store.js';
import { shouldShowUpdate, showUpdateScreen, showNoticeScreen } from './updates.js';
import { isDark, applyTheme } from './theme.js';

const root = document.getElementById('app');
setOverlayRoot(document.getElementById('overlays'));

/** Set once a new version of the app has taken over in the background (see the bottom of this file). */
let updateReady = false;

/** Reloads into the new version, but only on Home so a session in progress is never cut off. */
function reloadIfUpdated() {
  if (updateReady && vm.screen.name === 'home') location.reload();
}

function build(screen) {
  switch (screen.name) {
    case 'home': return homeScreen();
    case 'list': return quoteListScreen();
    case 'settings': return settingsScreen();
    case 'test': return testScreen(screen.session);
    case 'summary': return summaryScreen(screen);
    case 'learn': return learnScreen(screen);
    case 'learnDone': return learnDoneScreen(screen);
    default: throw new Error(`Unknown screen ${screen.name}`);
  }
}

function render(screen) {
  if (screen.name === 'home' && updateReady) {
    reloadIfUpdated();
    return;
  }
  closeOverlays();
  root.replaceChildren(build(screen));
  // One history entry while away from Home, so the back gesture/button returns there (as on Android).
  if (screen.name === 'home') {
    if (history.state?.away) history.back();
  } else if (!history.state?.away) {
    history.pushState({ away: true }, '');
  }
}

window.addEventListener('popstate', () => {
  const name = vm.screen.name;
  if (name === 'home') return;
  if (name === 'test') {
    // Back during a test asks first, like the Android app.
    history.pushState({ away: true }, '');
    openDialog({
      title: 'Stop this session?', text: 'Answers so far are saved.',
      confirm: 'Stop', cancel: 'Keep going', onConfirm: () => vm.go({ name: 'home' }),
    });
    return;
  }
  vm.screen = { name: 'home' };
  if (updateReady) {
    reloadIfUpdated();
    return;
  }
  closeOverlays();
  root.replaceChildren(homeScreen());
});

// The day can change while the app sits open; redraw Home when it comes back into view.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && vm.screen.name === 'home') render(vm.screen);
});

setRenderer(render);
history.replaceState({ away: false }, '');
applyTheme(isDark());
render(vm.screen);
if (shouldShowUpdate()) showUpdateScreen(showNoticeScreen); else showNoticeScreen();
askToKeepStorage();

// ---------- Offline support and updates ----------
// A new version downloads in the background. Once it's ready the app reloads itself, but only on Home,
// so nobody loses a half-typed answer: mid-session it waits until they're back on Home.
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  // On the very first visit the worker takes control once just to set up offline mode: not an update.
  let controlled = navigator.serviceWorker.controller !== null;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!controlled) { controlled = true; return; }
    if (updateReady) return;
    updateReady = true;
    reloadIfUpdated();
  });
  navigator.serviceWorker.register('./sw.js')
    .then((registration) => {
      // A home-screen app often resumes instead of relaunching, so check for updates on resume too.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        registration.update().catch((error) => console.error('Update check failed', error));
      });
    })
    .catch((error) => console.error('Offline support failed to start', error));
}
