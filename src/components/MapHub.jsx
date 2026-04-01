import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiUrl } from '../api';
import { useAuth } from '../AuthContext';

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export default function MapHub() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  const authHeaders = useMemo(() => {
    const token = localStorage.getItem('mate_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [user?.uid]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(apiUrl('/api/users'), {
          headers: { ...authHeaders },
          credentials: 'include',
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'No se pudieron cargar perfiles');
        setProviders((data.users || []).filter((entry) => entry.role === 'service_provider'));
      } catch {
        setProviders([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.uid]);

  const normalizedQuery = normalizeText(query.trim());

  const filtered = useMemo(() => {
    const base = providers.map((item) => {
      const haystack = normalizeText(`${item.name} ${item.profession} ${item.about} ${(item.tags || []).join(' ')}`);
      const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
      const tokenMatches = queryTokens.filter((token) => haystack.includes(token)).length;
      const queryScore = queryTokens.length ? Math.round((tokenMatches / queryTokens.length) * 100) : 60;
      const onlineBonus = item.isOnline ? 15 : 0;
      const activeBonus = item.profileStatus === 'activo' ? 10 : 0;

      return {
        ...item,
        service: item.profession || 'Servicio',
        specialty: item.about || (item.tags || []).join(', ') || 'Sin descripcion',
        matchScore: Math.min(queryScore + onlineBonus + activeBonus, 99),
      };
    });

    return base
      .filter((item) => !normalizedQuery || normalizeText(`${item.name} ${item.service} ${item.specialty}`).includes(normalizedQuery))
      .sort((a, b) => b.matchScore - a.matchScore || Number(b.isOnline) - Number(a.isOnline));
  }, [providers, normalizedQuery]);

  return (
    <div className="social-feed-shell" style={{ paddingBottom: '100px' }}>
      {/* Header */}
      <header className="social-topbar animate-in">
        <div>
          <span className="badge badge-accent" style={{ marginBottom: '12px' }}>
            <i className="fa-solid fa-map-location-dot"></i> Mapa de servicios
          </span>
          <h1>Encuentra servicios</h1>
          <p style={{ marginTop: '8px' }}>Conecta con profesionales reales cerca de ti.</p>
        </div>
      </header>

      {/* Search */}
      <section className="card" style={{ marginBottom: '24px' }}>
        <form onSubmit={(e) => { e.preventDefault(); e.target.querySelector('input')?.blur(); }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--text-muted)', fontSize: '18px' }}></i>
            <input
              type="text"
              className="form-input"
              placeholder="Que necesitas? Ej: acompanamiento, terapia..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ border: 'none', boxShadow: 'none', padding: '12px 0' }}
            />
          </div>
        </form>

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
          <span className="badge badge-secondary">
            <i className="fa-solid fa-shield-heart"></i> Perfiles verificados
          </span>
          <span className="badge badge-primary">
            <i className="fa-solid fa-bolt"></i> En tiempo real
          </span>
        </div>
      </section>

      {/* Results */}
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <i className="fa-solid fa-list" style={{ color: 'var(--primary)' }}></i>
          Resultados {query && `(${filtered.length})`}
        </h2>

        {loading ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <i className="fa-solid fa-spinner fa-spin"></i>
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Cargando</h3>
            <p style={{ color: 'var(--text-muted)' }}>Obteniendo perfiles disponibles...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <i className="fa-solid fa-inbox"></i>
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Sin resultados</h3>
            <p style={{ color: 'var(--text-muted)' }}>
              {query ? 'Prueba con otros terminos de busqueda' : 'Aun no hay proveedores registrados'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {filtered.map((item, index) => (
              <article
                key={item.id}
                className="card"
                style={{
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
                onClick={() => navigate('/perfil', { state: { profile: item, from: '/mapa' } })}
              >
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  {item.avatar ? (
                    <img
                      src={item.avatar}
                      alt={item.name}
                      style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: 'var(--radius-lg)',
                        objectFit: 'cover',
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: 'var(--radius-lg)',
                      background: 'var(--gradient-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '24px',
                      flexShrink: 0,
                    }}>
                      {item.name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '4px' }}>{item.name}</h3>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{item.service}</p>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {item.isOnline && (
                          <span className="badge badge-success" style={{ fontSize: '11px' }}>
                            <i className="fa-solid fa-circle" style={{ fontSize: '8px' }}></i> Activo
                          </span>
                        )}
                        <span className="badge badge-secondary" style={{ fontSize: '11px' }}>
                          {item.matchScore}% match
                        </span>
                      </div>
                    </div>

                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {item.specialty}
                    </p>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {(item.tags || []).slice(0, 3).map((tag, i) => (
                        <span key={i} className="badge badge-secondary" style={{ fontSize: '11px' }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
