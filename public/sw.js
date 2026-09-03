// Offline app-shell cache only — tasks/projects/workspaces live in Postgres
// now (not IndexedDB+Drive), so there's no client-side sync to nudge on
// reconnect anymore. Lets cached pages keep working when offline.

const SHELL_CACHE = 'canvastools-shell-v1';

// Never intercepted or cached — all four set/read the session cookie or
// return an auth-sensitive redirect. Caching any of them risks serving a
// stale redirect or a stale session-scoped response after a fresh
// login/logout.
const PASSTHROUGH_PATTERNS = [/^\/api\//, /^\/oauth2\/callback/, /^\/github\/oauth2\/callback/, /^\/google\/oauth2\/callback/];

// The App Shell — sidebar chrome (rendered inside all three) + Tarefas and
// Configurações, both already 100% local-first (IndexedDB/localStorage), so
// once their own page shell loads from cache they keep working with zero
// network. Pre-armazenado at install time instead of waiting for the
// reactive fetch-and-cache below, so a professor who's never manually
// opened /tarefas or /perfil is still covered the first time they go
// offline — this only runs once the SW is already registered (i.e. already
// logged in), so the session cookie is present for these fetches.
const SHELL_PRECACHE_URLS = ['/', '/tarefas', '/perfil'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      Promise.all(
        SHELL_PRECACHE_URLS.map((url) =>
          fetch(url)
            .then((response) => {
              // A redirect (e.g. no valid session at this exact moment)
              // means this response is actually /login's HTML — never cache
              // that under the shell route's own key.
              if (response.ok && !response.redirected) return cache.put(url, response);
            })
            .catch(() => {}), // best-effort — never let this block SW install
        ),
      ),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (PASSTHROUGH_PATTERNS.some((pattern) => pattern.test(url.pathname))) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/'))),
  );
});
