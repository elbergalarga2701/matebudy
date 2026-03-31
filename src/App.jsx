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
          background: 'var(--bg-main)',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            border: '4px solid var(--border)',
            borderTopColor: 'var(--primary)',
            borderRadius: '50%',
            animation: 'spin 1s línear infinite',
          }}
        ></div>
        <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font)' }}>Cargando...</p>
      </div>
    );
  }

  const mustVerify = Boolean(user) && !user.isVerified;
  const mustOnboard = Boolean(user) && user.isVerified && !isMonitor && !user.onboardingCompleted;
  const authenticatedHomePath = mustVerify ? '/verificación' : mustOnboard ? '/bienvenida' : isMonitor ? '/monitor' : '/';
  const fallbackPath = user ? authenticatedHomePath : '/login';
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
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
