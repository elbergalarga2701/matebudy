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
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
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
            title: `Nueva ubicacion de ${link.target.displayName}`,
            body: 'El perfil monitoreado envio una actualizacion de ubicacion.',
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

  const loadRequests = async () => {
    const response = await fetch(apiUrl('/api/users/monitor-link-requests'), {
      headers: {
        ...authHeaders,
      },
      credentials: 'include',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'No se pudieron cargar las solicitudes');

    setIncomingRequests(data.incoming || []);
    setOutgoingRequests(data.outgoing || []);
  };

  useEffect(() => {
    void (async () => {
      try {
        await Promise.all([loadLinks(), loadRequests()]);
      } catch (error) {
        setToast(error.message);
      } finally {
        setLoading(false);
      }
    })();

    const intervalId = window.setInterval(() => {
      void Promise.all([loadLinks(), loadRequests()]).catch(() => {});
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

  const requestMonitoringAccess = async (targetUserId) => {
    try {
      const response = await fetch(apiUrl('/api/users/monitor-link-requests'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        credentials: 'include',
        body: JSON.stringify({ targetUserId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo enviar la solicitud');
      await loadRequests();
      setToast('Solicitud enviada. La otra persona debe aprobarla.');
      setQuery('');
      setResults([]);
    } catch (error) {
      setToast(error.message);
    }
  };

  const approveRequest = async (requestId) => {
    try {
      const response = await fetch(apiUrl(`/api/users/monitor-link-requests/${requestId}/approve`), {
        method: 'POST',
        headers: {
          ...authHeaders,
        },
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo aprobar la solicitud');
      await Promise.all([loadRequests(), loadLinks()]);
      setToast('Solicitud aprobada y monitoreo activado');
    } catch (error) {
      setToast(error.message);
    }
  };

  const rejectRequest = async (requestId) => {
    try {
      const response = await fetch(apiUrl(`/api/users/monitor-link-requests/${requestId}/reject`), {
        method: 'POST',
        headers: {
          ...authHeaders,
        },
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo rechazar la solicitud');
      await loadRequests();
      setToast('Solicitud rechazada');
    } catch (error) {
      setToast(error.message);
    }
  };

  const cancelRequest = async (requestId) => {
    try {
      const response = await fetch(apiUrl(`/api/users/monitor-link-requests/${requestId}`), {
        method: 'DELETE',
        headers: {
          ...authHeaders,
        },
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo cancelar la solicitud');
      await loadRequests();
      setToast('Solicitud cancelada');
    } catch (error) {
      setToast(error.message);
    }
  };

  const unlinkTarget = async (linkId) => {
    try {
      const response = await fetch(apiUrl(`/api/users/monitor-links/${linkId}`), {
        method: 'DELETE',
        headers: {
          ...authHeaders,
        },
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo eliminar el vinculo');
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
          <div style={{ maxWidth: '700px' }}>
            <span className="badge badge-accent" style={{ marginBottom: '12px' }}>
              <i className="fa-solid fa-shield-halved"></i> Monitor y familiar
            </span>
            <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '10px' }}>Cuidado en tiempo real con consentimiento</h1>
            <p style={{ fontSize: '15px', lineHeight: 1.6, opacity: 0.94 }}>
              El monitoreo ahora funciona por solicitud y aprobacion explicita. Ninguna cuenta puede quedar vinculada sin consentimiento de la persona monitoreada.
            </p>
          </div>
        </section>

        <section className="surface-card" style={{ padding: '18px' }}>
          <div className="section-title" style={{ marginBottom: '12px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Solicitar acceso de monitoreo</h2>
            <p style={{ fontSize: '14px' }}>Busca un perfil, envia una solicitud y espera su aprobacion antes de ver ubicacion, bateria o presencia.</p>
          </div>
          <input
            type="text"
            className="form-input"
            placeholder="Buscar por nombre o profesion"
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
                      {entry.profession || 'Sin descripcion'} · {entry.manualStatus?.replaceAll('_', ' ') || 'sin estado'} · {entry.isOnline ? 'activo ahora' : 'sin presencia ahora'}
                    </span>
                  </div>
                  <button type="button" className="pill-button pill-button-primary" onClick={() => void requestMonitoringAccess(entry.id)}>
                    Solicitar acceso
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {(incomingRequests.length > 0 || outgoingRequests.length > 0) && (
          <section className="page-stack">
            {incomingRequests.length > 0 && (
              <div className="surface-card" style={{ padding: '18px' }}>
                <div className="section-title" style={{ marginBottom: '12px' }}>
                  <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Solicitudes por aprobar</h2>
                  <p style={{ fontSize: '14px' }}>Solo la persona monitoreada puede habilitar el acceso.</p>
                </div>
                <div className="list-stack">
                  {incomingRequests.map((request) => (
                    <div key={request.id} className="surface-card" style={{ padding: '14px', display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <strong style={{ display: 'block', color: 'var(--text-dark)' }}>{request.user.name}</strong>
                        <span style={{ color: 'var(--text-medium)', fontSize: '13px' }}>
                          {request.user.profession || request.user.role} · solicitada {formatUpdatedAt(request.createdAt)}
                        </span>
                        {request.note && <p style={{ marginTop: '8px', color: 'var(--text-medium)' }}>{request.note}</p>}
                      </div>
                      <div className="info-chip-row">
                        <button type="button" className="pill-button pill-button-primary" onClick={() => void approveRequest(request.id)}>Aprobar</button>
                        <button type="button" className="pill-button pill-button-secondary" onClick={() => void rejectRequest(request.id)}>Rechazar</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {outgoingRequests.length > 0 && (
              <div className="surface-card" style={{ padding: '18px' }}>
                <div className="section-title" style={{ marginBottom: '12px' }}>
                  <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Solicitudes enviadas</h2>
                  <p style={{ fontSize: '14px' }}>Estas solicitudes siguen pendientes hasta que la otra persona las apruebe.</p>
                </div>
                <div className="list-stack">
                  {outgoingRequests.map((request) => (
                    <div key={request.id} className="surface-card" style={{ padding: '14px', display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <strong style={{ display: 'block', color: 'var(--text-dark)' }}>{request.user.name}</strong>
                        <span style={{ color: 'var(--text-medium)', fontSize: '13px' }}>
                          {request.user.profession || request.user.role} · enviada {formatUpdatedAt(request.createdAt)}
                        </span>
                      </div>
                      <button type="button" className="pill-button pill-button-secondary" onClick={() => void cancelRequest(request.id)}>
                        Cancelar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

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
              <p style={{ color: 'var(--text-medium)', lineHeight: 1.6 }}>Primero envia una solicitud y espera la aprobacion del otro perfil.</p>
            </div>
          ) : links.map((link) => (
            <div key={link.id} className="surface-card" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-dark)' }}>{link.target.displayName}</h3>
                  <p style={{ color: 'var(--text-medium)', marginTop: '4px' }}>{link.target.profession || 'Sin profesion cargada'}</p>
                </div>
                <div className="info-chip-row">
                  <span className="badge badge-accent">{link.target.manualStatus.replaceAll('_', ' ')}</span>
                  <span className={`badge ${link.target.isOnline ? 'badge-primary' : 'badge-secondary'}`}>{link.target.isOnline ? 'Activo ahora' : 'Sin presencia ahora'}</span>
                  <button type="button" className="pill-button pill-button-secondary" onClick={() => void unlinkTarget(link.id)}>Revocar acceso</button>
                </div>
              </div>

              <div className="monitor-grid">
                <div className="monitor-tile">
                  <strong>Ubicacion actual</strong>
                  <span>{link.location ? `${link.location.lat.toFixed(5)}, ${link.location.lng.toFixed(5)}` : 'La persona aun no compartio ubicacion real'}</span>
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
                    <i className="fa-solid fa-location-arrow"></i> Abrir ubicacion
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
