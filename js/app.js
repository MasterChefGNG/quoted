// Entry point: draws the current screen, handles the back gesture/button, and registers the offline worker.
import { vm, setRenderer } from './state.js';
import { setOverlayRoot, closeOverlays, openDialog } from './ui.js';
import { homeScreen } from './home.js';
import { testScreen } from './test-screen.js';
import { learnScreen, learnDoneScreen } from './learn.js';
import { summaryScreen, quoteListScreen, settingsScreen } from './other-screens.js';
import { askToKeepStorage } from './store.js';

const root = document.getElementById('app');
setOverlayRoot(document.getElementById('overlays'));

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
  closeOverlays();
  root.replaceChildren(homeScreen());
});

// The day can change while the app sits open; redraw Home when it comes back into view.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && vm.screen.name === 'home') render(vm.screen);
});

setRenderer(render);
history.replaceState({ away: false }, '');
render(vm.screen);
askToKeepStorage();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch((error) => console.error('Offline support failed to start', error));
}
