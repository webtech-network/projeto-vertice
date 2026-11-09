// Painel de Cursos (CourseBrowser.jsx) view state kept in sessionStorage, so
// coming back from a drill-down page (correção, avaliação por pares,
// importação de questões — via BackButton or the system back gesture) lands
// on the list exactly as it was: same filters/sort, same course expanded,
// same tab. Per tab and per session on purpose — a new session starts on the
// defaults. See specs/platform/routing-and-shell.md ("Navegação de retorno").

const KEY = 'vertice:courseBrowser';

export function readCourseBrowserState() {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeCourseBrowserState(state) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Private mode / storage blocked: the list just starts on its defaults.
  }
}
