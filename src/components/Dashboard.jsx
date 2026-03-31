import React, { useState } from 'react';
import { useAuth } from '../AuthContext';

const PROVIDERS = [
  { id: 1, name: 'Carlos Rodriguez', service: 'Matematicas', distance: '0.5 km', price: '$15/h', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Carlos', ratingLabel: 'Sin valoraciones todavía' },
  { id: 2, name: 'Maria Lopez', service: 'Calculo', distance: '1.2 km', price: '$20/h', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Maria', ratingLabel: 'Sin valoraciones todavía' },
  { id: 3, name: 'Juan Perez', service: 'Fisica', distance: '2.0 km', price: '$18/h', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Juan', ratingLabel: 'Sin valoraciones todavía' },
  { id: 4, name: 'Ana Garcia', service: 'Algebra', distance: '0.8 km', price: '$12/h', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ana', ratingLabel: 'Sin valoraciones todavía' },
];

export default function Dashboard() {
  const { user, saveMateRequest } = useAuth();
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const availability = user?.profileAnswers?.availability || 'Sin disponibilidad cargada';
  const occupation = user?.profileAnswers?.occupation || 'Perfil en construccion';

  const handleRequest = (provider) => {
    saveMateRequest(provider);
    setToast(`Solicitud enviada a ${provider.name}`);
    setTimeout(() => setToast(''), 3000);
  };

  const filtered = search
    ? PROVIDERS.filter(
        (provider) =>
          provider.name.toLowerCase().includes(search.toLowerCase()) ||
          provider.service.toLowerCase().includes(search.toLowerCase()),
      )
    : PROVIDERS;

  return (
    <div className="app-scroll" style={{ padding: '0 0 110px', minHeight: '100vh' }}>
      {toast && <div className="toast toast-success">{toast}</div>}

      <div className="page-shell page-stack">
        <section className="hero-banner animate-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ maxWidth: '560px' }}>
              <span className="badge badge-accent" style={{ marginBottom: '12px' }}>
                <i className="fa-solid fa-heart"></i> Apoyo académico cercano
              </span>
              <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '10px' }}>
                Hola, {user?.displayName || 'amigo'}
              </h1>
              <p style={{ fontSize: '15px', lineHeight: 1.6, opacity: 0.94 }}>
                {user?.role === 'service_provider'
                  ? 'Tu perfil ya esta listo para ofrecer servicios y aparecer mejor ubicado según disponibilidad y estado activo.'
                  : user?.role === 'monitor'
                  ? 'Tu cuenta monitor esta lista para seguir a tu familiar, revisar batería, ubicación en tiempo real y responder alertas.'
                  : user?.role === 'companion'
                    ? 'Tu perfil solidario ya esta listo para acompañar a quien necesite apoyo humano y cercano.'
                    : 'Busca ayuda sin friccion, encuentra a alguien confiable y empieza una conversacion en segúndos.'}
              </p>
            </div>

            <div className="info-chip-row" style={{ justifyContent: 'flex-end' }}>
              <span className="badge badge-secondary"><i className="fa-solid fa-location-dot"></i> Cerca de vos</span>
              <span className="badge badge-accent"><i className="fa-solid fa-shield-heart"></i> Verificados</span>
              <span className="badge badge-primary"><i className="fa-solid fa-user-tag"></i> {user?.roleLabel}</span>
            </div>
          </div>

          <div className="metrics-grid" style={{ marginTop: '18px' }}>
            <div className="metric-card">
              <strong>{PROVIDERS.length}</strong>
              <span>Tutores activos</span>
            </div>
            <div className="metric-card">
              <strong>12 min</strong>
              <span>Respuesta promedio</span>
            </div>
            <div className="metric-card">
              <strong>Sin datos</strong>
              <span>Valoraciones reales pendientes</span>
            </div>
          </div>
        </section>

        <section className="surface-card" style={{ padding: '16px', position: 'sticky', top: '10px', zIndex: 10 }}>
          <div className="section-title" style={{ marginBottom: '12px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Busca por materia o nombre</h2>
            <p style={{ fontSize: '14px' }}>Todo esta pensado para que encontrar a alguien se sienta facil.</p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
              padding: '6px 8px 6px 14px',
              background: 'rgba(247, 239, 230, 0.72)',
              borderRadius: '18px',
              border: '1px solid var(--border)',
            }}
          >
            <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--text-light)' }}></i>
            <input
              type="text"
              placeholder="Buscar proveedores..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: 1,
                minWidth: 0,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: '14px',
                color: 'var(--text-dark)',
                fontFamily: 'var(--font)',
              }}
            />
            <span className="badge badge-primary">Hoy</span>
          </div>
        </section>

        <section className="mini-stat-grid">
          <div className="mini-stat-card">
            <strong>Disponibilidad</strong>
            <span>{user?.role === 'monitor' ? 'Monitoreo en tiempo real del familiar vinculado.' : availability}</span>
          </div>
          <div className="mini-stat-card">
            <strong>Perfil activo</strong>
            <span>{user?.role === 'monitor' ? 'Recibe alertas, geolocalizacion y estado del dispositivo.' : occupation}</span>
          </div>
        </section>

        <section className="page-stack">
          <div className="section-title">
            <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Perfiles disponibles</h2>
            <p style={{ fontSize: '14px' }}>Una lista clara, limpia y amigable para elegir con confianza.</p>
          </div>

          <div className="list-stack">
            {filtered.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <i className="fa-solid fa-face-smile"></i>
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '6px' }}>No hay coincidencias</h3>
                <p style={{ color: 'var(--text-medium)', lineHeight: 1.6 }}>
                  Prueba con otra materia o elimina el filtro para volver a ver todos los perfiles.
                </p>
              </div>
            )}

            {filtered.map((provider) => (
              <div
                key={provider.id}
                className="surface-card animate-in"
                style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}
              >
                <img src={provider.avatar} alt={provider.name} className="avatar-ring" style={{ width: '58px', height: '58px' }} />
                <div style={{ flex: 1, minWidth: 'min(220px, 100%)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-dark)' }}>{provider.name}</span>
                    <span className="badge badge-secondary"><i className="fa-solid fa-shield-heart"></i> Perfil cuidado</span>
                  </div>

                  <p style={{ fontSize: '14px', color: 'var(--text-medium)', marginTop: '6px', marginBottom: '10px' }}>
                    Especialista en {provider.service}. Cercano, claro para explicar y con buena disponibilidad.
                  </p>

                  <div className="info-chip-row">
                    <span className="badge badge-accent"><i className="fa-solid fa-star"></i> {provider.ratingLabel}</span>
                    <span className="badge badge-secondary"><i className="fa-solid fa-location-dot"></i> {provider.distance}</span>
                    <span className="badge badge-primary">{provider.price}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleRequest(provider)}
                  className="pill-button pill-button-primary"
                  style={{ minWidth: 'min(150px, 100%)', width: '100%', maxWidth: '180px', marginLeft: 'auto' }}
                >
                  <i className="fa-solid fa-paper-plane"></i> Pedir ayuda
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="mini-stat-grid">
          <div className="mini-stat-card">
            <strong>Simple</strong>
            <span>La pantalla prioriza claridad antes que ruido visual.</span>
          </div>
          <div className="mini-stat-card">
            <strong>Calida</strong>
            <span>Los colores y tarjetas ayudan a que la app se sienta mas humana.</span>
          </div>
        </section>
      </div>
    </div>
  );
}
