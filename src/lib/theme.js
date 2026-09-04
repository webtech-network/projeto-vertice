import { upsertUiPreferences } from '@/lib/uiPreferences';

export const THEME_STORAGE_KEY = 'canvastools:theme';
export const THEMES = ['light', 'dark', 'system'];

// 'system' means "no explicit choice" — no data-theme attribute, so
// globals.css's @media (prefers-color-scheme) block decides. See that
// file's own comment on the theme block for how 'light'/'dark' override it.
export function getStoredTheme() {
  if (typeof window === 'undefined') return 'system';
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return THEMES.includes(stored) ? stored : 'system';
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') {
    root.setAttribute('data-theme', theme);
  } else {
    root.removeAttribute('data-theme');
  }
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  upsertUiPreferences({ theme }).catch(() => {});
}

// Inlined verbatim into a beforeInteractive <Script> in layout.jsx (must be
// a plain string, not an imported function call, since that script tag runs
// before any app JS — including this module — is loaded) so the stored
// preference applies before first paint and there's no flash of the wrong
// theme. Keep this in sync with THEME_STORAGE_KEY above by hand.
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var t = localStorage.getItem('${THEME_STORAGE_KEY}');
    if (t === 'light' || t === 'dark') {
      document.documentElement.setAttribute('data-theme', t);
    }
  } catch (e) {}
})();
`;
