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
  // En nativo, recargar la WebView completamente
  if (isNativePlatform()) {
    window.location.reload();
    return true;
  }

  // En web, intentar service worker update
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.update();
      });
    });
  }

  window.location.reload();
  return true;
}

export default function AutoUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [checking, setChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Solo ejecutar en plataforma nativa
    if (!isNativePlatform()) return;

    // Check inmediato al iniciar
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
    if (checking) return;

    try {
      setChecking(true);
      setError('');

      const res = await fetch(UPDATE_JSON_URL, {
        cache: 'no-store',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!res.ok) {
        console.log('[AutoUpdater] Update check returned:', res.status);
        return;
      }

      const data = await res.json();

      if (!data?.url || !data?.version) {
        setUpdateAvailable(false);
        setUpdateInfo(null);
        return;
      }

      const isUpdateAvailable = parseVersion(data.version) > parseVersion(CURRENT_VERSION);

      console.log('[AutoUpdater] Version check:', {
        current: CURRENT_VERSION,
        remote: data.version,
        hasUpdate: isUpdateAvailable,
        buildId: data.buildId,
      });

      if (isUpdateAvailable) {
        setUpdateAvailable(true);
        setUpdateInfo(data);

        // Auto-reload después de 2 segundos si hay update
        window.setTimeout(() => {
          console.log('[AutoUpdater] Applying update automatically...');
          triggerAutoReload();
        }, 2000);
      } else {
        setUpdateAvailable(false);
        setUpdateInfo(null);
      }
    } catch (err) {
      console.log('[AutoUpdater] Update check failed:', err?.message || err);
      setError(err?.message || 'Error al verificar actualizacion');
    } finally {
      setChecking(false);
    }
  };

  const manualCheck = async () => {
    setError('');
    await checkForUpdate();
  };

  // Solo mostrar UI en desarrollo o si hay error
  if (!updateAvailable && !error) return null;

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <div style={{
          width: 24,
          height: 24,
          border: '3px solid #10b981',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: checking ? 'spin 1s linear infinite' : 'none',
        }}></div>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: '#10b981' }}>
          {checking ? 'Verificando actualizacion...' : updateAvailable ? 'Actualizacion disponible' : 'Sin actualizaciones'}
        </p>
      </div>

      {updateInfo?.notes && (
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#666' }}>{updateInfo.notes}</p>
      )}

      {error && (
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#b42318' }}>{error}</p>
      )}

      {updateAvailable && (
        <p style={{ margin: '8px 0 0', fontSize: 11, color: '#10b981' }}>
          Recargando automaticamente en breve...
        </p>
      )}

      <button
        onClick={manualCheck}
        disabled={checking}
        style={{
          width: '100%',
          padding: '10px 16px',
          background: checking ? '#ccc' : '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          cursor: checking ? 'not-allowed' : 'pointer',
          fontWeight: 600,
          fontSize: 13,
          marginTop: 8,
        }}
      >
        {checking ? 'Verificando...' : 'Buscar actualizacion manualmente'}
      </button>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
