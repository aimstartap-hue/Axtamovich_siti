// AXO-OPEN group — Service Worker (oddiy offline kesh)
const CACHE = "axo-open-v1";
const ASSETS = [
  "/",
  "/static/index.html",
  "/static/app.js",
  "/static/style.css",
  "/static/icon.svg",
  "/static/manifest.json",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // API va yuklamalarni keshlamaymiz — har doim tarmoqdan
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/uploads/")) {
    e.respondWith(fetch(e.request).catch(() => new Response(JSON.stringify({ error: "offline" }), { headers: { "Content-Type": "application/json" } })));
    return;
  }
  // Statik fayllar: avval kesh, keyin tarmoq (offline ishlashi uchun)
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match("/static/index.html")))
  );
});
