// Light or dark colours (Theme.kt on Android). The choice is saved in this browser.
// index.html applies a saved dark choice before the first paint; this module does the rest.

const DARK_KEY = 'quoted.dark';
const SURFACE = { light: '#FFFFFF', dark: '#14181D' };

/** Whether dark mode is on. Light if nothing is saved or storage is blocked. */
export function isDark() {
  try {
    return localStorage.getItem(DARK_KEY) === 'true';
  } catch (error) {
    console.error('Could not read the theme choice; using light', error);
    return false;
  }
}

/** Switches the page's colours, plus the browser bar colour that matches the page. */
export function applyTheme(dark) {
  const root = document.documentElement;
  if (dark) root.dataset.theme = 'dark'; else delete root.dataset.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? SURFACE.dark : SURFACE.light);
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', dark ? 'dark' : 'light');
}

/** Saves the choice and applies it straight away. */
export function setDark(dark) {
  try {
    localStorage.setItem(DARK_KEY, String(dark));
  } catch (error) {
    console.error('Could not save the theme choice', error);
  }
  applyTheme(dark);
}
