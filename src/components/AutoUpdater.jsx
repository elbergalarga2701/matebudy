import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

const UPDATE_JSON_URL = import.meta.env.VITE_UPDATE_URL || 'https://matebudy.onrender.com/update.json';
const CURRENT_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

function parseVersion(version) {
  const parts = String(version || '0.0.0').split('.').map((value) => Number(value) || 0);
  return (parts[0] * 10000) + (parts[1] * 100) + (parts[2] || 0);
}

function isNativePlatform() {
  if (typeof window === 'undefined') return false;
  return Capacitor.isNativePlatform()
    || window.location.protocol === 'capacitor:'
    || window.location.protocol === 'ionic:'
    || /Android/i.test(window.navigator.userAgent || '');
}

function triggerAutoReload() {
  if (isNativePlatform()) {
    window.location.reload();
    return true;
  }
  window.location.reload();
  return true;
}

export default function AutoUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isNativePlatform()) return;

    void checkForUpdate();

    // Check periódico cada 60 segundos
    const intervalId = window.setInterval(() => {
      void checkForUpdate();
    }, 60000);

    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  const checkForUpdate = async () => {
    try {
      const res = await fetch(UPDATE_JSON_URL, {
        cache: 'no-store',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!res.ok) {
        return;
      }

      const data = await res.json();

      if (!data?.url || !data?.version) {
        return;
      }

      const isUpdateAvailable = parseVersion(data.version) > parseVersion(CURRENT_VERSION);

      if (isUpdateAvailable) {
        setUpdateAvailable(true);
        setUpdateInfo(data);

        // Auto-reload después de 2 segundos
        window.setTimeout(() => {
          triggerAutoReload();
        }, 2000);
      }
    } catch (err) {
      // Silencioso - no mostrar errores al usuario
    }
  };

  // Solo mostrar si hay actualización disponible
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
