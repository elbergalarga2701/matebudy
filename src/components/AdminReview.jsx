import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { apiUrl } from '../api';

function getPaymentDefaults() {
  const browserOrigin = typeof window !== 'undefined' && /^https?:/i.test(window.location.origin)
    ? window.location.origin
    : '';
  const apiOrigin = (() => {
    try {
      const base = apiUrl('/api/health');
      return /^https?:/i.test(base) ? new URL(base).origin : browserOrigin;
    } catch (error) {
      return browserOrigin;
    }
  })();
  const appOrigin = browserOrigin || apiOrigin || 'http://localhost:5173';

  return {
    mpEnvironment: 'test',
    mpPublicKey: '',
    mpAccessToken: '',
    mpWebhookUrl: '',
    mpSuccessUrl: `${appOrigin}/chat?payment=success`,
    mpPendingUrl: `${appOrigin}/chat?payment=pending`,
    mpFailureUrl: `${appOrigin}/chat?payment=failure`,
  };
}

function normalizeReturnUrl(value, fallback) {
  if (!value) return fallback;

  try {
    const url = new URL(value);
    const fallbackUrl = new URL(fallback);
    if (['localhost', '127.0.0.1'].includes(url.hostname) && fallbackUrl.origin !== url.origin) {
      return `${fallbackUrl.origin}${url.pathname}${url.search}`;
    }
    return value;
  } catch (error) {
    return fallback;
  }
}

function explainAdminNetworkError(error, fallbackMessage) {
  const message = String(error?.message || '').trim();

  if (!message) {
    return fallbackMessage;
  }

  if (
    /failed to fetch|load failed|networkerror|network request failed|fetch/i.test(message)
    || /cors|json/i.test(message)
  ) {
    return `${fallbackMessage}. Verifica que el backend de MateBudy este encendido y respondiendo en /api.`;
  }

  return message;
}

export default function AdminReview() {
  const { adminUnlocked, unlockAdmin, lockAdmin, listVerificationQueue, setVerificationDecision, roleMeta, billingConfig, updateBillingConfig } = useAuth();
  const [code, setCode] = useState(() => localStorage.getItem('mate_admin_code') || '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [notesById, setNotesById] = useState({});
  const [queue, setQueue] = useState([]);
  const [paymentSettings, setPaymentSettings] = useState(() => getPaymentDefaults());
  const [pricingForm, setPricingForm] = useState({
    instantRate: '',
    installmentsRate: '',
    minAppRate: '',
    maxAppRate: '',
  });

  const mediaUrl = (value) => {
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith('/uploads')) {
      const isCapacitor = typeof window !== 'undefined' && window.location.protocol === 'capacitor:';
      const socketUrl = isCapacitor ? 'https://matebudy.onrender.com' : (import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000');
      return `${socketUrl}${value}`;
    }
    return apiUrl(value);
  };

  const refreshQueue = async () => {
    try {
      const nextQueue = await listVerificationQueue();
      setQueue(nextQueue);
    } catch (err) {
      setError(explainAdminNetworkError(err, 'No se pudo cargar la cola de revisión'));
    }
  };

  const parseJsonResponse = async (response, fallbackMessage) => {
    const raw = await response.text();
    let data = {};

    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch (err) {
        throw new Error(fallbackMessage);
      }
    }

    if (!response.ok) {
      throw new Error(data.error || fallbackMessage);
    }

    return data;
  };

  useEffect(() => {
    setPricingForm({
      instantRate: String(Math.round((billingConfig.instantRate || 0) * 10000) / 100),
      installmentsRate: String(Math.round((billingConfig.installmentsRate || 0) * 10000) / 100),
      minAppRate: String(Math.round((billingConfig.minAppRate || 0) * 10000) / 100),
      maxAppRate: String(Math.round((billingConfig.maxAppRate || 0) * 10000) / 100),
    });
  }, [billingConfig]);

  useEffect(() => {
    if (!adminUnlocked || !code) return;

    const loadPaymentSettings = async () => {
      try {
        const response = await fetch(apiUrl('/api/admin/settings/payment'), {
          headers: {
            'x-admin-code': code,
          },
        });

        const data = await parseJsonResponse(
          response,
          'No se pudo cargar la configuración de pagos. Reinicia el backend con `cd server` y `npm start`.',
        );

        const defaults = getPaymentDefaults();
        setPaymentSettings({
          mpEnvironment: data.mpEnvironment || defaults.mpEnvironment,
          mpPublicKey: data.mpPublicKey || defaults.mpPublicKey,
          mpAccessToken: data.mpAccessToken || defaults.mpAccessToken,
          mpWebhookUrl: data.mpWebhookUrl || defaults.mpWebhookUrl,
          mpSuccessUrl: normalizeReturnUrl(data.mpSuccessUrl, defaults.mpSuccessUrl),
          mpPendingUrl: normalizeReturnUrl(data.mpPendingUrl, defaults.mpPendingUrl),
          mpFailureUrl: normalizeReturnUrl(data.mpFailureUrl, defaults.mpFailureUrl),
        });
      } catch (err) {
        setError(explainAdminNetworkError(err, 'No se pudo cargar la configuración de pagos'));
      }
    };

    loadPaymentSettings();
  }, [adminUnlocked, code]);

  useEffect(() => {
    if (!adminUnlocked) return;

    void refreshQueue();
    const intervalId = window.setInterval(() => {
      void refreshQueue();
    }, 2500);
    const onStorage = (event) => {
      if (event.key === 'mate_user') {
        void refreshQueue();
      }
    };

    window.addEventListener('storage', onStorage);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('storage', onStorage);
    };
  }, [adminUnlocked]);

  const handleUnlock = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      unlockAdmin(code);
      setSuccess('Revision administrativa habilitada');
      void refreshQueue();
    } catch (err) {
      setError(explainAdminNetworkError(err, 'No se pudo habilitar la revisión administrativa'));
    }
  };

  const handleDecision = async (userId, decisión) => {
    setError('');
    setSuccess('');

    try {
      await setVerificationDecision({ userId, decisión, notes: notesById[userId] || '' });
      setSuccess(decisión === 'approved' ? 'Identidad aprobada' : 'Identidad rechazada');
      await refreshQueue();
    } catch (err) {
      setError(explainAdminNetworkError(err, 'No se pudo guardar la decisión'));
    }
  };

  const handlePricingSave = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const nextConfig = {
      instantRate: Number(pricingForm.instantRate) / 100,
      installmentsRate: Number(pricingForm.installmentsRate) / 100,
      minAppRate: Number(pricingForm.minAppRate) / 100,
      maxAppRate: Number(pricingForm.maxAppRate) / 100,
    };

    if (Object.values(nextConfig).some((value) => Number.isNaN(value) || value < 0)) {
      setError('Todos los porcentajes deben ser números válidos mayores o iguales a cero');
      return;
    }

    if (nextConfig.minAppRate > nextConfig.maxAppRate) {
      setError('La comisión mínima de la app no puede ser mayor que la máxima');
      return;
    }

    try {
      updateBillingConfig(nextConfig);
      setSuccess('Configuracion de cobros actualizada');
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePaymentSettingsSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await fetch(apiUrl('/api/admin/settings/payment'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-code': code,
        },
        body: JSON.stringify(paymentSettings),
      });

      await parseJsonResponse(
        response,
        'No se pudo guardar la configuración de Mercado Pago. Reinicia el backend con `cd server` y `npm start`.',
      );

      setSuccess('Configuracion de Mercado Pago actualizada');
    } catch (err) {
      setError(explainAdminNetworkError(err, 'No se pudo guardar la configuración de Mercado Pago'));
    }
  };

  if (!adminUnlocked) {
    return (
      <div className="auth-container">
        <div className="auth-bg"></div>
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">
              <i className="fa-solid fa-user-shield"></i>
            </div>
            <h1 className="auth-title">Revision administrativa</h1>
            <p className="auth-subtitle">Pantalla local para aprobar o rechazar identidades sin servicios pagos.</p>
          </div>

          {error && (
            <div className="alert alert-error">
              <i className="fa-solid fa-circle-exclamation"></i>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="alert alert-success">
              <i className="fa-solid fa-circle-check"></i>
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleUnlock}>
            <div className="form-group">
              <label className="form-label">Código administrativo local</label>
              <input
                type="password"
                className="form-input"
                placeholder="Ingresa el código"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>

            <div className="info-note">
              <i className="fa-solid fa-key"></i>
              Código actual de prueba: <strong style={{ marginLeft: '4px' }}>matebudy-admin-uy</strong>
            </div>

            <button type="submit" className="btn btn-primary">
              <i className="fa-solid fa-lock-open"></i> Entrar a revisión
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-scroll" style={{ minHeight: '100vh', padding: '0 0 40px' }}>
      <div className="page-shell page-stack">
        <section className="hero-banner">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: '30px', fontWeight: 800, marginBottom: '10px' }}>Cola de revisión manual</h1>
              <p style={{ fontSize: '15px', lineHeight: 1.6, opacity: 0.92 }}>
                Aquí puedes revisar identidades pendientes y aprobar o rechazar sin depender de servicios externos.
              </p>
            </div>
            <div className="info-chip-row">
              <span className="badge badge-accent">
                <i className="fa-solid fa-rotate"></i> Auto refresh 2.5s
              </span>
              <button type="button" className="pill-button pill-button-secondary" onClick={lockAdmin}>
                <i className="fa-solid fa-right-from-bracket"></i> Cerrar revisión
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div className="alert alert-error">
            <i className="fa-solid fa-circle-exclamation"></i>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            <i className="fa-solid fa-circle-check"></i>
            <span>{success}</span>
          </div>
        )}

        <section className="surface-card" style={{ padding: '18px' }}>
          <div className="section-title" style={{ marginBottom: '14px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Configuracion de cobros</h2>
            <p style={{ fontSize: '14px' }}>
              Aquí ajustas los porcentajes que la app absorbe dentro del total final que paga el cliente.
            </p>
          </div>

          <form onSubmit={handlePricingSave} className="billing-grid">
            <div className="form-group">
              <label className="form-label">Mercado Pago instantáneo %</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={pricingForm.instantRate}
                onChange={(e) => setPricingForm((prev) => ({ ...prev, instantRate: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Extra por cuotas %</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={pricingForm.installmentsRate}
                onChange={(e) => setPricingForm((prev) => ({ ...prev, installmentsRate: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Comision mínima app %</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={pricingForm.minAppRate}
                onChange={(e) => setPricingForm((prev) => ({ ...prev, minAppRate: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Comision máxima app %</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={pricingForm.maxAppRate}
                onChange={(e) => setPricingForm((prev) => ({ ...prev, maxAppRate: e.target.value }))}
              />
            </div>

            <div className="billing-actions">
              <button type="submit" className="pill-button pill-button-primary">
                <i className="fa-solid fa-floppy-disk"></i> Guardar porcentajes
              </button>
            </div>
          </form>

          <div className="info-chip-row" style={{ marginTop: '8px' }}>
            <span className="badge badge-secondary">Instante: {pricingForm.instantRate}%</span>
            <span className="badge badge-secondary">Cuotas: {pricingForm.installmentsRate}%</span>
            <span className="badge badge-accent">App: {pricingForm.minAppRate}% a {pricingForm.maxAppRate}%</span>
          </div>
        </section>

        <section className="surface-card" style={{ padding: '18px' }}>
          <div className="section-title" style={{ marginBottom: '14px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Mercado Pago</h2>
            <p style={{ fontSize: '14px' }}>
              Aquí solo necesitas pegar las credenciales. Las URLs locales ya quedan completas por defecto.
            </p>
          </div>

          <div className="info-note" style={{ marginBottom: '14px' }}>
            <i className="fa-solid fa-triangle-exclamation"></i>
            Define si esta integracion corre en prueba o producción. El frontend de pago usara ese modo para mostrar instrucciones correctas y evitar mezclar compradores de prueba con cobros reales.
          </div>

          <form onSubmit={handlePaymentSettingsSave} className="billing-grid">
            <div className="form-group">
              <label className="form-label">Modo</label>
              <select
                className="form-input"
                value={paymentSettings.mpEnvironment}
                onChange={(e) => setPaymentSettings((prev) => ({ ...prev, mpEnvironment: e.target.value }))}
              >
                <option value="test">Prueba</option>
                <option value="production">Produccion</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Public Key</label>
              <input
                type="text"
                className="form-input"
                value={paymentSettings.mpPublicKey}
                onChange={(e) => setPaymentSettings((prev) => ({ ...prev, mpPublicKey: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Access Token</label>
              <input
                type="text"
                className="form-input"
                value={paymentSettings.mpAccessToken}
                onChange={(e) => setPaymentSettings((prev) => ({ ...prev, mpAccessToken: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Webhook URL</label>
              <input
                type="text"
                className="form-input"
                placeholder="Se completa cuando tengamos una URL pública"
                value={paymentSettings.mpWebhookUrl}
                onChange={(e) => setPaymentSettings((prev) => ({ ...prev, mpWebhookUrl: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Success URL</label>
              <input
                type="text"
                className="form-input"
                value={paymentSettings.mpSuccessUrl}
                readOnly
              />
            </div>

            <div className="form-group">
              <label className="form-label">Pending URL</label>
              <input
                type="text"
                className="form-input"
                value={paymentSettings.mpPendingUrl}
                readOnly
              />
            </div>

            <div className="form-group">
              <label className="form-label">Failure URL</label>
              <input
                type="text"
                className="form-input"
                value={paymentSettings.mpFailureUrl}
                readOnly
              />
            </div>

            <div className="billing-actions">
              <button type="submit" className="pill-button pill-button-primary">
                <i className="fa-solid fa-credit-card"></i> Guardar Mercado Pago
              </button>
            </div>
          </form>

          <div className="info-chip-row" style={{ marginTop: '8px' }}>
            <span className={`badge ${paymentSettings.mpEnvironment === 'production' ? 'badge-primary' : 'badge-accent'}`}>
              {paymentSettings.mpEnvironment === 'production' ? 'Modo producción' : 'Modo prueba'}
            </span>
          </div>
        </section>

        {queue.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <i className="fa-solid fa-inbox"></i>
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '6px' }}>No hay revisiónes pendientes</h3>
            <p style={{ color: 'var(--text-medium)', lineHeight: 1.6 }}>
              Cuando un usuario envíe selfie y documento uruguayo aparecerá aquí para revisión manual.
            </p>
          </div>
        ) : (
          <div className="list-stack">
            {queue.map((entry) => (
              <div key={entry.id} className="surface-card" style={{ padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                  <div>
                    <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-dark)' }}>{entry.name}</h3>
                    <p style={{ color: 'var(--text-medium)', marginTop: '4px' }}>{entry.email}</p>
                  </div>
                  <div className="info-chip-row">
                    <span className="badge badge-secondary">{roleMeta[entry.role]?.label || entry.role}</span>
                    <span className="badge badge-primary">{entry.verificationStatus}</span>
                  </div>
                </div>

                <div className="mini-stat-grid" style={{ marginBottom: '14px' }}>
                  <div className="mini-stat-card">
                    <strong>{entry.verificationData?.documentType === 'ci' ? 'Cedula' : 'Pasaporte'}</strong>
                    <span>{entry.verificationData?.documentNumber}</span>
                  </div>
                  <div className="mini-stat-card">
                    <strong>Archivos</strong>
                    <span>{entry.verificationData?.selfieName} / {entry.verificationData?.documentName}</span>
                  </div>
                </div>

                <div className="review-media-grid">
                  <div className="review-media-card">
                    <strong>Selfie</strong>
                    {entry.verificationData?.selfiePreview ? (
                      <img src={mediaUrl(entry.verificationData.selfiePreview)} alt={`Selfie de ${entry.name}`} className="review-media-image" />
                    ) : (
                      <div className="review-media-empty">Sin vista previa</div>
                    )}
                  </div>

                  <div className="review-media-card">
                    <strong>Documento</strong>
                    {entry.verificationData?.documentPreview ? (
                      <img src={mediaUrl(entry.verificationData.documentPreview)} alt={`Documento de ${entry.name}`} className="review-media-image" />
                    ) : (
                      <div className="review-media-empty">
                        <i className="fa-solid fa-file-pdf"></i>
                        <span>Documento PDF sin vista previa</span>
                      </div>
                    )}
                    {entry.verificationData?.documentFileUrl && (
                      <a
                        href={mediaUrl(entry.verificationData.documentFileUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="auth-link-btn"
                        style={{ display: 'inline-flex', marginTop: '10px' }}
                      >
                        Abrir archivo original
                      </a>
                    )}
                  </div>
                </div>

                {entry.verificationReview?.notes && (
                  <div className="info-note">
                    <i className="fa-solid fa-note-sticky"></i>
                    Última nota: {entry.verificationReview.notes}
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Notas de revisión</label>
                  <textarea
                    className="form-input textarea-field"
                    rows={3}
                    placeholder="Escribe observaciones, por ejemplo: selfie borrosa o documento ilegible."
                    value={notesById[entry.id] || ''}
                    onChange={(e) => setNotesById((prev) => ({ ...prev, [entry.id]: e.target.value }))}
                  />
                </div>

                <div className="info-chip-row">
                  <button type="button" className="pill-button pill-button-primary" onClick={() => handleDecision(entry.id, 'approved')}>
                    <i className="fa-solid fa-circle-check"></i> Aprobar
                  </button>
                  <button type="button" className="pill-button pill-button-secondary" onClick={() => handleDecision(entry.id, 'rejected')}>
                    <i className="fa-solid fa-circle-xmark"></i> Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
