// The Weekly Table: lets the app open from the home screen, and still show itself without signal.
// Always asks the server first, so a new version appears straight away; saved copies are only a fallback.
const CACHE = "wt-v2";
const SHELL = ["/", "/app.css", "/app.js", "/manifest.webmanifest", "/icons/favicon.svg", "/icons/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    // Your meals, recipes and pictures always come live from the server.
    if (url.pathname.startsWith("/api/") || url.pathname === "/mcp" || url.pathname === "/backup.tar" || url.pathname === "/sw.js") return;
    const key = req.mode === "navigate" ? "/" : req;
    e.respondWith(
      fetch(req)
        .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); } return res; })
        .catch(() => caches.match(key).then((hit) => hit || Response.error()))
    );
    return;
  }
  // Fonts never change, so the saved copy is used first.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; }))
    );
  }
});
