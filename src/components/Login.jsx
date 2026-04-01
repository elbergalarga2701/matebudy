import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { PASSWORD_RULE_HINT, validatePassword } from '../passwordRules';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, resetPassword } = useAuth();

  const recoveryPasswordState = useMemo(
    () => validatePassword(recoveryPassword),
    [recoveryPassword],
  );

  useEffect(() => {
    if (error) setError('');
  }, [email, password, recoveryEmail, recoveryPassword]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (loginError) {
      const message = String(loginError?.message || '').trim();
      setError(
        /credenciales inv/i.test(message)
          ? 'Credenciales invalidas. Revisa tu correo y tu contrasena.'
          : message || 'No se pudo iniciar sesion. Verifica el backend y vuelve a intentar.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRecovery = async (event) => {
    event.preventDefault();
    setError('');

    if (!recoveryPasswordState.valid) {
      setError(recoveryPasswordState.message || PASSWORD_RULE_HINT);
      return;
    }

    setLoading(true);

    try {
      await resetPassword({ email: recoveryEmail, password: recoveryPassword });
      setShowRecovery(false);
      setRecoveryPassword('');
      setPassword(recoveryPassword);
      setEmail(recoveryEmail);
      setError('Contrasena actualizada. Ahora puedes entrar con la nueva clave.');
    } catch (recoveryError) {
      setError(recoveryError.message || 'No se pudo actualizar la contrasena');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-bg"></div>

      <div className="auth-shell">
        <section className="auth-hero-panel animate-in">
          <span className="auth-kicker">Bienvenido a Matebudy</span>
          <h1 className="auth-hero-title">
            Tu espacio seguro de conexion y apoyo
          </h1>
          <p className="auth-hero-copy">
            Unete a una comunidad que cuida de ti. Conversaciones reales,
            monitoreo responsable y acompanamiento cuando mas lo necesitas.
          </p>

          <div className="auth-hero-grid">
            <div className="auth-hero-chip">
              <i className="fa-solid fa-bolt"></i>
              <span>Acceso Rapido</span>
            </div>
            <div className="auth-hero-chip">
              <i className="fa-solid fa-comments"></i>
              <span>Chat Seguro</span>
            </div>
            <div className="auth-hero-chip">
              <i className="fa-solid fa-shield-heart"></i>
              <span>Identidad Verificada</span>
            </div>
          </div>
        </section>

        <section className="auth-card animate-scale">
          <div className="auth-brand-row">
            <div className="auth-logo">M</div>
            <div>
              <span className="auth-kicker">Iniciar Sesion</span>
              <h2 className="auth-title">Vuelve a entrar</h2>
            </div>
          </div>

          <p className="auth-subtitle">
            Ingresa tus credenciales para continuar donde lo dejaste.
            Tus conversaciones y perfil te estan esperando.
          </p>

          {error && (
            <div className="alert alert-error">
              <i className="fa-solid fa-circle-exclamation"></i>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form-shell">
            <div className="form-group">
              <label className="form-label">Correo electronico</label>
              <input
                type="email"
                className={`form-input ${email && email.includes('@') ? 'success' : ''}`}
                placeholder="tu@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contrasena</label>
              <div className="password-field-shell">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input password-field-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button type="button" className="password-visibility-btn" onClick={() => setShowPassword((value) => !value)}>
                  <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            <button type="button" className="ghost-link-button" onClick={() => setShowRecovery((value) => !value)}>
              {showRecovery ? 'Cerrar recuperacion' : 'Olvide mi contrasena'}
            </button>

            {showRecovery && (
              <div className="auth-section">
                <div className="auth-section-title">
                  <strong>Recuperar acceso</strong>
                  <span>Escribe tu correo y define una nueva contrasena.</span>
                </div>

                <div className="auth-form-shell">
                  <div className="form-group">
                    <label className="form-label">Correo de la cuenta</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="tu@email.com"
                      value={recoveryEmail}
                      onChange={(event) => setRecoveryEmail(event.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Nueva contrasena</label>
                    <div className="password-field-shell">
                      <input
                        type={showRecoveryPassword ? 'text' : 'password'}
                        className={`form-input password-field-input ${recoveryPassword ? (recoveryPasswordState.valid ? 'success' : 'error') : ''}`}
                        placeholder="Nueva contrasena"
                        value={recoveryPassword}
                        onChange={(event) => setRecoveryPassword(event.target.value)}
                        required
                      />
                      <button type="button" className="password-visibility-btn" onClick={() => setShowRecoveryPassword((value) => !value)}>
                        <i className={`fa-solid ${showRecoveryPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                      </button>
                    </div>
                    {recoveryPassword && (
                      <div className="password-strength">
                        <div className={`strength-bar ${recoveryPasswordState.level >= 1 ? 'active weak' : ''}`}></div>
                        <div className={`strength-bar ${recoveryPasswordState.level >= 2 ? 'active medium' : ''}`}></div>
                        <div className={`strength-bar ${recoveryPasswordState.level >= 3 ? 'active strong' : ''}`}></div>
                      </div>
                    )}
                    <div className={`form-hint ${recoveryPasswordState.valid ? 'success' : 'warning'}`}>
                      <i className={`fa-solid ${recoveryPasswordState.valid ? 'fa-check-circle' : 'fa-info-circle'}`}></i>
                      {recoveryPassword ? (recoveryPasswordState.valid ? 'Contrasena segura' : PASSWORD_RULE_HINT) : PASSWORD_RULE_HINT}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleRecovery}
                    disabled={loading || !recoveryEmail || !recoveryPasswordState.valid}
                  >
                    <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-key'}`}></i>
                    Actualizar contrasena
                  </button>
                </div>
              </div>
            )}

            <button type="submit" disabled={loading || !email || !password} className="btn btn-primary btn-auth-main">
              {loading ? (
                <>
                  <div className="spinner"></div>
                  Entrando...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-arrow-right-to-bracket"></i>
                  Iniciar sesion
                </>
              )}
            </button>
          </form>

          <div className="auth-footer-row">
            <span className="auth-link-text">Todavia no tienes cuenta?</span>
            <button type="button" onClick={() => navigate('/register')} className="auth-link-btn">
              Crear una ahora
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
