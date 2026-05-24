const CACHE_NAME = "labeouf-shell-v1";

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#1d9bf0" />
  <title>LaBeouf — Offline</title>
  <style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #0a0a0a; color: #e7edf3; font-family: system-ui, sans-serif; text-align: center; padding: 24px; }
  h1 { color: #1d9bf0; margin: 0 0 12px; font-size: 1.5rem; }
  p { color: #94a3b8; max-width: 320px; line-height: 1.5; margin: 0 auto 20px; }
  button { background: #1d9bf0; color: #fff; border: none; border-radius: 9999px;
    padding: 10px 20px; font-weight: 700; cursor: pointer; font-size: 14px; }
  </style>
</head>
<body>
  <div>
    <h1>You're offline</h1>
    <p>LaBeouf can't reach the network right now. Reconnect and try again — cached pages may still load.</p>
    <button onclick="location.reload()">Try again</button>
  </div>
</body>
</html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        if (request.mode === "navigate") {
          const shell = (await caches.match("/index.html")) || (await caches.match("/"));
          if (shell) return shell;
          return new Response(OFFLINE_HTML, {
            status: 503,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }

        return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
      }),
  );
});

// Push notifications (merged from push-sw.js)
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() };
  }

  const title = payload.title || "LaBeouf";
  const options = {
    body: payload.body || "You have a new notification.",
    data: payload.data || {},
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/"));
});
