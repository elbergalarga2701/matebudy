import React, { useEffect, useMemo, useState } from 'react';
import { apiUrl } from '../api';
import { useAuth } from '../AuthContext';
import { showMatebudyNotification } from '../notifications';

function formatUpdatedAt(value) {
  if (!value) return 'Sin datos recientes';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `Actualizado hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `Actualizado hace ${hours} h`;
}

export default function MonitorHub() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [lastSnapshot, setLastSnapshot] = useState({});

  const authHeaders = useMemo(() => {
    const token = localStorage.getItem('mate_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [user?.uid]);

  const loadLinks = async () => {
    const response = await fetch(apiUrl('/api/users/monitor-links'), {
      headers: {
        ...authHeaders,
      },
      credentials: 'include',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'No se pudo cargar el monitor');

    const nextLinks = data.links || [];
    setLinks(nextLinks);
    setLastSnapshot((prev) => {
      const nextSnapshot = { ...prev };

      nextLinks.forEach((link) => {
        const previous = prev[link.id];
        const becameOnline = previous && !previous.isOnline && link.target.isOnline;
        const moved = previous && previous.updatedAt && link.location?.updatedAt && previous.updatedAt !== link.location.updatedAt;

        if (becameOnline) {
          void showMatebudyNotification({
            title: `${link.target.displayName} esta activo`,
            body: 'La persona vinculada abrio la app y reporto presencia.',
            tag: `monitor-online-${link.id}`,
            url: '/#/monitor',
          });
        }

        if (moved) {
          void showMatebudyNotification({
            title: `Nueva ubicación de ${link.target.displayName}`,
            body: 'El perfil monitoreado envio una actualizacion de ubicación.',
            tag: `monitor-location-${link.id}`,
            url: '/#/monitor',
          });
        }

        nextSnapshot[link.id] = {
          isOnline: link.target.isOnline,
          updatedAt: link.location?.updatedAt || null,
        };
      });

      return nextSnapshot;
    });
  };

  useEffect(() => {
    void (async () => {
      try {
        await loadLinks();
      } catch (error) {
        setToast(error.message);
      } finally {
        setLoading(false);
      }
    })();

    const intervalId = window.setInterval(() => {
      void loadLinks().catch(() => {});
    }, 15000);
    return () => window.clearInterval(intervalId);
  }, [user?.uid]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(apiUrl(`/api/users/search?q=${encodeURIComponent(query.trim())}`), {
            headers: {
              ...authHeaders,
            },
            credentials: 'include',
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || 'No se pudo buscar perfiles');
          setResults(data.users || []);
        } catch (error) {
          setToast(error.message);
        }
      })();
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [query, user?.uid]);

  const linkTarget = async (targetUserId) => {
    try {
      const response = await fetch(apiUrl('/api/users/monitor-links'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        credentials: 'include',
        body: JSON.stringify({ targetUserId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo vincular el perfil');
      await loadLinks();
      setToast('Perfil vinculado al monitor');
      setQuery('');
      setResults([]);
    } catch (error) {
      setToast(error.message);
    }
  };

  const unlinkTarget = async (linkId) => {
    try {
      await fetch(apiUrl(`/api/users/monitor-links/${linkId}`), {
        method: 'DELETE',
        headers: {
          ...authHeaders,
        },
        credentials: 'include',
      });
      await loadLinks();
      setToast('Vinculo eliminado');
    } catch (error) {
      setToast(error.message);
    }
  };

  return (
    <div className="app-scroll" style={{ padding: '0 0 110px', minHeight: '100vh' }}>
      {toast && <div className="toast toast-success">{toast}</div>}
      <div className="page-shell page-stack">
        <section className="hero-banner">
          <div style={{ maxWidth: '640px' }}>
            <span className="badge badge-accent" style={{ marginBottom: '12px' }}>
              <i className="fa-solid fa-shield-halved"></i> Monitor y familiar
            </span>
            <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '10px' }}>Cuidado en tiempo real</h1>
            <p style={{ fontSize: '15px', lineHeight: 1.6, opacity: 0.94 }}>
              Aquí puedes vincular perfiles reales para monitorearlos. Ya no mostramos datos falsos: solo ubicación y presencia reportadas por la app.
            </p>
          </div>
        </section>

        <section className="surface-card" style={{ padding: '18px' }}>
          <div className="section-title" style={{ marginBottom: '12px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Vincular una persona</h2>
            <p style={{ fontSize: '14px' }}>Busca por nombre y conecta este monitor al perfil que quieras seguir.</p>
          </div>
          <input
            type="text"
            className="form-input"
            placeholder="Buscar por nombre o profesión"
            value={query}
            spellCheck
            autoCorrect="on"
            autoCapitalize="words"
            onChange={(e) => setQuery(e.target.value)}
          />
          {results.length > 0 && (
            <div className="list-stack" style={{ marginTop: '12px' }}>
              {results.map((entry) => (
                <div key={entry.id} className="surface-card" style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <strong style={{ display: 'block', color: 'var(--text-dark)' }}>{entry.name}</strong>
                    <span style={{ color: 'var(--text-medium)', fontSize: '13px' }}>
                      {entry.profession || 'Sin descripción'} · {entry.manualStatus?.replaceAll('_', ' ') || 'sin estado'} · {entry.isOnline ? 'activo ahora' : 'sin presencia ahora'}
                    </span>
                  </div>
                  <button type="button" className="pill-button pill-button-primary" onClick={() => void linkTarget(entry.id)}>Vincular</button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="page-stack">
          {loading ? (
            <div className="empty-state">
              <div className="empty-state-icon"><i className="fa-solid fa-spinner fa-spin"></i></div>
              <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>Cargando monitor</h3>
              <p style={{ color: 'var(--text-medium)', lineHeight: 1.6 }}>Estamos trayendo los perfiles vinculados.</p>
            </div>
          ) : links.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><i className="fa-solid fa-user-plus"></i></div>
              <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>Todavia no tienes perfiles vinculados</h3>
              <p style={{ color: 'var(--text-medium)', lineHeight: 1.6 }}>Busca a una persona arriba para conectarla a este monitor.</p>
            </div>
          ) : links.map((link) => (
            <div key={link.id} className="surface-card" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-dark)' }}>{link.target.displayName}</h3>
                  <p style={{ color: 'var(--text-medium)', marginTop: '4px' }}>{link.target.profession || 'Sin profesión cargada'}</p>
                </div>
                <div className="info-chip-row">
                  <span className="badge badge-accent">{link.target.manualStatus.replaceAll('_', ' ')}</span>
                  <span className={`badge ${link.target.isOnline ? 'badge-primary' : 'badge-secondary'}`}>{link.target.isOnline ? 'Activo ahora' : 'Sin presencia ahora'}</span>
                  <button type="button" className="pill-button pill-button-secondary" onClick={() => void unlinkTarget(link.id)}>Desvincular</button>
                </div>
              </div>

              <div className="monitor-grid">
                <div className="monitor-tile">
                  <strong>Ubicacion actual</strong>
                  <span>{link.location ? `${link.location.lat.toFixed(5)}, ${link.location.lng.toFixed(5)}` : 'La persona aun no compartio ubicación real'}</span>
                </div>
                <div className="monitor-tile">
                  <strong>Bateria</strong>
                  <span>{link.location?.batteryLevel !== null && link.location?.batteryLevel !== undefined ? `${Math.round(link.location.batteryLevel)}%` : 'No disponible en este dispositivo'}</span>
                </div>
                <div className="monitor-tile">
                  <strong>Presencia</strong>
                  <span>{link.target.isOnline ? 'La app esta abierta y reportando presencia' : 'La app no reporta presencia ahora'}</span>
                </div>
                <div className="monitor-tile">
                  <strong>Ultimo check-in</strong>
                  <span>{formatUpdatedAt(link.location?.updatedAt || link.target.lastSeen)}</span>
                </div>
              </div>

              {link.location && (
                <div className="info-chip-row" style={{ marginTop: '14px' }}>
                  <a
                    href={`https://www.google.com/maps?q=${link.location.lat},${link.location.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="pill-button pill-button-primary"
                    style={{ textDecoration: 'none' }}
                  >
                    <i className="fa-solid fa-location-arrow"></i> Abrir ubicación
                  </a>
                </div>
              )}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
