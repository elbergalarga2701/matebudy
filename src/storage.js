import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const canUseLocalStorage = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
const isNative = Capacitor.isNativePlatform();

export async function getStoredItem(key) {
  if (canUseLocalStorage) {
    const localValue = window.localStorage.getItem(key);
    if (localValue !== null) {
      return localValue;
    }
  }

  if (!isNative) {
    return null;
  }

  const { value } = await Preferences.get({ key });
  if (value !== null && canUseLocalStorage) {
    window.localStorage.setItem(key, value);
  }
  return value ?? null;
}

export async function setStoredItem(key, value) {
  const normalized = value == null ? '' : String(value);
  if (canUseLocalStorage) {
    window.localStorage.setItem(key, normalized);
  }
  if (isNative) {
    await Preferences.set({ key, value: normalized });
  }
}

export async function removeStoredItem(key) {
  if (canUseLocalStorage) {
    window.localStorage.removeItem(key);
  }
  if (isNative) {
    await Preferences.remove({ key });
  }
}

export async function syncStoredItems(keys) {
  await Promise.all(
    keys.map(async (key) => {
      const value = await getStoredItem(key);
      if (value !== null && canUseLocalStorage) {
        window.localStorage.setItem(key, value);
      }
    }),
  );
}
