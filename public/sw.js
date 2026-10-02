/* SearchMeta service worker: push notifications */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = { title: "SearchMeta", body: "New match", url: "/alerts" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      // The card's own photo is the thumbnail (and the large picture where the phone supports one).
      icon: data.image || "/icons/192?v=2",
      badge: "/icons/192?v=2",
      image: data.image || undefined,
      tag: data.tag,
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/alerts";
  event.waitUntil(self.clients.openWindow(url));
});
