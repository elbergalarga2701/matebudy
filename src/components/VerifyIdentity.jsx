import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const DOCUMENT_OPTIONS = [
  { value: 'ci', label: 'Cedula de identidad uruguaya', helper: 'Ingresa 7 u 8 digitos sin puntos.' },
  { value: 'passport', label: 'Pasaporte uruguayo', helper: 'Ingresa el número tal como aparece en el documento.' },
];

export default function VerifyIdentity() {
  const [documentType, setDocumentType] = useState('ci');
  const [documentNumber, setDocumentNumber] = useState('');
  const [selfieFile, setSelfieFile] = useState(null);
  const [documentFile, setDocumentFile] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();
  const { user, verifyIdentity, resetVerificationSubmission, logout } = useAuth();

  const currentDocument = useMemo(
    () => DOCUMENT_OPTIONS.find((option) => option.value === documentType) || DOCUMENT_OPTIONS[0],
    [documentType],
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const result = await verifyIdentity({ documentType, documentNumber, selfieFile, documentFile });
      if (result.verificationStatus === 'under_review') {
        setSuccess('Documentos enviados. La cuenta quedo en revisión hasta comparar selfie y documento.');
      }
    } catch (err) {
      if (/failed to fetch/i.test(err.message)) {
        setError('No se pudo conectar con el servidor desde el teléfono. Revisa que el backend y el tunel sigan activos.');
      } else {
        setError(err.message);
      }
    }

    setLoading(false);
  };

  const isUnderReview = user?.verificationStatus === 'under_review';
  const isRejected = user?.verificationStatus === 'rejected';

  return (
    <div className="auth-container">
      <div className="auth-bg auth-bg-modern"></div>

      <div className="auth-shell auth-shell-wide">
        <section className="auth-hero-panel auth-hero-panel-compact">
          <span className="auth-kicker auth-kicker-dark">Seguridad</span>
          <h1 className="auth-hero-title">Verificamos identidad antes de abrir la app.</h1>
          <p className="auth-hero-copy">
            Aquí subes selfie y documento real. El flujo tiene que funcionar simple desde el movil, sin esconder la accion importante.
          </p>
        </section>

        <section className="auth-card auth-card-wide auth-card-modern">
        <div className="auth-header">
          <div className="auth-brand-row">
            <div className="auth-logo auth-logo-modern">
              <i className="fa-solid fa-shield-heart"></i>
            </div>
            <div>
              <span className="auth-kicker">Verificacion</span>
              <h1 className="auth-title" style={{ marginTop: '8px' }}>Verifica tu identidad</h1>
            </div>
          </div>
          <p className="auth-subtitle auth-subtitle-strong">
            {user?.displayName}, aquí exigimos selfie real y documento uruguayo antes de habilitar el acceso.
          </p>
        </div>

        <div className="auth-section auth-section-soft auth-section-strong">
          <div className="checklist-panel">
            <div className="checklist-item done">
              <i className="fa-solid fa-circle-check"></i>
              <span>Cuenta creada</span>
            </div>
            <div className={`checklist-item ${isUnderReview ? 'done' : 'current'}`}>
              <i className="fa-solid fa-camera"></i>
              <span>Selfie + documento uruguayo</span>
            </div>
            <div className={`checklist-item ${isUnderReview ? 'current' : ''}`}>
              <i className="fa-solid fa-list-check"></i>
              <span>Preguntas iniciales del perfil</span>
            </div>
          </div>
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

        {!isUnderReview && !isRejected ? (
          <form onSubmit={handleSubmit} className="auth-form-shell">
            <div className="auth-section auth-section-strong">
              <div className="auth-section-title">
                <strong>1. Documento</strong>
                <span>Selecciona el tipo e ingresa el número.</span>
              </div>

            <div className="form-group">
              <label className="form-label">Tipo de documento</label>
              <div className="role-grid-cards compact">
                {DOCUMENT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`role-option-card ${documentType === option.value ? 'selected' : ''}`}
                    onClick={() => setDocumentType(option.value)}
                  >
                    <span className="role-option-icon">
                      <i className={option.value === 'ci' ? 'fa-solid fa-id-card' : 'fa-solid fa-passport'}></i>
                    </span>
                    <div>
                      <strong>{option.label}</strong>
                      <p>{option.helper}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Numero del documento</label>
              <input
                type="text"
                className={`form-input ${documentNumber.trim() ? 'success' : ''}`}
                placeholder={documentType === 'ci' ? 'Ejemplo: 12345678' : 'Ejemplo: AB123456'}
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                required
              />
              <div className="form-hint success">
                <i className="fa-solid fa-circle-info"></i>
                {currentDocument.helper}
              </div>
            </div>
            </div>

            <div className="auth-section auth-section-strong">
              <div className="auth-section-title">
                <strong>2. Sube tus archivos</strong>
                <span>Necesitamos selfie y documento claros. Puedes tomar foto o elegir un archivo del dispositivo.</span>
              </div>

              <div className="upload-grid">
                <div className="upload-card upload-card-file">
                  <span className="upload-card-icon">
                    <i className="fa-solid fa-camera-retro"></i>
                  </span>
                  <strong>Selfie obligatoria</strong>
                  <p>Solo JPG, PNG o WEBP. Debe verse claramente tu rostro. Puedes abrir cámara o galería.</p>
                  <input
                    type="file"
                    accept="image/*,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    className="form-input"
                    onChange={(e) => setSelfieFile(e.target.files?.[0] || null)}
                  />
                  <span className={`upload-status ${selfieFile ? 'ready' : ''}`}>
                    {selfieFile ? selfieFile.name : 'Seleccionar selfie'}
                  </span>
                </div>

                <div className="upload-card upload-card-file">
                  <span className="upload-card-icon">
                    <i className="fa-solid fa-file-shield"></i>
                  </span>
                  <strong>Documento uruguayo</strong>
                  <p>Solo cédula o pasaporte. Formatos admitidos: JPG, PNG, WEBP o PDF. Puedes elegir una foto ya guardada.</p>
                  <input
                    type="file"
                    accept="image/*,.jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                    className="form-input"
                    onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                  />
                  <span className={`upload-status ${documentFile ? 'ready' : ''}`}>
                    {documentFile ? documentFile.name : 'Seleccionar documento'}
                  </span>
                </div>
              </div>
            </div>

            <div className="info-note">
              <i className="fa-solid fa-lock"></i>
              Importante: esta version local todavía no hace biometria real. Solo deja el caso en revisión y no aprueba automaticamente.
            </div>

            <button type="submit" className="btn btn-primary btn-auth-main" disabled={loading || !selfieFile || !documentFile || !documentNumber.trim()}>
              {loading ? (
                <>
                  <div className="spinner"></div>
                  Enviando a revisión...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-badge-check"></i>
                  Enviar documentos
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="page-stack">
            <div className="empty-state">
              <div className="empty-state-icon">
                <i className="fa-solid fa-user-check"></i>
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '6px' }}>
                {isRejected ? 'Identidad rechazada' : 'Identidad en revisión'}
              </h3>
              <p style={{ color: 'var(--text-medium)', lineHeight: 1.6 }}>
                {isRejected
                  ? 'La identidad fue rechazada. Revisa las observaciones y vuelve a enviar selfie y documento.'
                  : 'La cuenta no entra a la app hasta que una revisión administrativa confirme selfie y documento.'}
              </p>
            </div>

            <div className="role-inline-summary">
              <span className="badge badge-secondary">
                <i className="fa-solid fa-id-card"></i> {user?.verificationData?.documentType === 'ci' ? 'Cedula uruguaya' : 'Pasaporte uruguayo'}
              </span>
              <p>
                Documento enviado: {user?.verificationData?.documentName || 'Sin archivo'}.
                Selfie enviada: {user?.verificationData?.selfieName || 'Sin archivo'}.
              </p>
            </div>

            {isRejected && user?.verificationReview?.notes && (
              <div className="alert alert-error">
                <i className="fa-solid fa-message"></i>
                <span>Motivo del rechazo: {user.verificationReview.notes}</span>
              </div>
            )}

            <div className="info-note">
              <i className="fa-solid fa-user-shield"></i>
              El equipo revisara manualmente la documentacion antes de habilitar el acceso completo.
            </div>

            {isRejected && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={async () => {
                  await resetVerificationSubmission();
                  navigate('/verificacion', { replace: true });
                }}
              >
                <i className="fa-solid fa-rotate-right"></i> Reenviar documentos
              </button>
            )}
          </div>
        )}

        <button type="button" className="ghost-link-button" onClick={logout}>
          Salir de esta cuenta
        </button>
      </section>
      </div>
    </div>
  );
}
