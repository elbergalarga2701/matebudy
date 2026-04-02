import { useEffect, useState } from 'react';
import packageJson from '../../package.json';
import { runtimeIsNativePlatform, updateManifestUrl } from '../api';
import { forceAppReload } from '../notifications';

const UPDATE_JSON_URL = updateManifestUrl();
const CURRENT_VERSION = import.meta.env.VITE_APP_VERSION || packageJson.version || '1.0.0';
const BUILD_ID_STORAGE_KEY = 'matebudy:last-seen-build-id';
const RELOAD_TOKEN_STORAGE_KEY = 'matebudy:last-reloaded-build-token';

function parseVersion(version) {
  const parts = String(version || '0.0.0').split('.').map((value) => Number(value) || 0);
  return (parts[0] * 10000) + (parts[1] * 100) + (parts[2] || 0);
}

function readStorage(storage, key) {
  try {
    return storage.getItem(key) || '';
  } catch {
    return '';
  }
}

function writeStorage(storage, key, value) {
  try {
    if (value) {
      storage.setItem(key, value);
    }
  } catch {
    // Ignore storage failures in restricted webviews.
  }
}

function resolveReloadToken(updateInfo) {
  return String(updateInfo?.buildId || updateInfo?.version || '').trim();
}

export default function AutoUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!runtimeIsNativePlatform()) return undefined;

    const checkForUpdate = async () => {
      try {
        const res = await fetch(UPDATE_JSON_URL, {
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
          },
        });

        if (!res.ok) {
          return;
        }

        const data = await res.json();

        if (!data?.url || !data?.version) {
          return;
        }

        const previousBuildId = readStorage(window.localStorage, BUILD_ID_STORAGE_KEY);
        const nextBuildId = String(data.buildId || '').trim();
        const isVersionUpdate = parseVersion(data.version) > parseVersion(CURRENT_VERSION);
        const isBuildUpdate = Boolean(nextBuildId && previousBuildId && nextBuildId !== previousBuildId);
        const isUpdateDetected = isVersionUpdate || isBuildUpdate;

        if (nextBuildId) {
          writeStorage(window.localStorage, BUILD_ID_STORAGE_KEY, nextBuildId);
        }

        if (!isUpdateDetected) {
          setUpdateAvailable(false);
          setUpdateInfo(null);
          return;
        }

        setUpdateAvailable(true);
        setUpdateInfo(data);

        const reloadToken = resolveReloadToken(data);
        const lastReloadedToken = readStorage(window.sessionStorage, RELOAD_TOKEN_STORAGE_KEY);

        if (reloadToken && reloadToken !== lastReloadedToken) {
          writeStorage(window.sessionStorage, RELOAD_TOKEN_STORAGE_KEY, reloadToken);
          window.setTimeout(() => {
            void forceAppReload();
          }, 2000);
        }
      } catch {
        // Keep update checks silent.
      }
    };

    void checkForUpdate();

    const intervalId = window.setInterval(() => {
      void checkForUpdate();
    }, 60000);

    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  if (!updateAvailable) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 80,
      left: 20,
      right: 20,
      background: '#fff',
      padding: 16,
      borderRadius: 12,
      boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
      zIndex: 9999,
      border: '2px solid #10b981',
    }}>
      <p style={{ margin: '0 0 12px', fontWeight: 600, fontSize: 14, color: '#10b981' }}>
        Nueva version disponible
      </p>
      {updateInfo?.notes && (
        <p style={{ margin: '0 0 12px', fontSize: 12, color: '#666' }}>{updateInfo.notes}</p>
      )}
      <p style={{ margin: 0, fontSize: 11, color: '#10b981' }}>
        Recargando automaticamente...
      </p>
    </div>
  );
}
