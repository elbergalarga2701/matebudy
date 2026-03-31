import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const QUESTION_BANK = {
  seeker: [
    { id: 'occupation', label: 'A que te dedicas?', placeholder: 'Ejemplo: estudiante universitario' },
    { id: 'availability', label: 'Que horarios tienes libres?', placeholder: 'Ejemplo: lunes a jueves de 18 a 22' },
    { id: 'needs', label: 'Que tipo de ayuda buscas?', placeholder: 'Ejemplo: calculo, apoyo para estudiar y acompañamiento' },
    { id: 'modality', label: 'Como prefieres recibir el apoyo?', placeholder: 'Ejemplo: virtual, presencial o mixto' },
  ],
  service_provider: [
    { id: 'occupation', label: 'A que te dedicas?', placeholder: 'Ejemplo: técnico, terapeuta, tutor o profesiónal independiente' },
    { id: 'availability', label: 'Que horarios tienes libres?', placeholder: 'Ejemplo: lunes a sabado de 9 a 18' },
    { id: 'services', label: 'Que servicio ofreces?', placeholder: 'Ejemplo: apoyo académico, orientación, acompañamiento o asistencia tecnica' },
    { id: 'coverage', label: 'Como trabajas?', placeholder: 'Ejemplo: presencial, virtual, a domicilio o mixto' },
  ],
  companion: [
    { id: 'occupation', label: 'A que te dedicas?', placeholder: 'Ejemplo: psicopedagogo, estudiante de trabajo social' },
    { id: 'availability', label: 'Que horarios tienes libres?', placeholder: 'Ejemplo: fines de semana y tardes' },
    { id: 'supportStyle', label: 'Que acompañamiento solidario brindas?', placeholder: 'Ejemplo: escucha, organizacion y contención' },
    { id: 'motivation', label: 'Por que quieres participar?', placeholder: 'Ejemplo: quiero apoyar a personas que se sienten solas' },
  ],
};

export default function Onboarding() {
  const { user, completeOnboarding, roleMeta, logout } = useAuth();
  const navigate = useNavigate();
  const questions = useMemo(() => QUESTION_BANK[user?.role] || QUESTION_BANK.seeker, [user?.role]);
  const [answers, setAnswers] = useState(() =>
    questions.reduce((acc, question) => ({ ...acc, [question.id]: '' }), {}),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (id, value) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const hasEmpty = questions.some((question) => !answers[question.id]?.trim());
    if (hasEmpty) {
      setError('Responde todas las preguntas para activar tu perfil');
      return;
    }

    setLoading(true);

    try {
      await completeOnboarding(answers);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-bg">
        <div className="auth-decorations">
          <div className="auth-deco" style={{ top: '16%', right: '12%', width: '84px', height: '84px' }}></div>
        </div>
      </div>

      <div className="auth-card auth-card-wide">
        <div className="auth-header">
          <div className="auth-logo">
            <i className="fa-solid fa-list-check"></i>
          </div>
          <h1 className="auth-title">Activa tu perfil</h1>
          <p className="auth-subtitle">
            Estás respuestas ayudaran a mostrar primero perfiles con mejor disponibilidad, puntuacion y estado activo.
          </p>
        </div>

        <div className="info-note">
          <i className="fa-solid fa-circle-info"></i>
          Este paso es obligatorio para activar la cuenta, pero después podras editarlo desde tu perfil.
        </div>

        <div className="role-inline-summary">
          <span className="badge badge-accent">
            <i className="fa-solid fa-user-tag"></i> {roleMeta[user?.role]?.label || 'Cuenta'}
          </span>
          <p>Completa esta configuración una sola vez. Luego podras editarla desde tu perfil.</p>
        </div>

        {error && (
          <div className="alert alert-error">
            <i className="fa-solid fa-circle-exclamation"></i>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="page-stack">
          {questions.map((question) => (
            <div key={question.id} className="form-group">
              <label className="form-label">{question.label}</label>
              <textarea
                className={`form-input textarea-field ${answers[question.id]?.trim() ? 'success' : ''}`}
                placeholder={question.placeholder}
                value={answers[question.id]}
                onChange={(e) => handleChange(question.id, e.target.value)}
                rows={3}
                required
              />
            </div>
          ))}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? (
              <>
                <div className="spinner"></div>
                Activando perfil...
              </>
            ) : (
              <>
                <i className="fa-solid fa-sparkles"></i>
                Entrar a la app
              </>
            )}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
            }}
          >
            <i className="fa-solid fa-right-from-bracket"></i>
            Salir por ahora
          </button>
        </form>
      </div>
    </div>
  );
}
