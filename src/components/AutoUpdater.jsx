import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

const UPDATE_JSON_URL = import.meta.env.VITE_UPDATE_URL || 'https://matebudy.onrender.com/update.json';
const CURRENT_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

function parseVersion(version) {
  const parts = String(version || '0.0.0').split('.').map((value) => Number(value) || 0);
  return (parts[0] * 10000) + (parts[1] * 100) + (parts[2] || 0);
}

function triggerDownload(url) {
  const popup = window.open(url, '_blank', 'noopener,noreferrer');
  if (popup) return true;

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_self';
  anchor.rel = 'noopener noreferrer';
  anchor.download = 'matebudy-update.apk';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return true;
}

export default function AutoUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isAndroidBrowser = /Android/i.test(window.navigator.userAgent || '');
    if (!Capacitor.isNativePlatform() && !isAndroidBrowser) return;
    void checkForUpdate();
  }, []);

  const checkForUpdate = async () => {
    try {
      const res = await fetch(UPDATE_JSON_URL, {
        cache: 'no-store',
      });
      if (!res.ok) return;

      const data = await res.json();
      if (!data?.url) {
        setUpdateAvailable(false);
        setUpdateInfo(null);
        return;
      }

      if (parseVersion(data.version) > parseVersion(CURRENT_VERSION)) {
        setUpdateAvailable(true);
        setUpdateInfo(data);
      } else {
        setUpdateAvailable(false);
        setUpdateInfo(null);
      }
    } catch (err) {
      console.log('Update check failed:', err?.message || err);
    }
  };

  const downloadUpdate = async () => {
    if (!updateInfo?.url) return;

    try {
      setError('');
      setDownloading(true);
      const opened = triggerDownload(updateInfo.url);
      if (!opened) {
        throw new Error('No se pudo abrir la descarga');
      }
    } catch (err) {
      setError('No se pudo abrir la descarga de la actualizacion.');
    } finally {
      window.setTimeout(() => setDownloading(false), 900);
    }
  };

  if (!updateAvailable) return null;

  return (
    <div style={{ position: 'fixed', bottom: 20, left: 20, right: 20, background: '#fff', padding: 16, borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.2)', zIndex: 9999 }}>
      <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: 16 }}>Nueva version disponible</p>
      {updateInfo?.notes && (
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#666' }}>{updateInfo.notes}</p>
      )}
      {error && (
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#b42318' }}>{error}</p>
      )}
      <button onClick={downloadUpdate} disabled={downloading} style={{ width: '100%', padding: '12px 16px', background: '#1a3f71', color: 'white', border: 'none', borderRadius: 8, cursor: downloading ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
        {downloading ? 'Abriendo descarga...' : `Descargar v${updateInfo?.version || CURRENT_VERSION}`}
      </button>
    </div>
  );
}
