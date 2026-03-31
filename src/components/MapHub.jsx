import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  const resultsRef = useRef(null);

  const authHeaders = useMemo(() => {
    const token = localStorage.getItem('mate_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [user?.uid]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(apiUrl('/api/users'), {
          headers: {
            ...authHeaders,
          },
          credentials: 'include',
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'No se pudieron cargar perfiles reales');
        setProviders((data.users || []).filter((entry) => entry.role === 'service_provider'));
      } catch (error) {
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
        service: item.profession || 'Servicio sin definir',
        specialty: item.about || (item.tags || []).join(', ') || 'Sin descripción',
        availability: item.profileAnswers?.availability || 'Sin disponibilidad cargada',
        hourlyRate: item.rate || 0,
        activeProfile: item.profileStatus === 'activo',
        completedServices: 0,
        ratingLabel: 'Sin valoraciones visibles',
        matchScore: Math.min(queryScore + onlineBonus + activeBonus, 99),
      };
    });

    return base
      .filter((item) => !normalizedQuery || normalizeText(`${item.name} ${item.service} ${item.specialty}`).includes(normalizedQuery))
      .sort((a, b) => b.matchScore - a.matchScore || Number(b.isOnline) - Number(a.isOnline));
  }, [providers, normalizedQuery]);

  const handleSubmit = (event) => {
    event.preventDefault();
    event.currentTarget.querySelector('input')?.blur();
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="app-scroll" style={{ padding: '0 0 110px', minHeight: '100vh' }}>
      <div className="page-shell page-stack">
        <section className="hero-banner">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ maxWidth: '620px' }}>
              <span className="badge badge-accent" style={{ marginBottom: '12px' }}>
                <i className="fa-solid fa-map-location-dot"></i> Servicios reales
              </span>
              <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '10px' }}>Busqueda en contexto</h1>
              <p style={{ fontSize: '15px', lineHeight: 1.6, opacity: 0.94 }}>
                Encuentra servicios reales cerca de ti. Describe lo que necesitas y conecta con personas disponibles.
              </p>
            </div>
          </div>
        </section>

        <section className="surface-card" style={{ padding: '18px' }}>
          <div className="section-title" style={{ marginBottom: '12px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Que necesitas?</h2>
            <p style={{ fontSize: '14px' }}>Describe tu necesidad y pulsa Enter. El teclado se cierra y los resultados quedan visibles enseguida.</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px', padding: '6px 8px 6px 14px', background: 'rgba(247, 239, 230, 0.72)', borderRadius: '18px', border: '1px solid var(--border)' }}>
            <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--text-light)' }}></i>
            <input
              type="text"
              placeholder="Ejemplo: necesito compañía para ir al médico y ayuda con trámites"
              value={query}
              spellCheck
              autoCorrect="on"
              autoCapitalize="sentences"
              onChange={(e) => setQuery(e.target.value)}
              style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: '14px', color: 'var(--text-dark)', fontFamily: 'var(--font)' }}
            />
            <button type="submit" className="pill-button pill-button-primary" style={{ padding: '10px 16px' }}>Buscar</button>
          </form>

          <div className="info-chip-row" style={{ marginTop: '12px' }}>
            <span className="badge badge-secondary"><i className="fa-solid fa-shield-heart"></i> Solo mostramos perfiles reales</span>
            <span className="badge badge-accent"><i className="fa-solid fa-bolt"></i> Priorizamos presencia, perfil activo y coincidencia</span>
          </div>
        </section>

        <section className="feed-layout" ref={resultsRef}>
          <div className="page-stack">
            <div className="surface-card" style={{ padding: '18px' }}>
              <div className="section-title" style={{ marginBottom: '12px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 800 }}>Resultados de servicios</h3>
                <p style={{ fontSize: '14px' }}>Sin datos mockeados. Todo lo que aparece aquí sale de perfiles reales.</p>
              </div>

              <div className="list-stack">
                {loading ? (
                  <div className="empty-state">
                    <div className="empty-state-icon"><i className="fa-solid fa-spinner fa-spin"></i></div>
                    <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>Cargando perfiles</h3>
                    <p style={{ color: 'var(--text-medium)', lineHeight: 1.6 }}>Estamos trayendo servicios reales.</p>
                  </div>
                ) : filtered.length ? filtered.map((item, index) => (
                  <div key={item.id} style={{ padding: '16px', borderRadius: '20px', background: 'rgba(255,255,255,0.78)', border: '1px solid rgba(32,75,87,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
                      <div>
                        <div className="info-chip-row" style={{ marginBottom: '8px' }}>
                          <span className="badge badge-accent">Puesto #{index + 1}</span>
                          {item.isOnline && <span className="badge badge-primary">Activo ahora</span>}
                        </div>
                        <strong style={{ display: 'block', color: 'var(--text-dark)', fontSize: '17px' }}>{item.name}</strong>
                        <span style={{ color: 'var(--text-medium)', fontSize: '13px' }}>{item.service}</span>
                      </div>
                      <div className="info-chip-row">
                        <span className="badge badge-accent">{item.matchScore}% match</span>
                        <span className="badge badge-secondary">{item.ratingLabel}</span>
                        <span className="badge badge-primary">{item.hourlyRate ? `$${item.hourlyRate}/h` : 'Sin tarifa'}</span>
                      </div>
                    </div>

                    <p style={{ color: 'var(--text-medium)', fontSize: '14px', lineHeight: 1.6, marginBottom: '12px' }}>
                      {item.specialty}
                    </p>

                    <div className="info-chip-row" style={{ marginBottom: '12px' }}>
                      <span className="badge badge-secondary"><i className="fa-solid fa-clock"></i> {item.availability}</span>
                      <span className={`badge ${item.activeProfile ? 'badge-accent' : 'badge-secondary'}`}>
                        {item.activeProfile ? 'Perfil activo' : 'Perfil pausado'}
                      </span>
                      <span className="badge badge-secondary">{item.manualStatus?.replaceAll('_', ' ') || 'sin estado'}</span>
                    </div>

                    <div className="info-chip-row">
                      <button type="button" className="pill-button pill-button-primary" style={{ padding: '10px 16px' }} onClick={() => navigate('/chat', { state: { provider: item, query: query.trim() } })}>
                        <i className="fa-solid fa-comments"></i> Ir al chat
                      </button>
                      <button type="button" className="pill-button pill-button-secondary" style={{ padding: '10px 16px' }} onClick={() => navigate('/perfil', { state: { profile: item, readOnly: true, from: '/mapa' } })}>
                        <i className="fa-solid fa-user"></i> Ver perfil
                      </button>
                    </div>
                  </div>
                )) : (
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <i className="fa-solid fa-compass"></i>
                    </div>
                    <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>No encontramos perfiles para esa busqueda</h3>
                    <p style={{ color: 'var(--text-medium)', lineHeight: 1.6 }}>
                      Prueba describiendo mejor tu necesidad, por ejemplo compañía, trámites, médico, traslado o apoyo emocional.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
