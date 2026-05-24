/**
 * @deprecated Push handlers moved to /sw.js.
 * Kept only so stale registrations can be cleaned up; do not register this file.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    self.registration.unregister().then(() => self.clients.matchAll()).then((clients) => {
      clients.forEach((client) => client.navigate(client.url));
    }),
  );
});
