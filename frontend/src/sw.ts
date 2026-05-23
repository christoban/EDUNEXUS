/// <reference lib="webworker" />

import { CacheFirst, NetworkFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{
    url: string;
    revision?: string;
  }>;
};

clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  ({ url }) => url.origin === "https://fonts.googleapis.com",
  new CacheFirst({
    cacheName: "google-fonts-cache",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
    ],
  })
);

registerRoute(
  ({ url }) => url.pathname.startsWith("/api/classes"),
  new NetworkFirst({
    cacheName: "classes-cache",
    networkTimeoutSeconds: 3,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24,
      }),
    ],
  })
);

registerRoute(
  ({ url }) => url.pathname.startsWith("/api/users"),
  new NetworkFirst({
    cacheName: "users-cache",
    networkTimeoutSeconds: 3,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 60 * 60 * 24,
      }),
    ],
  })
);
