// Peerzle Service Worker for Push Notifications
// Version 2 - iOS compatibility fixes

/// <reference lib="webworker" />

import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

const SW_VERSION = 'v2';

// Take control immediately
self.skipWaiting();
clientsClaim();

// Precache assets (injected by vite-plugin-pwa)
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Handle navigation requests
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'))
);

// Cache API requests
registerRoute(
  /^https:\/\/api\./i,
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24, // 24 hours
      }),
    ],
  }),
  'GET'
);

// Listen for push events
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');

  // Wrap entire handler in waitUntil to prevent iOS from terminating early
  event.waitUntil(
    (async () => {
      let title = 'Peerzle';
      let options = {
        body: 'You have a new notification',
        icon: '/peerzle-icon-192x192.png',
        badge: '/peerzle-icon-192x192.png',
        data: {},
        tag: 'peerzle-notification',
      };

      // Try to parse the payload
      if (event.data) {
        try {
          const payload = event.data.json();
          title = payload.title || title;
          options = {
            body: payload.body || options.body,
            icon: '/peerzle-icon-192x192.png',
            badge: '/peerzle-icon-192x192.png',
            data: payload.data || {},
            tag: payload.data?.type || 'peerzle-notification',
          };
        } catch (e) {
          console.error('[SW] Failed to parse push payload:', e);
          // Continue with fallback notification
        }
      }

      return self.registration.showNotification(title, options);
    })()
  );
});

// Listen for notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');

  event.notification.close();

  const url = event.notification.data?.url || '/';
  const fullUrl = new URL(url, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a Peerzle tab open
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          // Navigate the existing tab to the notification URL
          (client as WindowClient).navigate(fullUrl);
          return (client as WindowClient).focus();
        }
      }
      // No existing tab, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(fullUrl);
      }
      return undefined;
    })
  );
});

// Handle service worker activation
self.addEventListener('activate', () => {
  console.log('[SW] Activated', SW_VERSION);
});

// Handle service worker installation
self.addEventListener('install', () => {
  console.log('[SW] Installed', SW_VERSION);
});
