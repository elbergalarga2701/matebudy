import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const NAV_ITEMS = [
  { path: '/', label: 'Inicio', icon: 'fa-solid fa-house' },
  { path: '/mapa', label: 'Mapa', icon: 'fa-solid fa-map-location-dot' },
  { path: '/chat', label: 'Chat', icon: 'fa-solid fa-comments' },
  { path: '/monitor', label: 'Monitor', icon: 'fa-solid fa-shield-halved' },
  { path: '/perfil', label: 'Perfil', icon: 'fa-solid fa-user' },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const navItems = NAV_ITEMS.filter((item) => {
    if (item.path === '/monitor') return user?.role === 'monitor';
    if (item.path === '/chat') return ['seeker', 'monitor', 'service_provider', 'companion'].includes(user?.role);
    return true;
  });

  return (
    <nav className="bottom-nav-shell">
      <div className="bottom-nav-panel">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;

          return (
            <button key={item.path} onClick={() => navigate(item.path)} className={`bottom-nav-item ${isActive ? 'active' : ''}`}>
              <i className={item.icon} style={{ fontSize: '18px', transition: 'all 0.2s ease' }}></i>
              <span style={{ fontSize: '10px', letterSpacing: '0.2px' }}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
