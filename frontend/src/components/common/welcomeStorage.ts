/** Session storage for welcome modal dismissal (PRD v6). Kept in a separate file for react-refresh/only-export-components. */

const SESSION_STORAGE_KEY = 'photowalker_welcome_dismissed';

export function getWelcomeDismissed(): boolean {
  try {
    return sessionStorage.getItem(SESSION_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setWelcomeDismissed(): void {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, '1');
  } catch {
    // ignore
  }
}
