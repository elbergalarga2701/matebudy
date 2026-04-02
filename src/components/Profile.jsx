import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import packageJson from '../../package.json';
import { useAuth } from '../AuthContext';
import { forceAppReload, getNotificationPermissionState, requestMatebudyNotifications } from '../notifications';
import { publicFileUrl, runtimeIsNativePlatform, updateManifestUrl } from '../api';

const UPDATE_JSON_URL = updateManifestUrl();
const CURRENT_VERSION = import.meta.env.VITE_APP_VERSION || packageJson.version || '1.0.0';
const BUILD_ID_STORAGE_KEY = 'matebudy:last-seen-build-id';
const RELOAD_TOKEN_STORAGE_KEY = 'matebudy:last-reloaded-build-token';

function parseVersion(version) {
  const parts = String(version || '0.0.0').split('.').map((value) => Number(value) || 0);
  return (parts[0] * 10000) + (parts[1] * 100) + (parts[2] || 0);
}

function readStorage(storage, key) {
  try {
    return storage.getItem(key) || '';
  } catch {
    return '';
  }
}

function writeStorage(storage, key, value) {
  try {
    if (value) {
      storage.setItem(key, value);
    }
  } catch {
    // Ignore storage failures in restricted webviews.
  }
}

function resolveReloadToken(updateInfo) {
  return String(updateInfo?.buildId || updateInfo?.version || '').trim();
}

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
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [notificationPermission, setNotificationPermission] = useState(() => getNotificationPermissionState());
  const [updateStatus, setUpdateStatus] = useState({ checking: false, available: false, version: '' });
  const viewedProfile = location.state?.profile || null;
  const isReadOnlyProfile = Boolean(viewedProfile);

  // Si hay viewedProfile, mostrar ese perfil (modo solo lectura)
  const sourceProfile = viewedProfile ? viewedProfile : user;

  const [profileForm, setProfileForm] = useState(() => ({
    displayName: sourceProfile?.displayName || '',
    profession: sourceProfile?.profession || '',
    about: sourceProfile?.about || '',
    tags: (sourceProfile?.tags || []).join(', '),
    avatar: sourceProfile?.avatar || '',
    manualStatus: sourceProfile?.manualStatus || 'en_linea',
  }));

  const STATUS_OPTIONS = [
    { value: 'en_linea', label: 'En linea', icon: 'fa-solid fa-circle-check' },
    { value: 'ocupado', label: 'Ocupado', icon: 'fa-solid fa-clock' },
    { value: 'fuera_de_linea', label: 'Ausente', icon: 'fa-solid fa-circle-pause' },
  ];

  const showToast = (message, timeout = 3000) => {
    setToast(message);
    window.setTimeout(() => setToast(''), timeout);
  };

  const handleSave = async () => {
    if (isReadOnlyProfile) return;

    setSaving(true);
    try {
      await updateProfile({
        displayName: profileForm.displayName,
        profession: profileForm.profession,
        about: profileForm.about,
        avatar: profileForm.avatar,
        tags: profileForm.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        manualStatus: profileForm.manualStatus,
      });
      setEditing(false);
      showToast('Perfil actualizado correctamente');
    } catch (error) {
      showToast(error.message || 'No se pudo guardar el perfil');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (isReadOnlyProfile) {
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

  const handleQuickStatus = async (manualStatus) => {
    if (isReadOnlyProfile) return;
    setProfileForm((prev) => ({ ...prev, manualStatus }));
    setSaving(true);
    try {
      await updateProfile({ manualStatus });
      showToast('Estado actualizado');
    } catch (error) {
      showToast(error.message || 'No se pudo actualizar');
    } finally {
      setSaving(false);
    }
  };

  const handleNotifications = async () => {
    const result = await requestMatebudyNotifications();
    setNotificationPermission(result);
    showToast(result === 'granted' ? 'Notificaciones activadas' : 'Permiso denegado');
  };

  const checkForUpdates = async () => {
    if (!runtimeIsNativePlatform()) {
      showToast('Actualizaciones solo disponibles en la app movil');
      return;
    }

    setUpdateStatus({ checking: true, available: false, version: '' });
    try {
      const res = await fetch(UPDATE_JSON_URL, { cache: 'no-store' });

      if (!res.ok) {
        setUpdateStatus({ checking: false, available: false, version: '' });
        showToast('No hay actualizaciones disponibles');
        return;
      }

      const data = await res.json();
      const previousBuildId = readStorage(window.localStorage, BUILD_ID_STORAGE_KEY);
      const nextBuildId = String(data.buildId || '').trim();
      const isVersionUpdate = parseVersion(data.version) > parseVersion(CURRENT_VERSION);
      const isBuildUpdate = Boolean(nextBuildId && previousBuildId && nextBuildId !== previousBuildId);

      if (nextBuildId) {
        writeStorage(window.localStorage, BUILD_ID_STORAGE_KEY, nextBuildId);
      }

      if (data?.version && (isVersionUpdate || isBuildUpdate)) {
        setUpdateStatus({ checking: false, available: true, version: data.version });
        showToast(`Nueva version disponible: ${data.version}`);
        const reloadToken = resolveReloadToken(data);
        const lastReloadedToken = readStorage(window.sessionStorage, RELOAD_TOKEN_STORAGE_KEY);

        if (reloadToken && reloadToken !== lastReloadedToken) {
          writeStorage(window.sessionStorage, RELOAD_TOKEN_STORAGE_KEY, reloadToken);
          await forceAppReload();
        }
      } else {
        setUpdateStatus({ checking: false, available: false, version: '' });
        showToast('Ya tienes la ultima version');
      }
    } catch (error) {
      setUpdateStatus({ checking: false, available: false, version: '' });
      showToast('Sin actualizaciones disponibles');
    }
  };

  const currentAvatar = publicFileUrl(profileForm.avatar || sourceProfile?.avatar || '') || profileForm.avatar;

  return (
    <div className="profile-shell">
      {toast && <div className="toast">{toast}</div>}

      {/* Header Card */}
      <div className="profile-header animate-in">
        <div style={{ position: 'relative', display: 'inline-block' }}>
          {currentAvatar ? (
            <img src={currentAvatar} alt="Perfil" className="profile-avatar" style={{ objectFit: 'cover' }} />
          ) : (
            <div className="profile-avatar">
              {(profileForm.displayName || user?.displayName || '?').charAt(0).toUpperCase()}
            </div>
          )}

          {!isReadOnlyProfile && (
            <label style={{
              position: 'absolute',
              bottom: '4px',
              right: '4px',
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--gradient-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              border: '3px solid white',
              boxShadow: 'var(--shadow-md)',
            }}>
              <i className="fa-solid fa-camera" style={{ color: 'white', fontSize: '16px' }}></i>
              <input type="file" accept="image/*" hidden onChange={handleAvatarChange} />
            </label>
          )}
        </div>

        {editing && !isReadOnlyProfile ? (
          <input
            type="text"
            value={profileForm.displayName}
            onChange={(event) => setProfileForm((prev) => ({ ...prev, displayName: event.target.value }))}
            style={{
              textAlign: 'center',
              fontSize: '24px',
              fontWeight: 700,
              border: 'none',
              borderBottom: '2px solid var(--primary)',
              background: 'transparent',
              color: 'var(--text-primary)',
              marginTop: '16px',
              padding: '8px',
            }}
          />
        ) : (
          <h2 className="profile-name" style={{ marginTop: '16px' }}>
            {sourceProfile?.displayName || 'Usuario'}
          </h2>
        )}

        <p className="profile-role">{sourceProfile?.profession || sourceProfile?.roleLabel || 'Perfil'}</p>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '16px', flexWrap: 'wrap' }}>
          <span className="badge badge-primary">{sourceProfile?.roleLabel}</span>
          <span className="badge badge-secondary">
            {(profileForm.manualStatus || sourceProfile?.manualStatus || 'en_linea').replace(/_/g, ' ')}
          </span>
        </div>

        {/* Quick Status */}
        {!isReadOnlyProfile && (
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '20px', flexWrap: 'wrap' }}>
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => void handleQuickStatus(option.value)}
                disabled={saving}
                style={{
                  padding: '10px 18px',
                  borderRadius: 'var(--radius-full)',
                  border: profileForm.manualStatus === option.value ? '2px solid var(--primary)' : '2px solid var(--border-light)',
                  background: profileForm.manualStatus === option.value ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-card)',
                  color: profileForm.manualStatus === option.value ? 'var(--primary)' : 'var(--text-secondary)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <i className={option.icon}></i>
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '16px' }}>
          <i className="fa-solid fa-briefcase" style={{ fontSize: '24px', color: 'var(--success)', marginBottom: '8px' }}></i>
          <strong style={{ display: 'block', fontSize: '20px', fontWeight: 700 }}>0</strong>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Servicios</span>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '16px' }}>
          <i className="fa-solid fa-star" style={{ fontSize: '24px', color: 'var(--accent)', marginBottom: '8px' }}></i>
          <strong style={{ display: 'block', fontSize: '20px', fontWeight: 700 }}>-</strong>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Rating</span>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '16px' }}>
          <i className="fa-solid fa-heart" style={{ fontSize: '24px', color: 'var(--secondary)', marginBottom: '8px' }}></i>
          <strong style={{ display: 'block', fontSize: '20px', fontWeight: 700 }}>0</strong>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Apoyos</span>
        </div>
      </div>

      {/* Edit/View Sections */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa-solid fa-user-pen" style={{ color: 'var(--primary)' }}></i>
            Informacion personal
          </h3>
          {!isReadOnlyProfile && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setEditing(!editing)}
              disabled={saving}
              style={{ padding: '8px 16px', fontSize: '13px' }}
            >
              <i className={`fa-solid ${editing ? 'fa-check' : 'fa-pen'}`}></i>
              {editing ? 'Listo' : 'Editar'}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>Profesion o enfoque</label>
            {editing && !isReadOnlyProfile ? (
              <input
                type="text"
                className="form-input"
                value={profileForm.profession}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, profession: event.target.value }))}
                placeholder="Ej: Psicologo, Acompanante terapeutico..."
              />
            ) : (
              <p style={{ color: 'var(--text-primary)', fontSize: '15px' }}>{sourceProfile?.profession || 'Sin especificar'}</p>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>Sobre mi</label>
            {editing && !isReadOnlyProfile ? (
              <textarea
                className="form-input"
                rows={4}
                value={profileForm.about}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, about: event.target.value }))}
                placeholder="Cuentale a la comunidad quien eres..."
              />
            ) : (
              <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.6 }}>{sourceProfile?.about || 'Sin descripcion'}</p>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>Tags (separados por coma)</label>
            {editing && !isReadOnlyProfile ? (
              <input
                type="text"
                className="form-input"
                value={profileForm.tags}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, tags: event.target.value }))}
                placeholder="Ej: ansiedad, depresion, apoyo emocional"
              />
            ) : (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {(sourceProfile?.tags || []).length > 0 ? (
                  sourceProfile.tags.map((tag, i) => (
                    <span key={i} className="badge badge-secondary">{tag}</span>
                  ))
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Sin tags</span>
                )}
              </div>
            )}
          </div>
        </div>

        {editing && !isReadOnlyProfile && (
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
              style={{ flex: 1 }}
            >
              <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-check'}`}></i>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setEditing(false)}
              disabled={saving}
              style={{ flex: 1 }}
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* Settings */}
      {!isReadOnlyProfile && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa-solid fa-gear" style={{ color: 'var(--text-muted)' }}></i>
            Configuracion
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleNotifications}
              style={{ justifyContent: 'flex-start', padding: '14px 18px' }}
            >
              <i className="fa-solid fa-bell" style={{ color: 'var(--primary)' }}></i>
              <span style={{ flex: 1, textAlign: 'left' }}>Notificaciones</span>
              <span className="badge badge-secondary">{notificationPermission === 'granted' ? 'Activadas' : 'Desactivadas'}</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={checkForUpdates}
              disabled={updateStatus.checking}
              style={{ justifyContent: 'flex-start', padding: '14px 18px', position: 'relative' }}
            >
              <i className={`fa-solid ${updateStatus.checking ? 'fa-spinner fa-spin' : 'fa-arrow-rotate-right'}`} style={{ color: 'var(--accent)' }}></i>
              <span style={{ flex: 1, textAlign: 'left' }}>Buscar actualizacion</span>
              {updateStatus.available && (
                <span className="badge badge-accent">Nueva version</span>
              )}
              {updateStatus.checking && (
                <span className="badge badge-secondary">Verificando...</span>
              )}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleLogout}
              style={{ justifyContent: 'flex-start', padding: '14px 18px', borderColor: 'var(--danger)', color: 'var(--danger)' }}
            >
              <i className="fa-solid fa-right-from-bracket" style={{ color: 'var(--danger)' }}></i>
              <span style={{ flex: 1, textAlign: 'left' }}>Cerrar sesion</span>
            </button>
          </div>
        </div>
      )}

      {/* Back Button for ReadOnly */}
      {isReadOnlyProfile && (
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate(location.state?.from || '/mapa')}
          style={{ width: '100%' }}
        >
          <i className="fa-solid fa-arrow-left"></i>
          Volver
        </button>
      )}
    </div>
  );
}
