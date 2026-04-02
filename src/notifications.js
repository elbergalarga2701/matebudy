import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const SERVICE_WORKER_PATH = '/service-worker.js';
const SERVICE_WORKER_ENABLED = import.meta.env.VITE_ENABLE_SERVICE_WORKER === 'true';
const CACHE_PREFIXES = ['matebudy-', 'workbox-'];

function isNativePlatform() {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform();
}

async function unregisterMatebudyServiceWorkers() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return 0;

  const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
  let removed = 0;

  await Promise.all(registrations.map(async (registration) => {
    const scriptUrl = registration.active?.scriptURL || registration.waiting?.scriptURL || registration.installing?.scriptURL || '';
    if (!scriptUrl || !scriptUrl.includes('service-worker.js')) return;

    const didUnregister = await registration.unregister().catch(() => false);
    if (didUnregister) {
      removed += 1;
    }
  }));

  return removed;
}

async function clearMatebudyCaches() {
  if (typeof caches === 'undefined') return 0;

  const cacheNames = await caches.keys().catch(() => []);
  const staleCacheNames = cacheNames.filter((cacheName) => CACHE_PREFIXES.some((prefix) => cacheName.startsWith(prefix)));

  await Promise.all(staleCacheNames.map((cacheName) => caches.delete(cacheName).catch(() => false)));
  return staleCacheNames.length;
}

export async function registerMatebudyServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || isNativePlatform()) return null;

  if (!SERVICE_WORKER_ENABLED) {
    await Promise.allSettled([
      unregisterMatebudyServiceWorkers(),
      clearMatebudyCaches(),
    ]);
    return null;
  }

  try {
    await clearMatebudyCaches().catch(() => null);
    const registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH, {
      updateViaCache: 'none',
    });
    await registration.update().catch(() => null);
    return registration;
  } catch (error) {
    return null;
  }
}

export function getNotificationPermissionState() {
  if (isNativePlatform()) return 'prompt';
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

export async function requestMatebudyNotifications() {
  if (isNativePlatform()) {
    try {
      const current = await LocalNotifications.checkPermissions();
      if (current.display === 'granted') return 'granted';
      const requested = await LocalNotifications.requestPermissions();
      return requested.display || 'prompt';
    } catch (error) {
      return 'unsupported';
    }
  }

  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  return Notification.requestPermission();
}

export async function showMatebudyNotification({ title, body, tag, url = '/' }) {
  if (isNativePlatform()) {
    try {
      const permissions = await LocalNotifications.checkPermissions();
      if (permissions.display !== 'granted') return false;

      await LocalNotifications.schedule({
        notifications: [
          {
            id: Date.now(),
            title,
            body,
            schedule: { at: new Date(Date.now() + 350) },
            extra: { url, tag },
          },
        ],
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;

  const registration = await navigator.serviceWorker?.getRegistration().catch(() => null);
  const options = {
    body,
    tag,
    data: url,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
  };

  if (registration?.showNotification) {
    await registration.showNotification(title, options);
    return true;
  }

  new Notification(title, options);
  return true;
}

export async function sendMatebudyTestNotification() {
  const permission = await requestMatebudyNotifications();
  if (permission !== 'granted') return false;

  return showMatebudyNotification({
    title: 'MateBudy',
    body: 'Las notificaciones ya estan funcionando en este dispositivo.',
    tag: 'matebudy-test',
    url: '/#/perfil',
  });
}

export async function forceAppReload() {
  if (typeof window === 'undefined') return false;

  await Promise.allSettled([
    unregisterMatebudyServiceWorkers(),
    clearMatebudyCaches(),
  ]);

  const targetUrl = new URL(window.location.href);
  targetUrl.searchParams.set('matebudy_reload', String(Date.now()));
  window.location.replace(targetUrl.toString());
  return true;
}
