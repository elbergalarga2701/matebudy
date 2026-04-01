import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { PASSWORD_RULE_HINT, evaluatePassword, validatePassword } from '../passwordRules';

const ROLE_OPTIONS = [
  {
    value: 'service_provider',
    title: 'Ofrece servicio',
    description: 'Ofrece ayuda profesional o tecnica, coordina disponibilidad y puede cobrar por el servicio.',
    icon: 'fa-solid fa-briefcase',
  },
  {
    value: 'monitor',
    title: 'Monitor',
    description: 'Monitorea a un familiar en tiempo real, bateria, recorrido, ubicacion y alertas.',
    icon: 'fa-solid fa-shield-halved',
  },
  {
    value: 'seeker',
    title: 'Necesito servicio',
    description: 'Busca ayuda, coordina sesiones y encuentra perfiles segun disponibilidad.',
    icon: 'fa-solid fa-magnifying-glass',
  },
  {
    value: 'companion',
    title: 'Especialista solidario',
    description: 'Brinda acompanamiento solidario sin cobrar, enfocado en apoyo humano.',
    icon: 'fa-solid fa-hand-holding-heart',
  },
];

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer la foto'));
    reader.readAsDataURL(file);
  });
}

export default function Register() {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState('service_provider');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [avatar, setAvatar] = useState('');
  const [avatarName, setAvatarName] = useState('');
  const [documentType, setDocumentType] = useState('ci');
  const [documentNumber, setDocumentNumber] = useState('');
  const [selfieFile, setSelfieFile] = useState(null);
  const [documentFile, setDocumentFile] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, registerAccountWithIdentity, logout } = useAuth();

  const selectedRole = useMemo(
    () => ROLE_OPTIONS.find((option) => option.value === role) || ROLE_OPTIONS[0],
    [role],
  );

  const passwordState = useMemo(
    () => evaluatePassword(password),
    [password],
  );

  useEffect(() => {
    if (error) setError('');
    if (success) setSuccess('');
  }, [step, role, name, email, password, confirm, documentType, documentNumber, selfieFile, documentFile]);

  const validateAccountFields = () => {
    setError('');
    setSuccess('');

    if (!name.trim()) {
      setError('El nombre es obligatorio');
      return false;
    }

    if (!email.trim()) {
      setError('El correo es obligatorio');
      return false;
    }

    if (!password || !confirm) {
      setError('Las contrasenas son obligatorias');
      return false;
    }

    if (password !== confirm) {
      setError('Las contrasenas no coinciden');
      return false;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.message || PASSWORD_RULE_HINT);
      return false;
    }

    return true;
  };

  const validateIdentityFields = () => {
    if (!documentNumber.trim()) {
      setError('Debes ingresar el numero del documento');
      return false;
    }

    if (!selfieFile || !documentFile) {
      setError('Debes subir la selfie y la foto o archivo del documento');
      return false;
    }

    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateAccountFields()) return;
    if (!validateIdentityFields()) return;

    setLoading(true);

    try {
      await registerAccountWithIdentity({
        name,
        email,
        password,
        role,
        avatar,
        documentType,
        documentNumber,
        selfieFile,
        documentFile,
      });
      setSuccess('Cuenta creada y enviada a revision de identidad.');
      setTimeout(() => navigate('/'), 900);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const nextAvatar = await fileToDataUrl(file);
      setAvatar(nextAvatar);
      setAvatarName(file.name);
    } catch (avatarError) {
      setError(avatarError.message);
    }
  };

  const handleNextStep = () => {
    if (step === 1) {
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!validateAccountFields()) return;
      setStep(3);
    }
  };

  const handlePrevStep = () => {
    setStep((current) => Math.max(1, current - 1));
  };

  if (user) {
    return (
      <div className="auth-container">
        <div className="auth-bg"></div>

        <div className="auth-card" style={{ maxWidth: '480px' }}>
          <div className="auth-header">
            <div className="auth-logo">M</div>
            <h1 className="auth-title">Ya hay una cuenta abierta</h1>
            <p className="auth-subtitle">
              Estas dentro como {user.displayName}. Si quieres crear otra cuenta, primero cerramos esta sesion.
            </p>
          </div>

          <div className="role-inline-summary" style={{ marginBottom: '24px' }}>
            <span className="badge badge-secondary">
              <i className="fa-solid fa-user"></i> {user.roleLabel || 'Cuenta actual'}
            </span>
            <p style={{ marginTop: '8px' }}>{user.email}</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
              <i className="fa-solid fa-house"></i> Seguir con esta cuenta
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                logout();
              }}
            >
              <i className="fa-solid fa-user-plus"></i> Cerrar sesion y crear otra
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-bg"></div>

      <div className="auth-shell">
        <section className="auth-hero-panel animate-in">
          <span className="auth-kicker">Alta Inicial</span>
          <h1 className="auth-hero-title">Crea tu cuenta en 3 pasos</h1>
          <p className="auth-hero-copy">
            Define tu rol, tus datos y verifica tu identidad. Un proceso rapido y seguro para unirte a la comunidad.
          </p>

          <div className="auth-hero-grid">
            <div className="auth-hero-chip">
              <i className="fa-solid fa-user-tag"></i>
              <span>Elige tu Rol</span>
            </div>
            <div className="auth-hero-chip">
              <i className="fa-solid fa-user"></i>
              <span>Tus Datos</span>
            </div>
            <div className="auth-hero-chip">
              <i className="fa-solid fa-id-card"></i>
              <span>Verificacion</span>
            </div>
          </div>
        </section>

        <section className="auth-card animate-scale">
          <div className="auth-brand-row">
            <div className="auth-logo">M</div>
            <div>
              <span className="auth-kicker">Cuenta Nueva</span>
              <h2 className="auth-title">Registro</h2>
            </div>
          </div>

          {/* Stepper */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                style={{
                  flex: 1,
                  height: '4px',
                  background: s <= step ? 'var(--gradient-primary)' : 'var(--bg-secondary)',
                  borderRadius: '2px',
                  transition: 'all var(--transition-base)',
                }}
              />
            ))}
          </div>

          {error && (
            <div className="alert alert-error">
              <i className="fa-solid fa-circle-exclamation"></i>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="alert alert-success">
              <i className="fa-solid fa-check-circle"></i>
              <span>{success}</span>
            </div>
          )}

          {/* STEP 1: Role Selection */}
          {step === 1 && (
            <div className="auth-form-shell">
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Elige tu rol</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Como vas a usar Matebudy?</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                {ROLE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRole(option.value)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '16px',
                      padding: '16px',
                      background: role === option.value ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-secondary)',
                      border: role === option.value ? '2px solid var(--primary)' : '2px solid transparent',
                      borderRadius: 'var(--radius-lg)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: 'var(--radius-md)',
                      background: role === option.value ? 'var(--gradient-primary)' : 'var(--bg-card)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <i className={option.icon} style={{
                        fontSize: '20px',
                        color: role === option.value ? 'white' : 'var(--text-muted)'
                      }}></i>
                    </div>
                    <div>
                      <strong style={{ display: 'block', fontSize: '15px', marginBottom: '4px' }}>
                        {option.title}
                      </strong>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {option.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: Account Details */}
          {step === 2 && (
            <div className="auth-form-shell">
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Tus datos</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Completa tu informacion basica</p>
              </div>

              {/* Avatar Upload */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                <label style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: 'var(--radius-full)',
                  background: avatar ? 'transparent' : 'var(--bg-secondary)',
                  border: '2px dashed var(--border-medium)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}>
                  {avatar ? (
                    <img src={avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <i className="fa-solid fa-camera" style={{ color: 'var(--text-muted)', fontSize: '24px' }}></i>
                  )}
                  <input type="file" accept="image/*" hidden onChange={handleAvatarChange} />
                </label>
                <div>
                  <strong style={{ display: 'block', fontSize: '14px', marginBottom: '4px' }}>Foto de perfil</strong>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{avatarName || 'Toca para subir una foto'}</p>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Nombre completo</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Como quieres que te llamen?"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Correo electronico</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Contrasena</label>
                <div className="password-field-shell">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={`form-input password-field-input ${password ? (passwordState.valid ? 'success' : 'error') : ''}`}
                    placeholder="Crea una contrasena segura"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button type="button" className="password-visibility-btn" onClick={() => setShowPassword((value) => !value)}>
                    <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
                {password && (
                  <>
                    <div className="password-strength">
                      <div className={`strength-bar ${passwordState.level >= 1 ? 'active weak' : ''}`}></div>
                      <div className={`strength-bar ${passwordState.level >= 2 ? 'active medium' : ''}`}></div>
                      <div className={`strength-bar ${passwordState.level >= 3 ? 'active strong' : ''}`}></div>
                    </div>
                    <div className={`form-hint ${passwordState.valid ? 'success' : 'warning'}`}>
                      <i className={`fa-solid ${passwordState.valid ? 'fa-check-circle' : 'fa-info-circle'}`}></i>
                      {passwordState.valid ? 'Contrasena segura' : PASSWORD_RULE_HINT}
                    </div>
                  </>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Confirmar contrasena</label>
                <div className="password-field-shell">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    className={`form-input password-field-input ${confirm && password === confirm ? 'success' : confirm ? 'error' : ''}`}
                    placeholder="Repite tu contrasena"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                  />
                  <button type="button" className="password-visibility-btn" onClick={() => setShowConfirmPassword((value) => !value)}>
                    <i className={`fa-solid ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
                {confirm && password !== confirm && (
                  <div className="form-hint warning">
                    <i className="fa-solid fa-circle-exclamation"></i>
                    Las contrasenas no coinciden
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Identity Verification */}
          {step === 3 && (
            <form onSubmit={handleSubmit} className="auth-form-shell">
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Verificacion de identidad</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Sube tu documento para activar tu cuenta</p>
              </div>

              {/* Document Type */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => setDocumentType('ci')}
                  style={{
                    padding: '16px',
                    background: documentType === 'ci' ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-secondary)',
                    border: documentType === 'ci' ? '2px solid var(--primary)' : '2px solid transparent',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  <i className="fa-solid fa-id-card" style={{ fontSize: '24px', color: documentType === 'ci' ? 'var(--primary)' : 'var(--text-muted)', marginBottom: '8px', display: 'block' }}></i>
                  <strong style={{ display: 'block', fontSize: '13px' }}>Cedula</strong>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Uruguaya</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDocumentType('passport')}
                  style={{
                    padding: '16px',
                    background: documentType === 'passport' ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-secondary)',
                    border: documentType === 'passport' ? '2px solid var(--primary)' : '2px solid transparent',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  <i className="fa-solid fa-passport" style={{ fontSize: '24px', color: documentType === 'passport' ? 'var(--primary)' : 'var(--text-muted)', marginBottom: '8px', display: 'block' }}></i>
                  <strong style={{ display: 'block', fontSize: '13px' }}>Pasaporte</strong>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Extranjero</span>
                </button>
              </div>

              <div className="form-group">
                <label className="form-label">Numero de documento</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder={documentType === 'ci' ? 'Ej: 12345678' : 'Ej: AB123456'}
                  value={documentNumber}
                  onChange={(event) => setDocumentNumber(event.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div style={{
                  padding: '16px',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center',
                }}>
                  <i className="fa-solid fa-camera" style={{ fontSize: '28px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}></i>
                  <strong style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Selfie</strong>
                  <input type="file" accept="image/*" style={{ fontSize: '10px' }} onChange={(event) => setSelfieFile(event.target.files?.[0] || null)} />
                  {selfieFile && <span style={{ fontSize: '10px', color: 'var(--success)', display: 'block', marginTop: '4px' }}>{selfieFile.name}</span>}
                </div>
                <div style={{
                  padding: '16px',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center',
                }}>
                  <i className="fa-solid fa-file-shield" style={{ fontSize: '28px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}></i>
                  <strong style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Documento</strong>
                  <input type="file" accept="image/*,.pdf" style={{ fontSize: '10px' }} onChange={(event) => setDocumentFile(event.target.files?.[0] || null)} />
                  {documentFile && <span style={{ fontSize: '10px', color: 'var(--success)', display: 'block', marginTop: '4px' }}>{documentFile.name}</span>}
                </div>
              </div>

              <div style={{
                padding: '14px',
                background: 'rgba(99, 102, 241, 0.1)',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                marginBottom: '16px',
              }}>
                <i className="fa-solid fa-info-circle" style={{ color: 'var(--primary)', marginTop: '2px' }}></i>
                <span>Tu cuenta se activara cuando revisemos tu identidad. Esto suele tomar menos de 24 horas.</span>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !documentNumber.trim() || !selfieFile || !documentFile}
                style={{ width: '100%' }}
              >
                {loading ? (
                  <>
                    <div className="spinner"></div>
                    Creando cuenta...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-badge-check"></i>
                    Crear cuenta
                  </>
                )}
              </button>
            </form>
          )}

          {/* Navigation Buttons */}
          {step < 3 && (
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handlePrevStep}
                disabled={step === 1}
                style={{ flex: 1 }}
              >
                <i className="fa-solid fa-arrow-left"></i> Atras
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleNextStep}
                style={{ flex: 1 }}
              >
                Siguiente <i className="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          )}

          <div className="auth-footer-row">
            <span className="auth-link-text">Ya tienes cuenta?</span>
            <button type="button" onClick={() => navigate('/login')} className="auth-link-btn">
              Inicia sesion
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
