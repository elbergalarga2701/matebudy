import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export async function registerMatebudyServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      updateViaCache: 'none',
    });
    await registration.update().catch(() => null);
    return registration;
  } catch (error) {
    return null;
  }
}

export function getNotificationPermissionState() {
  if (Capacitor.isNativePlatform()) return 'prompt';
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

export async function requestMatebudyNotifications() {
  if (Capacitor.isNativePlatform()) {
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
  if (Capacitor.isNativePlatform()) {
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
