import { useEffect, useRef } from 'react';
import { apiUrl } from '../api';
import { useAuth } from '../AuthContext';
import { showMatebudyNotification } from '../notifications';

export default function GlobalAlerts() {
  const { user } = useAuth();
  const monitorRequestIdsRef = useRef(new Set());

  useEffect(() => {
    if (!user?.uid) {
      monitorRequestIdsRef.current = new Set();
      return undefined;
    }

    if (!localStorage.getItem('mate_token')) {
      monitorRequestIdsRef.current = new Set();
      return undefined;
    }

    let cancelled = false;
    let initialized = false;

    const syncMonitorRequests = async () => {
      try {
        const token = localStorage.getItem('mate_token');
        if (!token) return;

        const response = await fetch(apiUrl('/api/users/monitor-link-requests'), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include',
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || cancelled) return;

        const incoming = Array.isArray(data.incoming) ? data.incoming : [];
        const previousIds = monitorRequestIdsRef.current;
        const nextIds = new Set(incoming.map((entry) => String(entry.id)));

        if (initialized) {
          incoming.forEach((entry) => {
            const requestId = String(entry.id);
            if (!previousIds.has(requestId)) {
              void showMatebudyNotification({
                title: 'Nueva solicitud de monitoreo',
                body: `${entry.user?.name || 'Una cuenta'} quiere acceder a tu monitoreo.`,
                tag: `monitor-request-${requestId}`,
                url: '/perfil',
              });
            }
          });
        }

        initialized = true;
        monitorRequestIdsRef.current = nextIds;
      } catch (error) {
        // No interrumpimos la app por un fallo de red en segundo plano.
      }
    };

    void syncMonitorRequests();
    const intervalId = window.setInterval(() => {
      void syncMonitorRequests();
    }, 20000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [user?.uid]);

  return null;
}
