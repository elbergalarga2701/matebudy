import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { getNotificationPermissionState, requestMatebudyNotifications } from '../notifications';
import { apiUrl, publicFileUrl } from '../api';

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(file);
  });
}

export default function Profile() {
  const { user, logout, updateProfile } = useAuth();
  const location = useLocation();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const viewedProfile = location.state?.profile || null;
  const isReadOnly = Boolean(location.state?.readOnly && viewedProfile);
  const sourceProfile = isReadOnly
    ? {
        displayName: viewedProfile.name,
        roleLabel: viewedProfile.service || 'Perfil',
        profileStatus: viewedProfile.activeProfile ? 'activo' : 'ocupado',
        profession: viewedProfile.service || '',
        about: viewedProfile.specialty || '',
        tags: viewedProfile.specialty ? viewedProfile.specialty.split(',').map((tag) => tag.trim()).filter(Boolean) : [],
        avatar: viewedProfile.avatar || '',
        manualStatus: viewedProfile.manualStatus || 'en_línea',
        profileAnswers: {
          disponibilidad: viewedProfile.availability || 'Sin dato',
          experiencia: `${viewedProfile.completedServices || 0} servicios completados`,
          tarifa: viewedProfile.hourlyRate ? `$${viewedProfile.hourlyRate}/h` : 'Sin tarifa',
        },
      }
    : user;
  const [profileForm, setProfileForm] = useState(() => ({
    displayName: sourceProfile?.displayName || '',
    profession: sourceProfile?.profession || '',
    about: sourceProfile?.about || '',
    tags: (sourceProfile?.tags || []).join(', '),
    avatar: sourceProfile?.avatar || '',
    manualStatus: sourceProfile?.manualStatus || 'en_línea',
    profileAnswers: sourceProfile?.profileAnswers || {},
  }));
  const navigate = useNavigate();
  const [notificationPermission, setNotificationPermission] = useState(() => getNotificationPermissionState());
  const [incomingMonitorRequests, setIncomingMonitorRequests] = useState([]);
  const [monitorRequestsLoading, setMonitorRequestsLoading] = useState(false);
  const STATUS_OPTIONS = [
    { value: 'en_línea', label: 'En línea' },
    { value: 'ocupado', label: 'Ocupado' },
    { value: 'fuera_de_línea', label: 'Fuera de línea' },
  ];

  const profileAnswerEntries = useMemo(
    () => Object.entries(profileForm.profileAnswers || {}),
    [profileForm.profileAnswers],
  );

  const authHeaders = useMemo(() => {
    const token = localStorage.getItem('mate_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [user?.uid]);

  const handleSave = async () => {
    if (isReadOnly) return;
    setSaving(true);
    await updateProfile({
      displayName: profileForm.displayName,
      profession: profileForm.profession,
      about: profileForm.about,
      avatar: profileForm.avatar,
      tags: profileForm.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      manualStatus: profileForm.manualStatus,
      profileAnswers: profileForm.profileAnswers,
      onboardingCompleted: true,
      profileStatus: 'activo',
    });
    setSaving(false);
    setEditing(false);
    setToast('Perfil actualizado');
    setTimeout(() => setToast(''), 3000);
  };

  const handleLogout = async () => {
    if (isReadOnly) {
      navigate(location.state?.from || '/mapa');
      return;
    }
    await logout();
    navigate('/login');
  };

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const avatar = await fileToDataUrl(file);
    setProfileForm((prev) => ({ ...prev, avatar }));
  };

  const handleEnableNotifications = async () => {
    const result = await requestMatebudyNotifications();
    setNotificationPermission(result);
    setToast(
      result === 'granted'
        ? 'Notificaciones activadas'
        : result === 'denied'
          ? 'Las notificaciones quedaron bloqueadas'
          : 'Tu dispositivo no permite notificaciones desde aquí',
    );
    setTimeout(() => setToast(''), 3000);
  };

  const handleQuickStatus = async (manualStatus) => {
    if (isReadOnly) return;

    setProfileForm((prev) => ({ ...prev, manualStatus }));
    setSaving(true);
    try {
      await updateProfile({
        manualStatus,
      });
      setToast('Estado actualizado');
    } catch (error) {
      setToast(error.message || 'No se pudo actualizar el estado');
    } finally {
      setSaving(false);
      setTimeout(() => setToast(''), 2500);
    }
  };

  const updateAnswer = (key, value) => {
    setProfileForm((prev) => ({
      ...prev,
      profileAnswers: {
        ...prev.profileAnswers,
        [key]: value,
      },
    }));
  };

  useEffect(() => {
    if (isReadOnly || !user?.uid) return undefined;

    let cancelled = false;

    const loadMonitorRequests = async () => {
      setMonitorRequestsLoading(true);
      try {
        const response = await fetch(apiUrl('/api/users/monitor-link-requests'), {
          headers: {
            ...authHeaders,
          },
          credentials: 'include',
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'No se pudieron cargar las solicitudes de monitoreo');
        if (!cancelled) {
          setIncomingMonitorRequests(data.incoming || []);
        }
      } catch (error) {
        if (!cancelled) {
          setToast(error.message);
        }
      } finally {
        if (!cancelled) {
          setMonitorRequestsLoading(false);
        }
      }
    };

    void loadMonitorRequests();
    return () => {
      cancelled = true;
    };
  }, [authHeaders, isReadOnly, user?.uid]);

  const respondToMonitorRequest = async (requestId, action) => {
    if (isReadOnly) return;

    try {
      const response = await fetch(apiUrl(`/api/users/monitor-link-requests/${requestId}/${action}`), {
        method: 'POST',
        headers: {
          ...authHeaders,
        },
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo responder la solicitud');

      setIncomingMonitorRequests((prev) => prev.filter((entry) => entry.id !== requestId));
      setToast(action === 'approve' ? 'Solicitud de monitoreo aprobada' : 'Solicitud de monitoreo rechazada');
      setTimeout(() => setToast(''), 2500);
    } catch (error) {
      setToast(error.message || 'No se pudo responder la solicitud');
      setTimeout(() => setToast(''), 2500);
    }
  };

  const currentAvatar = (() => {
    const value = profileForm.avatar || sourceProfile?.avatar || '';
    return value.startsWith('/uploads') ? publicFileUrl(value) : value;
  })();
  const profileStats = isReadOnly
    ? [
        { icon: 'fa-solid fa-briefcase', value: viewedProfile?.completedServices || 0, label: 'Servicios registrados', color: 'var(--success)' },
        { icon: 'fa-solid fa-star', value: viewedProfile?.rating ? String(viewedProfile.rating) : 'Sin datos', label: viewedProfile?.rating ? 'Calificacion visible' : 'Sin valoraciones', color: 'var(--accent)' },
        { icon: 'fa-solid fa-heart', value: viewedProfile?.activeProfile ? 'Activo' : 'Pausado', label: 'Estado del perfil', color: 'var(--danger)' },
      ]
    : [
        { icon: 'fa-solid fa-briefcase', value: '0', label: 'Servicios completados', color: 'var(--success)' },
        { icon: 'fa-solid fa-star', value: 'Sin datos', label: 'Sin valoraciones todavía', color: 'var(--accent)' },
        { icon: 'fa-solid fa-heart', value: '0', label: 'Apoyos guardados', color: 'var(--danger)' },
      ];

  return (
    <div className="app-scroll" style={{ minHeight: '100vh', padding: '0 0 110px' }}>
      {toast && <div className="toast toast-success">{toast}</div>}

      <div className="page-shell page-stack">
        <div className="hero-banner profile-hero">
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="profile-avatar-shell">
              {currentAvatar ? (
                <img src={currentAvatar} alt={profileForm.displayName || 'Perfil'} className="profile-avatar-image" />
              ) : (
                <div className="profile-avatar-fallback">
                  {(profileForm.displayName || user?.displayName || '?').charAt(0).toUpperCase()}
                </div>
              )}

              {editing && !isReadOnly && (
                <label className="profile-avatar-action">
                  <i className="fa-solid fa-camera"></i>
                  <input type="file" accept="image/*" hidden onChange={handleAvatarChange} />
                </label>
              )}
            </div>

            {editing && !isReadOnly ? (
              <input
                type="text"
                value={profileForm.displayName}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, displayName: e.target.value }))}
                className="profile-hero-input"
              />
            ) : (
              <h2 style={{ fontSize: '28px', fontWeight: 800, color: 'white', marginBottom: '8px' }}>
                {sourceProfile?.displayName || 'Usuario'}
              </h2>
            )}

            <p style={{ color: 'rgba(255,255,255,0.82)', fontSize: '14px', marginBottom: '16px' }}>{sourceProfile?.profession || sourceProfile?.roleLabel}</p>

            <div className="info-chip-row" style={{ justifyContent: 'center' }}>
              <span className="badge badge-accent">{sourceProfile?.roleLabel}</span>
              <span className="badge badge-secondary">{sourceProfile?.profileStatus}</span>
              <span className="badge badge-primary">Estado manual: {(isReadOnly ? sourceProfile?.manualStatus : profileForm.manualStatus).replaceAll('_', ' ')}</span>
            </div>

            {!isReadOnly && (
              <div className="profile-status-quickbar">
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`profile-status-chip ${(profileForm.manualStatus || sourceProfile?.manualStatus) === option.value ? 'active' : ''}`}
                    onClick={() => void handleQuickStatus(option.value)}
                    disabled={saving}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mini-stat-grid">
          <div className="mini-stat-card">
            <strong>Perfil editable</strong>
            <span>{isReadOnly ? 'Estás viendo una vista pública del perfil seleccionado.' : 'Foto, descripción, tags y respuestas quedan guardadas para la próxima vez que entres.'}</span>
          </div>
          <div className="mini-stat-card">
            <strong>{sourceProfile?.roleLabel || 'Cuenta'}</strong>
            <span>{isReadOnly ? 'Puedes volver al mapa o iniciar un chat con esta persona.' : 'Puedes ajustar tu presentación sin perder lo ya completado.'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="neu-card-sm">
            <h3 className="profile-section-title">
              <i className="fa-solid fa-user-pen" style={{ color: 'var(--primary)' }}></i>
              Informacion personal
            </h3>

            <div className="profile-edit-grid">
              <div className="form-group">
                <label className="form-label">Nombre</label>
                {editing && !isReadOnly ? (
                  <input
                    type="text"
                    className="form-input"
                    value={profileForm.displayName}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, displayName: e.target.value }))}
                  />
                ) : (
                  <span className="profile-value">{sourceProfile?.displayName}</span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Profesion o enfoque</label>
                {editing && !isReadOnly ? (
                  <input
                    type="text"
                    className="form-input"
                    value={profileForm.profession}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, profession: e.target.value }))}
                    placeholder="Ejemplo: acompañante, tutor, técnico"
                  />
                ) : (
                  <span className="profile-value">{sourceProfile?.profession || 'Sin definir'}</span>
                )}
              </div>

              {!isReadOnly && (
                <div className="form-group">
                  <label className="form-label">Cómo quieres aparecer</label>
                  {editing ? (
                    <select
                      className="form-input"
                      value={profileForm.manualStatus}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, manualStatus: e.target.value }))}
                    >
                      <option value="en_línea">En línea</option>
                      <option value="ocupado">Ocupado</option>
                      <option value="fuera_de_línea">Fuera de línea</option>
                    </select>
                  ) : (
                    <span className="profile-value">{profileForm.manualStatus.replaceAll('_', ' ')}</span>
                  )}
                </div>
              )}

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Sobre mí</label>
                {editing && !isReadOnly ? (
                  <textarea
                    className="form-input textarea-field"
                    rows={4}
                    value={profileForm.about}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, about: e.target.value }))}
                    placeholder="Cuenta un poco cómo trabajas o como acompañías."
                  />
                ) : (
                  <p className="profile-description">{sourceProfile?.about || 'Todavia no agregaste una descripción.'}</p>
                )}
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Tags del perfil</label>
                {editing && !isReadOnly ? (
                  <input
                    type="text"
                    className="form-input"
                    value={profileForm.tags}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, tags: e.target.value }))}
                    placeholder="compañía, trámites, apoyo emocional, estudio"
                  />
                ) : (
                  <div className="info-chip-row">
                    {(sourceProfile?.tags || []).length ? sourceProfile.tags.map((tag) => (
                      <span key={tag} className="badge badge-primary">{tag}</span>
                    )) : <span className="profile-value">Aun no agregaste tags</span>}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="neu-card-sm">
            <h3 className="profile-section-title">
              <i className="fa-solid fa-clipboard-question" style={{ color: 'var(--primary)' }}></i>
              Respuestas del perfil
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {profileAnswerEntries.map(([key, value]) => (
                <div key={key} className="profile-answer-card">
                  <strong>{key}</strong>
                  {editing && !isReadOnly ? (
                    <textarea
                      className="form-input textarea-field"
                      rows={3}
                      value={value}
                      onChange={(e) => updateAnswer(key, e.target.value)}
                    />
                  ) : (
                    <span>{value}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="neu-card-sm">
            <h3 className="profile-section-title">
              <i className="fa-solid fa-chart-line" style={{ color: 'var(--primary)' }}></i>
              Tu resumen
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {profileStats.map((stat, index) => (
                <div key={index} className="profile-stat-card">
                  <span className="profile-stat-icon" style={{ color: stat.color }}>
                    <i className={stat.icon}></i>
                  </span>
                  <div>
                    <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-dark)', display: 'block' }}>{stat.value}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-medium)' }}>{stat.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {!isReadOnly && (
            <div className="neu-card-sm">
              <h3 className="profile-section-title">
                <i className="fa-solid fa-user-shield" style={{ color: 'var(--primary)' }}></i>
                Solicitudes de monitoreo
              </h3>
              <p className="profile-description">
                Ninguna cuenta puede acceder a tu ubicacion, bateria o presencia sin tu aprobacion explicita.
              </p>
              {monitorRequestsLoading ? (
                <div className="info-note" style={{ marginTop: '12px' }}>
                  <i className="fa-solid fa-spinner fa-spin"></i> Cargando solicitudes...
                </div>
              ) : incomingMonitorRequests.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                  {incomingMonitorRequests.map((request) => (
                    <div key={request.id} className="profile-answer-card">
                      <strong>{request.user?.name || 'Monitor'}</strong>
                      <span>{request.user?.profession || request.user?.role || 'Cuenta monitor'}</span>
                      {request.note && <span>{request.note}</span>}
                      <div className="info-chip-row" style={{ marginTop: '10px' }}>
                        <button type="button" className="pill-button pill-button-primary" onClick={() => void respondToMonitorRequest(request.id, 'approve')}>
                          Aprobar
                        </button>
                        <button type="button" className="pill-button pill-button-secondary" onClick={() => void respondToMonitorRequest(request.id, 'reject')}>
                          Rechazar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="info-note" style={{ marginTop: '12px' }}>
                  <i className="fa-solid fa-shield"></i> No tienes solicitudes pendientes.
                </div>
              )}
            </div>
          )}

          {!isReadOnly && (
            <div className="neu-card-sm">
              <h3 className="profile-section-title">
                <i className="fa-solid fa-bell" style={{ color: 'var(--primary)' }}></i>
                Notificaciones
              </h3>
              <p className="profile-description">
                Las pedimos cuando tú las activas para cuidar la experiencia. Asi puedes recibir avisos de actividad importante en conocidos y perfiles monitoreados.
              </p>
              <div className="info-chip-row" style={{ marginTop: '12px' }}>
                <span className={`badge ${notificationPermission === 'granted' ? 'badge-primary' : 'badge-secondary'}`}>
                  {notificationPermission === 'granted'
                    ? 'Activadas'
                    : notificationPermission === 'denied'
                      ? 'Bloqueadas'
                      : notificationPermission === 'unsupported'
                        ? 'No disponibles aquí'
                        : 'Pendientes'}
                </span>
                {notificationPermission !== 'granted' && (
                  <button type="button" className="pill-button pill-button-primary" onClick={handleEnableNotifications}>
                    <i className="fa-solid fa-bell"></i> Activar notificaciones
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="info-chip-row">
            {editing ? (
              <>
                <button type="button" className="pill-button pill-button-primary" onClick={handleSave} disabled={saving}>
                  <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-check'}`}></i>
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
                <button
                  type="button"
                  className="pill-button pill-button-secondary"
                  onClick={() => {
                    setEditing(false);
                    setProfileForm({
                      displayName: sourceProfile?.displayName || '',
                      profession: sourceProfile?.profession || '',
                      about: sourceProfile?.about || '',
                      tags: (sourceProfile?.tags || []).join(', '),
                      avatar: sourceProfile?.avatar || '',
                      manualStatus: sourceProfile?.manualStatus || 'en_línea',
                      profileAnswers: sourceProfile?.profileAnswers || {},
                    });
                  }}
                >
                  <i className="fa-solid fa-rotate-left"></i> Cancelar
                </button>
              </>
            ) : !isReadOnly ? (
              <button type="button" className="pill-button pill-button-primary" onClick={() => setEditing(true)}>
                <i className="fa-solid fa-pen"></i> Editar perfil completo
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="pill-button pill-button-primary"
                  onClick={() => navigate('/chat', { state: { provider: viewedProfile } })}
                >
                  <i className="fa-solid fa-comments"></i> Ir al chat
                </button>
                <button type="button" className="pill-button pill-button-secondary" onClick={() => navigate(location.state?.from || '/mapa')}>
                  <i className="fa-solid fa-arrow-left"></i> Volver
                </button>
              </>
            )}
          </div>

          <button onClick={handleLogout} className="btn-danger">
            <i className={`fa-solid ${isReadOnly ? 'fa-arrow-left' : 'fa-right-from-bracket'}`}></i> {isReadOnly ? 'Volver al mapa' : 'Cerrar sesión'}
          </button>
        </div>
      </div>
    </div>
  );
}
