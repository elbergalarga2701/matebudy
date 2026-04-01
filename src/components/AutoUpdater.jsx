import { useEffect, useState } from 'react';

const UPDATE_JSON_URL = 'https://matebudy.onrender.com/update.json';
const CURRENT_VERSION = '1.0.1';

export default function AutoUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    checkForUpdate();
  }, []);

  const checkForUpdate = async () => {
    try {
      const res = await fetch(UPDATE_JSON_URL, { 
        cache: 'no-cache',
        mode: 'cors'
      });
      if (!res.ok) return;
      const data = await res.json();
      
      const current = parseVersion(CURRENT_VERSION);
      const latest = parseVersion(data.version);
      
      if (latest > current) {
        setUpdateAvailable(true);
        setUpdateInfo(data);
      }
    } catch (e) {
      console.log('Update check failed:', e.message);
    }
  };

  const parseVersion = (v) => {
    const parts = v.split('.').map(Number);
    return parts[0] * 10000 + parts[1] * 100 + (parts[2] || 0);
  };

  const downloadUpdate = async () => {
    if (!updateInfo?.url) return;
    try {
      setDownloading(true);
      const res = await fetch(updateInfo.url, { mode: 'cors' });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'matebudy-update.apk';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download error:', e);
    } finally {
      setDownloading(false);
    }
  };

  if (!updateAvailable) return null;

  return (
    <div style={{ position: 'fixed', bottom: 20, left: 20, right: 20, background: '#fff', padding: 16, borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.2)', zIndex: 9999 }}>
      <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: 16 }}>Nueva versión disponible</p>
      {updateInfo?.notes && (
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#666' }}>{updateInfo.notes}</p>
      )}
      <button onClick={downloadUpdate} disabled={downloading} style={{ width: '100%', padding: '12px 16px', background: '#1a3f71', color: 'white', border: 'none', borderRadius: 8, cursor: downloading ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
        {downloading ? 'Descargando...' : `Descargar v${updateInfo?.version || '1.0.1'}`}
      </button>
    </div>
  );
}