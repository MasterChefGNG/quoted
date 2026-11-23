// Saved progress, kept in this browser's localStorage (the web version of ProgressStore and StudyStore).
// Every read and write is guarded: private browsing or blocked storage must never break the app.

const RECORDS_KEY = 'quoted.records';
const STREAK_KEY = 'quoted.streak';
const INSTALL_HINT_KEY = 'quoted.installHintDismissed';

function read(key, fallback, isValid) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const value = JSON.parse(raw);
    if (isValid(value)) return value;
    console.error(`Saved ${key} was not in the expected shape; starting fresh`);
  } catch (error) {
    console.error(`Saved ${key} could not be read; starting fresh`, error);
  }
  return fallback;
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Could not save ${key}`, error);
    return false;
  }
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isCount = (v) => Number.isInteger(v) && v >= 0;

function isRecord(r) {
  return isObject(r) && isCount(r.seen) && isCount(r.correct) && isCount(r.streak) &&
    (r.lastCorrect === null || typeof r.lastCorrect === 'boolean') &&
    (r.lastSeenDay === null || Number.isInteger(r.lastSeenDay));
}

/** Per-quote records keyed by quote id. Any record that doesn't look right is dropped, not trusted. */
export function loadRecords() {
  const raw = read(RECORDS_KEY, {}, isObject);
  return Object.fromEntries(Object.entries(raw).filter(([, r]) => isRecord(r)));
}

export const saveRecords = (records) => write(RECORDS_KEY, records);

export const loadStreak = () => read(STREAK_KEY, { lastDay: null, days: 0 },
  (s) => isObject(s) && isCount(s.days) && (s.lastDay === null || Number.isInteger(s.lastDay)));

export const saveStreak = (streak) => write(STREAK_KEY, streak);

export function resetAll() {
  try {
    localStorage.removeItem(RECORDS_KEY);
    localStorage.removeItem(STREAK_KEY);
  } catch (error) {
    console.error('Could not clear saved progress', error);
  }
}

const UPDATE_SEEN_KEY = 'quoted.lastSeenUpdate';

export const lastSeenUpdate = () => read(UPDATE_SEEN_KEY, null, (v) => typeof v === 'string');
export const markUpdateSeen = (id) => write(UPDATE_SEEN_KEY, id);

/** Any sign this browser had used the app before: saved progress, a streak, or a dismissed tip. */
export function hasUsedAppBefore() {
  try {
    return [RECORDS_KEY, STREAK_KEY, INSTALL_HINT_KEY].some((key) => localStorage.getItem(key) !== null);
  } catch (error) {
    console.error('Could not check saved data', error);
    return false;
  }
}

export const installHintDismissed = () => read(INSTALL_HINT_KEY, false, (v) => typeof v === 'boolean');
export const dismissInstallHint = () => write(INSTALL_HINT_KEY, true);

/** Asks the browser not to clear our storage when space runs low. Harmless if refused. */
export function askToKeepStorage() {
  navigator.storage?.persist?.().catch((error) => console.error('Storage persist request failed', error));
}
