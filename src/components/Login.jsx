import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

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

  useEffect(() => {
    if (error) setError('');
  }, [email, password, recoveryEmail, recoveryPassword]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      const message = String(err?.message || '').trim();
      setError(
        /credenciales inv/i.test(message)
          ? 'Credenciales inválidas. Revisa tu correo y tu contraseña.'
          : message || 'No se pudo iniciar sesión. Verifica el backend y vuelve a intentar.',
      );
    }

    setLoading(false);
  };

  const handleRecovery = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await resetPassword({ email: recoveryEmail, password: recoveryPassword });
      setShowRecovery(false);
      setRecoveryPassword('');
      setPassword(recoveryPassword);
      setEmail(recoveryEmail);
      setError('Contrasena actualizada. Ahora puedes entrar con la nueva clave.');
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la contraseña');
    }

    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-bg auth-bg-modern"></div>

      <div className="auth-shell auth-shell-login">
        <section className="auth-hero-panel">
          <span className="auth-kicker auth-kicker-dark">MateBudy</span>
          <h1 className="auth-hero-title">Una app que acompaña de verdad.</h1>
          <p className="auth-hero-copy">
            Conversaciones, monitoreo y comunidad en una experiencia clara, moderna y centrada en personas.
          </p>

          <div className="auth-hero-grid">
            <div className="auth-hero-chip">
              <i className="fa-solid fa-sparkles"></i>
              <span>Entrada rapida</span>
            </div>
            <div className="auth-hero-chip">
              <i className="fa-solid fa-comments"></i>
              <span>Chats listos</span>
            </div>
            <div className="auth-hero-chip">
              <i className="fa-solid fa-shield-heart"></i>
              <span>Identidad cuidada</span>
            </div>
          </div>
        </section>

        <section className="auth-card auth-card-login auth-card-modern">
          <div className="auth-brand-row">
            <div className="auth-logo auth-logo-modern">M</div>
            <div>
              <span className="auth-kicker">Acceso</span>
              <h2 className="auth-title" style={{ marginTop: '8px' }}>Vuelve a entrar</h2>
            </div>
          </div>

          <p className="auth-subtitle auth-subtitle-strong">
            Entra a tu cuenta para seguir justo donde lo dejaste, sin perder tus conversaciones ni tu perfil.
          </p>

          {error && (
            <div className="alert alert-error">
              <i className="fa-solid fa-circle-exclamation"></i>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form-shell">
            <div className="auth-input-block">
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
                    className="form-input password-field-input"
                    placeholder="Tu clave segura"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button type="button" className="password-visibility-btn" onClick={() => setShowPassword((value) => !value)}>
                    <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>
            </div>

            <button type="button" className="ghost-link-button" onClick={() => setShowRecovery((value) => !value)}>
              {showRecovery ? 'Cerrar recuperación' : 'Olvidé mi contraseña'}
            </button>

            {showRecovery && (
              <div className="auth-section auth-section-soft">
                <div className="auth-section-title">
                  <strong>Recuperar acceso</strong>
                  <span>Escribe tu correo y define una nueva contraseña.</span>
                </div>

                <div className="auth-form-shell">
                  <div className="form-group">
                    <label className="form-label">Correo de la cuenta</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="tu@email.com"
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Nueva contraseña</label>
                    <div className="password-field-shell">
                      <input
                        type={showRecoveryPassword ? 'text' : 'password'}
                        className="form-input password-field-input"
                        placeholder="Nueva contraseña"
                        value={recoveryPassword}
                        onChange={(e) => setRecoveryPassword(e.target.value)}
                        minLength={6}
                        required
                      />
                      <button type="button" className="password-visibility-btn" onClick={() => setShowRecoveryPassword((value) => !value)}>
                        <i className={`fa-solid ${showRecoveryPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                      </button>
                    </div>
                  </div>

                  <button type="button" className="pill-button pill-button-primary" onClick={handleRecovery} disabled={loading || !recoveryEmail || recoveryPassword.length < 6}>
                    <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-key'}`}></i>
                    Actualizar contraseña
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
                  Iniciar sesión
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
