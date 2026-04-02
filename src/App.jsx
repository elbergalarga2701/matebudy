import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import VerifyIdentity from './components/VerifyIdentity';
import Onboarding from './components/Onboarding';
import AdminReview from './components/AdminReview';
import Feed from './components/Feed';
import MapHub from './components/MapHub';
import Chat from './components/Chat';
import MonitorHub from './components/MonitorHub';
import Profile from './components/Profile';
import BottomNav from './components/BottomNav';
import AutoUpdater from './components/AutoUpdater';

function App() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isMonitor = user?.role === 'monitor';
  console.log('[MateBudy] App render', {
    loading,
    hasUser: Boolean(user),
    route: window.location.href,
  });

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-gradient)',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        <div
          style={{
            width: '80px',
            height: '80px',
            background: 'var(--gradient-primary)',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)',
          }}
        >
          <span style={{
            fontSize: '36px',
            fontWeight: 800,
            color: 'white',
            fontFamily: 'var(--font)',
          }}>M</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 800,
            background: 'var(--gradient-primary)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: '8px',
          }}>MateBudy</h1>
          <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font)', fontSize: '14px' }}>Cargando...</p>
        </div>
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '4px solid var(--border-light)',
            borderTopColor: 'var(--primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        ></div>
      </div>
    );
  }

  const mustVerify = Boolean(user) && !user.isVerified;
  const mustOnboard = Boolean(user) && user.isVerified && !isMonitor && !user.onboardingCompleted;
  const authenticatedHomePath = mustVerify ? '/verificación' : mustOnboard ? '/bienvenida' : isMonitor ? '/monitor' : '/';
  const fallbackPath = user ? authenticatedHomePath : '/login';
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AutoUpdater />
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to={authenticatedHomePath} replace />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/verificación"
          element={
            user
              ? user.isVerified
                ? <Navigate to={user.onboardingCompleted ? (isMonitor ? '/monitor' : '/') : '/bienvenida'} replace />
                : <VerifyIdentity />
              : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/bienvenida"
          element={
            user
              ? !user.isVerified
                ? <Navigate to="/verificación" replace />
                : isMonitor
                  ? <Navigate to="/monitor" replace />
                  : user.onboardingCompleted
                    ? <Navigate to="/" replace />
                    : <Onboarding />
              : <Navigate to="/login" replace />
          }
        />
        <Route path="/admin" element={<AdminReview />} />
        <Route path="/" element={user && !mustVerify && !mustOnboard ? <Feed /> : <Navigate to={fallbackPath} replace />} />
        <Route path="/mapa" element={user && !mustVerify && !mustOnboard ? <MapHub /> : <Navigate to={fallbackPath} replace />} />
        <Route path="/chat" element={user && !mustVerify && !mustOnboard ? <Chat /> : <Navigate to={fallbackPath} replace />} />
        <Route path="/monitor" element={user && !mustVerify && !mustOnboard && isMonitor ? <MonitorHub /> : <Navigate to={fallbackPath} replace />} />
        <Route path="/perfil" element={user && !mustVerify && !mustOnboard ? <Profile /> : <Navigate to={fallbackPath} replace />} />
        <Route path="*" element={<Navigate to={fallbackPath} replace />} />
      </Routes>
      {user && !mustVerify && !mustOnboard && location.pathname !== '/admin' && <BottomNav />}
    </div>
  );
}

export default App;
