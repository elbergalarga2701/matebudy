import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiUrl, socketUrl } from './api';
import { getStoredItem, removeStoredItem, setStoredItem, syncStoredItems } from './storage';

// Detectar si estamos en Capacitor/Android nativo
function isNativePlatform() {
  if (typeof window === 'undefined') return false;

  if (window.location.protocol === 'capacitor:' || window.location.protocol === 'ionic:') {
    return true;
  }

  if (/Android/i.test(window.navigator.userAgent || '')) {
    return true;
  }

  if (typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform()) {
    return true;
  }

  if (typeof window.android !== 'undefined' || typeof window.webkit !== 'undefined') {
    return true;
  }

  return false;
}

const isCapacitor = isNativePlatform();

const AuthContext = createContext(null);
let refreshPromise = null;

const STORAGE_KEYS = {
  currentUser: 'mate_user',
  token: 'mate_token',
  requests: 'mate_requests',
  adminUnlocked: 'mate_admin_unlocked',
  adminCode: 'mate_admin_code',
  billingConfig: 'mate_billing_config',
};

const DEFAULT_BILLING_CONFIG = {
  instantRate: 0.0599,
  installmentsRate: 0.030378,
  minAppRate: 0.05,
  maxAppRate: 0.15,
};

const ROLE_META = {
  seeker: {
    label: 'Necesito servicio',
    shortLabel: 'Estudiante',
  },
  service_provider: {
    label: 'Ofrece servicio',
    shortLabel: 'Servicio',
  },
  monitor: {
    label: 'Monitor',
    shortLabel: 'Monitor',
  },
  provider: {
    label: 'Monitor',
    shortLabel: 'Monitor',
  },
  companion: {
    label: 'Especialista / acompañante solidario',
    shortLabel: 'Solidario',
  },
};

function normalizeRole(role) {
  return role === 'provider' ? 'monitor' : role;
}

function readBillingConfig() {
  const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.billingConfig) || 'null');
  return {
    ...DEFAULT_BILLING_CONFIG,
    ...(raw || {}),
  };
}

function writeBillingConfig(config) {
  localStorage.setItem(STORAGE_KEYS.billingConfig, JSON.stringify(config));
}

function buildSessionUser(user) {
  if (!user) return null;

  return {
    uid: String(user.id),
    email: user.email,
    displayName: user.name,
    role: normalizeRole(user.role),
    roleLabel: ROLE_META[normalizeRole(user.role)]?.label || 'Usuario',
    isVerified: Boolean(user.isVerified),
    verificationStatus: user.verificationStatus || 'pending',
    onboardingCompleted: Boolean(user.onboardingCompleted),
    profileStatus: user.profileStatus || 'pendiente',
    manualStatus: user.manualStatus || 'en_línea',
    isOnline: Boolean(user.isOnline),
    lastSeen: user.lastSeen || null,
    profileAnswers: user.profileAnswers || {},
    verificationData: user.verificationData || null,
    verificationReview: user.verificationReview || null,
    profession: user.profession || '',
    about: user.about || '',
    tags: user.tags || [],
    avatar: user.avatar || '',
    rate: user.rate || 0,
  };
}

async function parseJsonResponse(response, fallbackMessage) {
  const raw = await response.text();
  let data = {};

  console.log('[parseJsonResponse] raw response:', raw.substring(0, 500));

  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch (error) {
      throw new Error(fallbackMessage);
    }
  }

  console.log('[parseJsonResponse] parsed:', data, 'ok:', response.ok);

  if (!response.ok) {
    throw new Error(data.error || fallbackMessage);
  }

  return data;
}

function explainApiFailure(error, fallbackMessage) {
  const message = String(error?.message || '').trim();

  if (!message) {
    return fallbackMessage;
  }

  if (
    /failed to fetch|load failed|networkerror|network request failed/i.test(message)
    || /unexpected token|json/i.test(message)
  ) {
    return `${fallbackMessage}. Verifica que el backend este encendido y que /api responda correctamente.`;
  }

  return message;
}

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem(STORAGE_KEYS.token);
  const isFormData = options.body instanceof FormData;
  const fullUrl = apiUrl(path);

  console.log('[apiFetch] Request:', { url: fullUrl, method: options.method, isFormData });

  // Para Capacitor, usar XMLHttpRequest para evitar problemas de CORS en Android WebView
  if (isCapacitor && !isFormData) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(options.method || 'GET', fullUrl, true);
      xhr.withCredentials = true;

      // Set headers
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      if (options.headers) {
        Object.keys(options.headers).forEach(key => {
          xhr.setRequestHeader(key, options.headers[key]);
        });
      }

      xhr.onload = function () {
        const response = {
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          json: () => Promise.resolve(JSON.parse(xhr.responseText)),
          text: () => Promise.resolve(xhr.responseText),
        };
        console.log('[apiFetch] Response:', { status: xhr.status, ok: response.ok, url: fullUrl });
        resolve(response);
      };

      xhr.onerror = function () {
        console.error('[apiFetch] XHR error:', { url: fullUrl, status: xhr.status });
        reject(new Error('No se pudo conectar con el servidor'));
      };

      xhr.send(options.body || null);
    });
  }

  // Para web, usar fetch normal
  let headers;
  if (isFormData) {
    headers = new Headers();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  } else {
    headers = new Headers(options.headers || {});
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const executeFetch = () => fetch(fullUrl, {
    ...options,
    headers,
    credentials: options.credentials || 'include',
  });

  try {
    let response = await executeFetch();
    console.log('[apiFetch] Response:', { status: response.status, ok: response.ok, url: fullUrl });

    if (response.status !== 401 || path === '/api/auth/refresh' || options.skipRefresh) {
      return response;
    }

    if (!refreshPromise) {
      refreshPromise = fetch(apiUrl('/api/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
      })
        .then((refreshResponse) => refreshResponse.json().then((data) => ({ refreshResponse, data })))
        .then(({ refreshResponse, data }) => {
          if (!refreshResponse.ok) {
            throw new Error(data.error || 'No se pudo refrescar la sesión');
          }
          if (data.token) {
            localStorage.setItem(STORAGE_KEYS.token, data.token);
            void setStoredItem(STORAGE_KEYS.token, data.token);
          }
          if (data.user) {
            const snapshot = JSON.stringify(buildSessionUser(data.user));
            localStorage.setItem(STORAGE_KEYS.currentUser, snapshot);
            void setStoredItem(STORAGE_KEYS.currentUser, snapshot);
          }
          return data;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }

    await refreshPromise;

    const retriedHeaders = isFormData ? headers : new Headers(options.headers || {});
    if (!isFormData) {
      const nextToken = localStorage.getItem(STORAGE_KEYS.token);
      if (nextToken && !retriedHeaders.has('Authorization')) {
        retriedHeaders.set('Authorization', `Bearer ${nextToken}`);
      }
    }

    response = await fetch(fullUrl, {
      ...options,
      headers: retriedHeaders,
      credentials: options.credentials || 'include',
    });
    console.log('[apiFetch] Retried response:', { status: response.status, ok: response.ok });
    return response;
  } catch (error) {
    console.error('[apiFetch] Fetch error:', error);
    throw error;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [billingConfig, setBillingConfigState] = useState(DEFAULT_BILLING_CONFIG);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      console.log('[MateBudy] Auth bootstrap start');
      await syncStoredItems([
        STORAGE_KEYS.currentUser,
        STORAGE_KEYS.token,
        STORAGE_KEYS.adminUnlocked,
        STORAGE_KEYS.adminCode,
        STORAGE_KEYS.billingConfig,
      ]);

      const stored = await getStoredItem(STORAGE_KEYS.currentUser);
      const storedAdminUnlocked = await getStoredItem(STORAGE_KEYS.adminUnlocked);

      if (!isMounted) return;

      if (stored) setUser(JSON.parse(stored));
      setAdminUnlocked(storedAdminUnlocked === 'true');
      setBillingConfigState(readBillingConfig());
      setLoading(false);
      console.log('[MateBudy] Auth bootstrap end', {
        hasStoredUser: Boolean(stored),
        hasToken: Boolean(localStorage.getItem(STORAGE_KEYS.token)),
      });
    };

    void bootstrap();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user?.uid || !localStorage.getItem(STORAGE_KEYS.token)) return undefined;

    let cancelled = false;
    const sendPresence = async () => {
      try {
        let location = null;
        if (navigator.geolocation) {
          location = await new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (position) => resolve({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy,
              }),
              () => resolve(null),
              { enableHighAccuracy: false, timeout: 5000, maximumAge: 30000 },
            );
          });
        }

        if (cancelled) return;

        await apiFetch('/api/users/presence', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            isOnline: true,
            location,
            batteryLevel: null,
          }),
        });
      } catch (error) {
        // La presencia no debe cortar la app.
      }
    };

    void sendPresence();
    const intervalId = window.setInterval(() => {
      void sendPresence();
    }, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid || !localStorage.getItem(STORAGE_KEYS.token)) return undefined;

    let isMounted = true;

    const syncProfile = async () => {
      try {
        const response = await apiFetch('/api/users/profile');
        const data = await parseJsonResponse(response, 'No se pudo sincronizar el usuario actual');
        if (!isMounted) return;

        const nextUser = buildSessionUser(data.user);
        const nextSnapshot = JSON.stringify(nextUser);
        if (nextSnapshot !== localStorage.getItem(STORAGE_KEYS.currentUser)) {
          localStorage.setItem(STORAGE_KEYS.currentUser, nextSnapshot);
          void setStoredItem(STORAGE_KEYS.currentUser, nextSnapshot);
          setUser(nextUser);
        }
      } catch (error) {
        if (!isMounted) return;
        if (/401|403|token/i.test(error.message)) {
          localStorage.removeItem(STORAGE_KEYS.currentUser);
          localStorage.removeItem(STORAGE_KEYS.token);
          void removeStoredItem(STORAGE_KEYS.currentUser);
          void removeStoredItem(STORAGE_KEYS.token);
          setUser(null);
        }
      }
    };

    syncProfile();
    const intervalId = window.setInterval(syncProfile, 20000);
    const onStorage = (event) => {
      if (event.key === STORAGE_KEYS.currentUser || event.key === STORAGE_KEYS.token) {
        const snapshot = localStorage.getItem(STORAGE_KEYS.currentUser);
        setUser(snapshot ? JSON.parse(snapshot) : null);
      }
    };

    window.addEventListener('storage', onStorage);
    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener('storage', onStorage);
    };
  }, [user?.uid]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && user?.uid && localStorage.getItem(STORAGE_KEYS.token)) {
        void apiFetch('/api/auth/refresh', {
          method: 'POST',
          skipRefresh: true,
        }).catch(() => { });
      }
    };

    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user?.uid]);

  const syncSession = (payload) => {
    const sessionUser = buildSessionUser(payload.user);
    if (payload.token) {
      localStorage.setItem(STORAGE_KEYS.token, payload.token);
      void setStoredItem(STORAGE_KEYS.token, payload.token);
    }
    const snapshot = JSON.stringify(sessionUser);
    localStorage.setItem(STORAGE_KEYS.currentUser, snapshot);
    void setStoredItem(STORAGE_KEYS.currentUser, snapshot);
    setUser(sessionUser);
    return sessionUser;
  };

  const login = async (email, password) => {
    console.log('[Auth] Login attempt:', email);
    const response = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    console.log('[Auth] Login response status:', response.status);
    const data = await parseJsonResponse(response, 'Credenciales inválidas');
    console.log('[Auth] Login data:', { hasToken: !!data.token, hasUser: !!data.user });
    return syncSession(data);
  };

  const registerAccount = async ({ name, email, password, role, avatar = '' }) => {
    const response = await apiFetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, email, password, role, avatar }),
    });

    const data = await parseJsonResponse(response, 'No se pudo crear la cuenta');
    return syncSession(data);
  };

  const registerAccountWithIdentity = async ({
    name,
    email,
    password,
    role,
    avatar = '',
    documentType,
    documentNumber,
    selfieFile,
    documentFile,
  }) => {
    console.log('[Register] Starting registration with identity...', { name, email, role, hasSelfie: !!selfieFile, hasDocument: !!documentFile });

    const formData = new FormData();
    formData.append('name', name);
    formData.append('email', email);
    formData.append('password', password);
    formData.append('role', role);
    if (avatar && avatar.length <= 500000) {
      formData.append('avatar', avatar);
    }
    formData.append('documentType', documentType);
    formData.append('documentNumber', documentNumber);
    formData.append('selfie', selfieFile);
    formData.append('document', documentFile);

    console.log('[Register] FormData created, selfie:', selfieFile?.name, 'document:', documentFile?.name);

    try {
      console.log('[Register] Sending request to /api/auth/register-with-identity...');
      const response = await apiFetch('/api/auth/register-with-identity', {
        method: 'POST',
        body: formData,
      });
      console.log('[Register] Response received:', response.status, response.statusText);

      const data = await parseJsonResponse(response, 'No se pudo crear la cuenta con la identidad');
      console.log('[Register] Registration successful!');
      return syncSession(data);
    } catch (error) {
      console.error('[Register] Registration failed:', error);
      throw new Error(explainApiFailure(error, 'No se pudo crear la cuenta con la identidad'));
    }
  };

  const resetPassword = async ({ email, password }) => {
    try {
      const response = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      return await parseJsonResponse(response, 'No se pudo actualizar la contraseña');
    } catch (error) {
      throw new Error(explainApiFailure(error, 'No se pudo actualizar la contraseña'));
    }
  };

  const verifyIdentity = async ({ documentType, documentNumber, selfieFile, documentFile }) => {
    const formData = new FormData();
    formData.append('documentType', documentType);
    formData.append('documentNumber', documentNumber);
    formData.append('selfie', selfieFile);
    formData.append('document', documentFile);

    const response = await apiFetch('/api/users/verify-kyc', {
      method: 'POST',
      body: formData,
    });

    const data = await parseJsonResponse(response, 'No se pudo enviar la documentación');
    return syncSession({ user: data.user });
  };

  const approveVerification = () => {
    throw new Error('La aprobacion de identidad debe hacerse desde revisión administrativa');
  };

  const listVerificationQueue = async () => {
    try {
      const code = localStorage.getItem(STORAGE_KEYS.adminCode) || '';
      const response = await apiFetch('/api/admin/verification-queue', {
        headers: {
          'x-admin-code': code,
        },
      });
      const data = await parseJsonResponse(response, 'No se pudo cargar la cola de revisión');
      return data.queue || [];
    } catch (error) {
      throw new Error(explainApiFailure(error, 'No se pudo cargar la cola de revisión'));
    }
  };

  const setVerificationDecision = async ({ userId, decision, notes = '' }) => {
    try {
      const code = localStorage.getItem(STORAGE_KEYS.adminCode) || '';
      const response = await apiFetch('/api/admin/verification-decision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-code': code,
        },
        body: JSON.stringify({ userId, decision, notes }),
      });
      const data = await parseJsonResponse(response, 'No se pudo guardar la decision');

      if (user?.uid === String(userId)) {
        return syncSession({ user: data.user });
      }

      return data.user;
    } catch (error) {
      throw new Error(explainApiFailure(error, 'No se pudo guardar la decision'));
    }
  };

  const resetVerificationSubmission = async () => {
    const response = await apiFetch('/api/users/verify-kyc/reset', {
      method: 'POST',
    });
    const data = await parseJsonResponse(response, 'No se pudo reiniciar la verificación');
    return syncSession({ user: data.user });
  };

  const unlockAdmin = async (code) => {
    const nextCode = code.trim();
    if (!nextCode) {
      throw new Error('Ingresa el código administrativo');
    }

    const response = await apiFetch('/api/admin/access-check', {
      headers: {
        'x-admin-code': nextCode,
      },
    });
    await parseJsonResponse(response, 'Código administrativo inválido');

    localStorage.setItem(STORAGE_KEYS.adminUnlocked, 'true');
    localStorage.setItem(STORAGE_KEYS.adminCode, nextCode);
    void setStoredItem(STORAGE_KEYS.adminUnlocked, 'true');
    void setStoredItem(STORAGE_KEYS.adminCode, nextCode);
    setAdminUnlocked(true);
  };

  const lockAdmin = () => {
    localStorage.removeItem(STORAGE_KEYS.adminUnlocked);
    localStorage.removeItem(STORAGE_KEYS.adminCode);
    void removeStoredItem(STORAGE_KEYS.adminUnlocked);
    void removeStoredItem(STORAGE_KEYS.adminCode);
    setAdminUnlocked(false);
  };

  const completeOnboarding = async (answers) => {
    const response = await apiFetch('/api/users/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        profileAnswers: answers,
        onboardingCompleted: true,
        profileStatus: 'activo',
      }),
    });

    const data = await parseJsonResponse(response, 'No se pudo completar el onboarding');
    return syncSession({ user: data.user });
  };

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      // Si el backend no responde, igual limpiamos la sesión local.
    }

    localStorage.removeItem(STORAGE_KEYS.currentUser);
    localStorage.removeItem(STORAGE_KEYS.token);
    void removeStoredItem(STORAGE_KEYS.currentUser);
    void removeStoredItem(STORAGE_KEYS.token);
    setUser(null);
  };

  const updateProfile = async (data) => {
    const response = await apiFetch('/api/users/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: data.displayName ?? user?.displayName,
        profession: data.profession ?? user?.profession ?? '',
        about: data.about ?? user?.about ?? '',
        tags: data.tags ?? user?.tags ?? [],
        avatar: data.avatar ?? user?.avatar ?? '',
        profileStatus: data.profileStatus ?? user?.profileStatus ?? 'activo',
        manualStatus: data.manualStatus ?? user?.manualStatus ?? 'en_línea',
        onboardingCompleted: data.onboardingCompleted ?? user?.onboardingCompleted ?? false,
        profileAnswers: data.profileAnswers ?? user?.profileAnswers ?? {},
      }),
    });

    const result = await parseJsonResponse(response, 'No se pudo actualizar el perfil');
    return syncSession({ user: result.user });
  };

  const saveMateRequest = (provider) => {
    if (!user) return null;

    const requests = JSON.parse(localStorage.getItem(STORAGE_KEYS.requests) || '[]');
    const nextRequest = {
      id: Date.now().toString(),
      clientId: user.uid,
      clientName: user.displayName,
      providerId: provider.id || null,
      providerName: provider.name,
      service: provider.service,
      hourlyRate: provider.hourlyRate || 0,
      hours: provider.hours || 1,
      subtotal: provider.subtotal || 0,
      commissionAmount: provider.commissionAmount || 0,
      total: provider.total || 0,
      status: 'quote_created',
      createdAt: new Date().toISOString(),
    };
    requests.push(nextRequest);
    localStorage.setItem(STORAGE_KEYS.requests, JSON.stringify(requests));
    return nextRequest;
  };

  const updateBillingConfig = (nextConfig) => {
    const merged = {
      ...readBillingConfig(),
      ...nextConfig,
    };

    writeBillingConfig(merged);
    void setStoredItem(STORAGE_KEYS.billingConfig, JSON.stringify(merged));
    setBillingConfigState(merged);
    return merged;
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      registerAccount,
      registerAccountWithIdentity,
      resetPassword,
      verifyIdentity,
      approveVerification,
      listVerificationQueue,
      setVerificationDecision,
      resetVerificationSubmission,
      adminUnlocked,
      unlockAdmin,
      lockAdmin,
      completeOnboarding,
      logout,
      updateProfile,
      saveMateRequest,
      billingConfig,
      updateBillingConfig,
      roleMeta: ROLE_META,
    }),
    [user, loading, adminUnlocked, billingConfig],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
