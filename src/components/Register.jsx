import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const ROLE_OPTIONS = [
  {
    value: 'service_provider',
    title: 'Ofrece servicio',
    description: 'Ofrece ayuda profesiónal o técnica, coordina disponibilidad y puede cobrar por el servicio.',
    icon: 'fa-solid fa-briefcase',
  },
  {
    value: 'monitor',
    title: 'Monitor',
    description: 'Monitorea a un familiar en tiempo real, batería, recorrido, ubicación y recibe alertas del teléfono monitoreado.',
    icon: 'fa-solid fa-shield-halved',
  },
  {
    value: 'seeker',
    title: 'Necesito servicio',
    description: 'Busca ayuda, coordina sesiónes y encuentra perfiles según disponibilidad.',
    icon: 'fa-solid fa-magnifying-glass',
  },
  {
    value: 'companion',
    title: 'Especialista solidario',
    description: 'Brinda acompañamiento solidario sin cobrar, enfocado en apoyo humano.',
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
  const { user, registerAccount, logout } = useAuth();

  useEffect(() => {
    if (error) setError('');
    if (success) setSuccess('');
  }, [step, role, name, email, password, confirm, documentType, documentNumber, selfieFile, documentFile]);

  const selectedRole = useMemo(
    () => ROLE_OPTIONS.find((option) => option.value === role) || ROLE_OPTIONS[0],
    [role],
  );

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
      setError('Las contraseñas son obligatorias');
      return false;
    }

    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      return false;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return false;
    }

    return true;
  };

  const validateIdentityFields = () => {
    if (!documentNumber.trim()) {
      setError('Debes ingresar el número del documento');
      return false;
    }

    if (!selfieFile || !documentFile) {
      setError('Debes subir la selfie y la foto o archivo del documento');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateAccountFields()) {
      return;
    }

    setLoading(true);

    try {
      // Usar registro simple sin identidad por ahora
      await registerAccount({
        name,
        email,
        password,
        role,
        avatar,
      });
      setSuccess('Cuenta creada exitosamente.');
      setTimeout(() => navigate('/'), 900);
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  };

  const getPasswordStrength = () => {
    if (password.length === 0) return { level: 0, text: '' };
    if (password.length < 6) return { level: 1, text: 'Debil' };
    if (password.length < 8) return { level: 2, text: 'Media' };
    return { level: 3, text: 'Fuerte' };
  };

  const passwordStrength = getPasswordStrength();

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const nextAvatar = await fileToDataUrl(file);
      setAvatar(nextAvatar);
      setAvatarName(file.name);
    } catch (err) {
      setError(err.message);
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
        <div className="auth-bg">
          <div className="auth-decorations">
            <div className="auth-deco" style={{ top: '10%', left: '10%', width: '80px', height: '80px' }}></div>
            <div className="auth-deco" style={{ top: '60%', right: '15%', width: '60px', height: '60px' }}></div>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">M</div>
            <h1 className="auth-title">Ya hay una cuenta abierta</h1>
            <p className="auth-subtitle">
              Estás dentro como {user.displayName}. Si quieres crear otra cuenta, primero cerramos esta sesión.
            </p>
          </div>

          <div className="role-inline-summary">
            <span className="badge badge-secondary">
              <i className="fa-solid fa-user"></i> {user.roleLabel || 'Cuenta actual'}
            </span>
            <p>{user.email}</p>
          </div>

          <div className="page-stack">
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
              <i className="fa-solid fa-user-plus"></i> Cerrar sesión y crear otra
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-bg auth-bg-modern"></div>

      <div className="auth-shell auth-shell-wide">
        <section className="auth-hero-panel auth-hero-panel-compact">
          <span className="auth-kicker auth-kicker-dark">Alta inicial</span>
          <h1 className="auth-hero-title">Empieza con una cuenta que se sienta tuya.</h1>
          <p className="auth-hero-copy">
            Define tu rol, tu foto y tus datos base. Después continúas con verificación real para entrar a la app.
          </p>

          <div className="auth-hero-grid auth-hero-grid-tall">
            <div className="auth-hero-chip"><i className="fa-solid fa-user-group"></i><span>Rol claro</span></div>
            <div className="auth-hero-chip"><i className="fa-solid fa-camera"></i><span>Foto desde el alta</span></div>
            <div className="auth-hero-chip"><i className="fa-solid fa-id-card"></i><span>Identidad verificada</span></div>
          </div>
        </section>

        <section className="auth-card auth-card-wide auth-card-modern">
        <div className="auth-header">
          <div className="auth-brand-row">
            <div className="auth-logo auth-logo-modern">M</div>
            <div>
              <span className="auth-kicker">Cuenta nueva</span>
              <h1 className="auth-title" style={{ marginTop: '8px' }}>Crea tu cuenta</h1>
            </div>
          </div>
          <p className="auth-subtitle auth-subtitle-strong">
            Primero elegimos el rol. Después pasas a selfie y documento uruguayo real.
          </p>
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
        <div className="auth-stepper">
          {[1, 2, 3].map((entry) => (
            <button
              key={entry}
              type="button"
              className={`auth-step-pill ${step === entry ? 'active' : step > entry ? 'done' : ''}`}
              onClick={() => {
                if (entry <= step) setStep(entry);
              }}
            >
              <span>{entry}</span>
              <strong>{entry === 1 ? 'Rol' : entry === 2 ? 'Datos' : 'Identidad'}</strong>
            </button>
          ))}
        </div>

        {step === 1 && (
          <div className="auth-section auth-section-strong">
            <div className="auth-section-title">
              <strong>1. Elige tu rol</strong>
              <span>Paso 1 de 3. Define cómo vas a usar la app.</span>
            </div>

            <div className="role-grid-cards">
              {ROLE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`role-option-card ${role === option.value ? 'selected' : ''}`}
                  onClick={() => setRole(option.value)}
                >
                  <span className="role-option-icon">
                    <i className={option.icon}></i>
                  </span>
                  <div>
                    <strong>{option.title}</strong>
                    <p>{option.description}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="role-inline-summary">
              <span className="badge badge-secondary">
                <i className={selectedRole.icon}></i> {selectedRole.title}
              </span>
              <p>{selectedRole.description}</p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="auth-section auth-section-strong">
            <div className="auth-section-title">
              <strong>2. Tus datos</strong>
              <span>Paso 2 de 3. Deja lista la cuenta base.</span>
            </div>

            <div className="register-avatar-row">
              <label className="register-avatar-picker">
                {avatar ? (
                  <img src={avatar} alt="Vista previa del perfil" className="register-avatar-preview" />
                ) : (
                  <span className="register-avatar-placeholder">
                    <i className="fa-solid fa-camera"></i>
                  </span>
                )}
                <input type="file" accept="image/*" hidden onChange={handleAvatarChange} />
              </label>

              <div className="register-avatar-copy">
                <strong>Foto de perfil</strong>
                <p>Se guarda desde el alta para que tu cuenta no arranque sin identidad visual.</p>
                <span className={`upload-status ${avatar ? 'ready' : ''}`}>
                  {avatarName || 'Tocar para subir foto'}
                </span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Nombre completo</label>
              <input
                type="text"
                className={`form-input ${name && name.length > 2 ? 'success' : ''}`}
                placeholder="Cómo quieres que aparezca tu perfil?"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Correo electrónico</label>
              <input
                type="email"
                className={`form-input ${email && email.includes('@') ? 'success' : ''}`}
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contrasena</label>
              <div className="password-field-shell">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={`form-input password-field-input ${password ? (passwordStrength.level >= 2 ? 'success' : 'error') : ''}`}
                  placeholder="Crea una contraseña segura"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button type="button" className="password-visibility-btn" onClick={() => setShowPassword((value) => !value)}>
                  <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
              {password && (
                <div className="password-strength">
                  <div className={`strength-bar ${passwordStrength.level >= 1 ? 'active weak' : ''}`}></div>
                  <div className={`strength-bar ${passwordStrength.level >= 2 ? 'active medium' : ''}`}></div>
                  <div className={`strength-bar ${passwordStrength.level >= 3 ? 'active strong' : ''}`}></div>
                </div>
              )}
              {password && (
                <div className={`form-hint ${passwordStrength.level >= 2 ? 'success' : 'warning'}`}>
                  <i className={`fa-solid ${passwordStrength.level >= 2 ? 'fa-check-circle' : 'fa-info-circle'}`}></i>
                  {passwordStrength.text}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Confirmar contraseña</label>
              <div className="password-field-shell">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className={`form-input password-field-input ${confirm && password === confirm ? 'success' : confirm ? 'error' : ''}`}
                  placeholder="Repite tu contraseña"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
                <button type="button" className="password-visibility-btn" onClick={() => setShowConfirmPassword((value) => !value)}>
                  <i className={`fa-solid ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
              {confirm && password !== confirm && (
                <div className="form-error">
                  <i className="fa-solid fa-circle-exclamation"></i>
                  Las contraseñas no coinciden
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <form onSubmit={handleSubmit} className="auth-form-shell">
            <div className="auth-section auth-section-strong">
              <div className="auth-section-title">
                <strong>3. Identidad</strong>
                <span>Paso 3 de 3. Aquí subes selfie y documento uruguayo antes de entrar.</span>
              </div>

              <div className="form-group">
                <label className="form-label">Tipo de documento</label>
                <div className="role-grid-cards compact">
                  <button type="button" className={`role-option-card ${documentType === 'ci' ? 'selected' : ''}`} onClick={() => setDocumentType('ci')}>
                    <span className="role-option-icon"><i className="fa-solid fa-id-card"></i></span>
                    <div><strong>Cedula uruguaya</strong><p>Frente o foto clara del documento.</p></div>
                  </button>
                  <button type="button" className={`role-option-card ${documentType === 'passport' ? 'selected' : ''}`} onClick={() => setDocumentType('passport')}>
                    <span className="role-option-icon"><i className="fa-solid fa-passport"></i></span>
                    <div><strong>Pasaporte</strong><p>Numero tal cual aparece en el documento.</p></div>
                  </button>
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
                />
              </div>

              <div className="upload-grid">
                <div className="upload-card upload-card-file">
                  <span className="upload-card-icon"><i className="fa-solid fa-camera-retro"></i></span>
                  <strong>Selfie obligatoria</strong>
                  <p>Selecciona una selfie desde cámara o galería.</p>
                  <input type="file" accept="image/*" className="form-input" onChange={(e) => setSelfieFile(e.target.files?.[0] || null)} />
                  <span className={`upload-status ${selfieFile ? 'ready' : ''}`}>{selfieFile ? selfieFile.name : 'Seleccionar selfie'}</span>
                </div>

                <div className="upload-card upload-card-file">
                  <span className="upload-card-icon"><i className="fa-solid fa-file-shield"></i></span>
                  <strong>Foto o archivo del documento</strong>
                  <p>Aquí subes la CI o pasaporte. Imagen o PDF.</p>
                  <input type="file" accept="image/*,.pdf,application/pdf" className="form-input" onChange={(e) => setDocumentFile(e.target.files?.[0] || null)} />
                  <span className={`upload-status ${documentFile ? 'ready' : ''}`}>{documentFile ? documentFile.name : 'Seleccionar documento'}</span>
                </div>
              </div>

              <div className="info-note">
                <i className="fa-solid fa-id-card"></i>
                El acceso a la app se habilita solo cuando completes selfie + cédula uruguaya o pasaporte.
              </div>

              {role === 'monitor' && (
                <div className="info-note">
                  <i className="fa-solid fa-satellite-dish"></i>
                  La cuenta Monitor no responde preguntas de onboarding. Al aprobarse la identidad entra directo al panel de monitoreo familiar.
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-auth-main"
                disabled={loading || !name || !email || !password || !confirm || password !== confirm}
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
            </div>
          </form>
        )}

        <div className="auth-wizard-actions">
          <button type="button" className="pill-button pill-button-secondary" onClick={handlePrevStep} disabled={step === 1 || loading}>
            <i className="fa-solid fa-arrow-left"></i> Atrás
          </button>
          {step < 3 && (
            <button type="button" className="pill-button pill-button-primary" onClick={handleNextStep}>
              Siguiente <i className="fa-solid fa-arrow-right"></i>
            </button>
          )}
        </div>

        <div className="auth-footer-row">
          <p className="auth-link-text">Ya tienes una cuenta?</p>
          <button type="button" onClick={() => navigate('/login')} className="auth-link-btn">
            Inicia sesión aquí
          </button>
        </div>
      </section>
      </div>
    </div>
  );
}
