import api from './api';

// VAPID public key - matches server config
// This will be fetched from the server on first use
let vapidPublicKey: string | null = null;

/**
 * Check if push notifications are supported in this browser.
 */
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Get the current notification permission state.
 */
export function getNotificationPermission(): NotificationPermission {
  return Notification.permission;
}

/**
 * Check if push notifications are already enabled (permission granted + subscribed).
 */
export async function isPushEnabled(): Promise<boolean> {
  if (!isPushSupported()) return false;
  if (Notification.permission !== 'granted') return false;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return false;

    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch {
    return false;
  }
}

/**
 * Request notification permission from the user.
 * Returns the resulting permission state.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) {
    console.error('[PUSH] Push notifications not supported');
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Fetch the VAPID public key from the server.
 */
async function getVapidPublicKey(): Promise<string> {
  if (vapidPublicKey) return vapidPublicKey;

  const response = await api.get<{ publicKey: string }>('/api/push/vapid-public-key');
  vapidPublicKey = response.data.publicKey;
  return vapidPublicKey;
}

/**
 * Convert a base64 string to Uint8Array (for VAPID key).
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray as Uint8Array<ArrayBuffer>;
}

/**
 * Register the service worker and subscribe to push notifications.
 * This sends the subscription to the backend.
 */
export async function subscribeToPush(): Promise<boolean> {
  if (!isPushSupported()) {
    console.error('[PUSH] Push notifications not supported');
    return false;
  }

  if (Notification.permission !== 'granted') {
    console.error('[PUSH] Notification permission not granted');
    return false;
  }

  try {
    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('[PUSH] Service Worker registered');

    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready;

    // Get VAPID public key from server
    const publicKey = await getVapidPublicKey();

    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    console.log('[PUSH] Push subscription created');

    // Send subscription to backend
    const subscriptionJson = subscription.toJSON();
    await api.post('/api/push/subscribe', {
      endpoint: subscriptionJson.endpoint,
      keys: {
        p256dh: subscriptionJson.keys?.p256dh,
        auth: subscriptionJson.keys?.auth,
      },
    });

    console.log('[PUSH] Subscription saved to server');
    return true;
  } catch (error) {
    console.error('[PUSH] Subscription error:', error);
    return false;
  }
}

/**
 * Unsubscribe from push notifications.
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return true;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return true;

    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return true;

    // Unsubscribe from push
    await subscription.unsubscribe();

    // Tell backend to remove the subscription
    await api.delete('/api/push/unsubscribe', {
      data: { endpoint: subscription.endpoint },
    });

    console.log('[PUSH] Unsubscribed from push notifications');
    return true;
  } catch (error) {
    console.error('[PUSH] Unsubscribe error:', error);
    return false;
  }
}

/**
 * Send a test push notification (admin only).
 */
export async function sendTestPush(): Promise<{ success: boolean; message: string }> {
  try {
    const response = await api.post<{ success: boolean; message: string }>('/api/push/test');
    return response.data;
  } catch (error) {
    console.error('[PUSH] Test push error:', error);
    return { success: false, message: 'Failed to send test notification' };
  }
}
