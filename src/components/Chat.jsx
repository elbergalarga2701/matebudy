import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { apiUrl } from '../api';
import { showMatebudyNotification } from '../notifications';

const SUPPORT_THREADS_KEY = 'mate_support_threads';

const SUPPORT_CONTACTS = [
  {
    id: 'support-hub',
    name: 'Canal de apoyo MateBudy',
    role: 'Canal interno',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Apoyo',
    preview: 'Canal interno para pedir contención y acompañamiento sin perfiles inventados.',
    messages: [
      { id: 1, text: 'Este es el canal interno de apoyo de la app. Puedes contar como te sientes y pedir acompañamiento.', sender: 'system', time: 'Ahora' },
    ],
  },
];

function calculateCommissionRate(hours, subtotal, billingConfig) {
  const volumeDiscount = Math.min(Math.max(hours - 1, 0) * 0.015 + (subtotal >= 600 ? 0.03 : 0), 0.1);
  return Math.max((billingConfig?.maxAppRate || 0.15) - volumeDiscount, billingConfig?.minAppRate || 0.05);
}

function calculateServicePricing(hourlyRate, hours, installments, billingConfig) {
  const providerSubtotal = hourlyRate * hours;
  const platformBaseRate = calculateCommissionRate(hours, providerSubtotal, billingConfig);
  const installmentsRate = installments > 1 ? (billingConfig?.installmentsRate || 0) : 0;
  const absorbedRate = platformBaseRate + (billingConfig?.instantRate || 0) + installmentsRate;
  const grossTotal = Math.round(providerSubtotal / (1 - absorbedRate));
  const appFee = grossTotal - providerSubtotal;
  const installmentValue = Math.round((grossTotal / installments) * 100) / 100;

  return {
    providerSubtotal,
    absorbedRate,
    appFee,
    grossTotal,
    installmentValue,
  };
}

function readSupportThreads() {
  try {
    return JSON.parse(localStorage.getItem(SUPPORT_THREADS_KEY) || '{}');
  } catch (error) {
    return {};
  }
}

function writeSupportThreads(threads) {
  localStorage.setItem(SUPPORT_THREADS_KEY, JSON.stringify(threads));
}

function getSupportThreadMessages(threadId, fallbackMessages = []) {
  const threads = readSupportThreads();
  return threads[threadId] || fallbackMessages;
}

function setSupportThreadMessages(threadId, messages) {
  const threads = readSupportThreads();
  threads[threadId] = messages;
  writeSupportThreads(threads);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

function containsContactAttempt(text) {
  const normalized = text.toLowerCase();
  const phoneLike = /\d{7,}/.test(text);
  const emailLike = /[^\s]+@[^\s]+\.[^\s]+/.test(text);
  const blockedWords = [
    'whatsapp',
    'telegram',
    'instagram',
    'facebook',
    'gmail',
    'hotmail',
    'llamame',
    'teléfono',
    'número',
    'celular',
    'dirección',
    'calle',
    'escribime',
    'contactame',
  ];

  return phoneLike || emailLike || blockedWords.some((word) => normalized.includes(word));
}

function maskPaymentError(message) {
  if (!message) return 'No se pudo procesar el pago';
  const normalized = String(message).toLowerCase();

  if (normalized.includes('unauthorized use of live credentials')) {
    return 'Mercado Pago rechazo la combinacion actual de credenciales y contexto de cobro. Revisa si el panel esta en prueba o producción y usa el tipo de comprador/tarjeta correcto para ese modo.';
  }

  if (normalized.includes('no_payment_method_for_provided_bin')) {
    return 'La tarjeta usada no corresponde a un medio de pago válido para esta prueba. Usa una tarjeta de prueba oficial de Mercado Pago.';
  }

  if (normalized.includes('cc_rejected')) {
    return 'Mercado Pago rechazo la tarjeta de prueba o sus datos. Revisa número, vencimiento, CVV y el escenario de prueba.';
  }

  return message;
}

function normalizeServiceMessage(message) {
  return {
    id: message.id,
    kind: message.kind || 'text',
    text: message.text || '',
    sender: message.sender || 'other',
    time: message.time || 'Ahora',
    attachmentType: message.attachmentType || null,
    fileName: message.fileName || null,
    fileMime: message.fileMime || null,
    fileData: message.fileData || null,
    latitude: message.latitude || null,
    longitude: message.longitude || null,
    mapUrl: message.mapUrl || null,
  };
}

export default function Chat() {
  const { state } = useLocation();
  const { user, billingConfig } = useAuth();
  const canAccessSupportChat = ['seeker', 'monitor', 'companion'].includes(user?.role);
  const canAccessServiceArea = ['seeker', 'monitor', 'service_provider'].includes(user?.role);
  const mpInstanceRef = useRef(null);
  const brickControllerRef = useRef(null);
  const supportFileInputRef = useRef(null);
  const serviceFileInputRef = useRef(null);

  const [activeMode, setActiveMode] = useState(canAccessSupportChat ? 'support' : 'service');
  const [activeSupportChat, setActiveSupportChat] = useState(null);
  const [activeServiceChat, setActiveServiceChat] = useState(null);
  const [supportMessages, setSupportMessages] = useState([]);
  const [serviceMessages, setServiceMessages] = useState([]);
  const [supportInput, setSupportInput] = useState('');
  const [serviceInput, setServiceInput] = useState('');
  const [hours, setHours] = useState(2);
  const [installments, setInstallments] = useState(1);
  const [paymentStage, setPaymentStage] = useState('quote');
  const [draftRequestId, setDraftRequestId] = useState(null);
  const [externalReference, setExternalReference] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [paymentEnvironment, setPaymentEnvironment] = useState('test');
  const [payerEmail, setPayerEmail] = useState(user?.email || '');
  const [paidChats, setPaidChats] = useState([]);
  const [toast, setToast] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [brickReady, setBrickReady] = useState(false);
  const [paymentDebug, setPaymentDebug] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [paymentInfo, setPaymentInfo] = useState('');
  const [paymentSteps, setPaymentSteps] = useState([]);
  const [pendingAttachmentMode, setPendingAttachmentMode] = useState(null);
  const [pendingAttachmentType, setPendingAttachmentType] = useState('document');
  const [serviceLoading, setServiceLoading] = useState(false);
  const [knownContacts, setKnownContacts] = useState([]);
  const [contactQuery, setContactQuery] = useState('');
  const [contactsLoading, setContactsLoading] = useState(false);
  const [knownContactsSnapshot, setKnownContactsSnapshot] = useState({});

  const authHeaders = useMemo(() => {
    const token = localStorage.getItem('mate_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [user?.uid]);

  useEffect(() => {
    if (!canAccessSupportChat) setActiveMode('service');
  }, [canAccessSupportChat]);

  useEffect(() => {
    setPayerEmail(user?.email || '');
  }, [user?.email]);

  useEffect(() => {
    if (activeSupportChat?.id) {
      setSupportThreadMessages(activeSupportChat.id, supportMessages);
    }
  }, [activeSupportChat?.id, supportMessages]);

  useEffect(() => {
    if (state?.provider) {
      setActiveMode('service');
      setActiveServiceChat({
        id: `provider-${state.provider.id}`,
        providerId: state.provider.id,
        name: state.provider.name,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(state.provider.name)}`,
        hourlyRate: state.provider.hourlyRate,
        service: state.provider.service,
      });
      setServiceMessages([
        normalizeServiceMessage({
          id: 3,
          text: state.query ? `Solicitud del cliente: ${state.query}` : 'El cliente llego desde el buscador de servicios.',
          sender: 'system',
          time: 'Ahora',
        }),
      ]);
      setHours(2);
      setInstallments(1);
      setPaymentStage('quote');
      setDraftRequestId(null);
      setExternalReference('');
    }
  }, [state]);

  useEffect(() => {
    return () => {
      if (brickControllerRef.current?.unmount) {
        brickControllerRef.current.unmount();
      }
    };
  }, []);

  const contractSummary = useMemo(() => {
    if (!activeServiceChat?.hourlyRate) return null;
    return calculateServicePricing(activeServiceChat.hourlyRate, hours, installments, billingConfig);
  }, [activeServiceChat, hours, installments, billingConfig]);

  const lockServiceMessaging = !['retained', 'accepted', 'in_progress', 'completed'].includes(paymentStage);

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  const pushPaymentStep = (message) => {
    setPaymentSteps((prev) => [...prev, message]);
  };

  const fetchServiceChats = async ({ preserveCurrent = false } = {}) => {
    if (!user?.uid || !canAccessServiceArea) return;

    const response = await fetch(apiUrl('/api/payments/service-chats'), {
      headers: {
        ...authHeaders,
      },
      credentials: 'include',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'No se pudieron cargar los chats de servicio');

    const nextChats = data.chats || [];
    setPaidChats(nextChats);

    if (preserveCurrent && activeServiceChat?.requestId) {
      const refreshedChat = nextChats.find((chat) => Number(chat.requestId) === Number(activeServiceChat.requestId));
      if (refreshedChat) {
        setActiveServiceChat(refreshedChat);
        setPaymentStage(refreshedChat.status === 'completed' ? 'completed' : refreshedChat.status === 'retained' ? 'retained' : refreshedChat.status);
      }
    }
  };

  const fetchServiceMessages = async (transactionId) => {
    if (!transactionId) return [];

    const response = await fetch(apiUrl(`/api/chat/service/${transactionId}`), {
      headers: {
        ...authHeaders,
      },
      credentials: 'include',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'No se pudo cargar el historial del chat');
    return (data.messages || []).map(normalizeServiceMessage);
  };

  const fetchKnownContacts = async (query = '') => {
    if (!user?.uid || !canAccessServiceArea) return;

    setContactsLoading(true);
    try {
      const response = await fetch(apiUrl(`/api/users/known-contacts${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`), {
        headers: {
          ...authHeaders,
        },
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudieron cargar los conocidos');

      const nextUsers = data.users || [];
      setKnownContacts(nextUsers);
      setKnownContactsSnapshot((prev) => {
        const nextSnapshot = { ...prev };
        nextUsers.forEach((entry) => {
          const previous = prev[entry.id];
          if (previous && !previous.isOnline && entry.isOnline) {
            void showMatebudyNotification({
              title: `${entry.name} esta activo`,
              body: 'Uno de tus conocidos acaba de aparecer con presencia en la app.',
              tag: `known-contact-${entry.id}`,
              url: '/#/chat',
            });
          }

          nextSnapshot[entry.id] = {
            isOnline: entry.isOnline,
            lastSeen: entry.lastSeen,
          };
        });
        return nextSnapshot;
      });
    } finally {
      setContactsLoading(false);
    }
  };

  useEffect(() => {
    if (!canAccessServiceArea) return;

    void (async () => {
      try {
        await fetchServiceChats();
        await fetchKnownContacts();
      } catch (error) {
        showToast(error.message);
      }
    })();

    const intervalId = window.setInterval(() => {
      void fetchKnownContacts(contactQuery).catch(() => {});
    }, 20000);

    return () => window.clearInterval(intervalId);
  }, [canAccessServiceArea, user?.uid]);

  useEffect(() => {
    if (!canAccessServiceArea) return undefined;

    const timeoutId = window.setTimeout(() => {
      void fetchKnownContacts(contactQuery).catch((error) => {
        showToast(error.message);
      });
    }, 220);

    return () => window.clearTimeout(timeoutId);
  }, [contactQuery, canAccessServiceArea, user?.uid]);

  const loadMercadoPagoSdk = async () => {
    if (window.MercadoPago) return window.MercadoPago;

    await new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-mp-sdk="true"]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', () => reject(new Error('No se pudo cargar el SDK de Mercado Pago')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://sdk.mercadopago.com/js/v2';
      script.async = true;
      script.dataset.mpSdk = 'true';
      script.onload = resolve;
      script.onerror = () => reject(new Error('No se pudo cargar el SDK de Mercado Pago'));
      document.body.appendChild(script);
    });

    return window.MercadoPago;
  };

  const mountPaymentBrick = async (reference, amount) => {
    const config = await fetch(apiUrl('/api/payments/public-config')).then((res) => res.json());
    const mpPublicKey = publicKey || config.publicKey;
    if (!mpPublicKey) throw new Error('Falta la Public Key de Mercado Pago en el panel admin');

    setPaymentEnvironment(config.environment || 'test');
    setPublicKey(mpPublicKey);
    setPaymentDebug(`Public Key detectada: ${mpPublicKey.slice(0, 12)}...`);
    setPaymentInfo('SDK de Mercado Pago cargando...');
    pushPaymentStep('Configuracion pública recibida');
    const MercadoPago = await loadMercadoPagoSdk();
    pushPaymentStep('SDK de Mercado Pago cargado');

    if (brickControllerRef.current?.unmount) {
      await brickControllerRef.current.unmount();
      pushPaymentStep('Brick anterior desmontado');
    }

    mpInstanceRef.current = new MercadoPago(mpPublicKey, { locale: 'es-UY' });
    const bricksBuilder = mpInstanceRef.current.bricks();
    pushPaymentStep('Instancia Mercado Pago creada');

    brickControllerRef.current = await bricksBuilder.create('cardPayment', 'payment-brick-container', {
      initialization: { amount: Number(amount) },
      customization: {
        paymentMethods: { maxInstallments: 12, minInstallments: 1 },
        visual: { style: { theme: 'default' } },
      },
      callbacks: {
        onReady: () => {
          setBrickReady(true);
          setPaymentInfo('Formulario de pago listo');
          pushPaymentStep('Formulario listo');
        },
        onSubmit: async (formData) => {
          pushPaymentStep('Mercado Pago disparo onSubmit');
          setPaymentInfo('Procesando pago...');
          const response = await fetch(apiUrl('/api/payments/process-public'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...formData,
              transaction_amount: amount,
              description: activeServiceChat?.service || 'Servicio MateBudY',
              external_reference: reference,
              payer: {
                ...formData.payer,
                email: formData.payer?.email || payerEmail || '',
              },
            }),
          });

          const data = await response.json().catch(() => ({}));
          pushPaymentStep(`Backend respondio: ${response.status}`);
          if (!response.ok) {
            const backendError = data.error || data.message || 'No se pudo procesar el pago';
            setPaymentError(maskPaymentError(backendError));
            pushPaymentStep(`Detalle backend: ${backendError}`);
            throw new Error(data.error || 'No se pudo procesar el pago');
          }

          if (data.status === 'approved') {
            pushPaymentStep('Pago aprobado por Mercado Pago');
            setPaymentStage('retained');
            if (draftRequestId) {
              const updatedMessages = await fetchServiceMessages(draftRequestId);
              setServiceMessages(updatedMessages);
            }
            await fetchServiceChats({ preserveCurrent: true });
            showToast('Pago aprobado dentro de la app');
            return;
          }

          pushPaymentStep(`Estado de pago: ${data.status || 'sin estado'} / ${data.status_detail || 'sin detalle'}`);
          throw new Error(maskPaymentError(data.status_detail || data.status));
        },
        onError: (error) => {
          const details = error?.message || error?.cause || 'Error al cargar el pago';
          setPaymentDebug(`Error Brick: ${details}`);
          setPaymentError(maskPaymentError(details));
          pushPaymentStep(`Error Brick: ${details}`);
          showToast(maskPaymentError(details));
        },
      },
    });
    pushPaymentStep('Brick montado');
  };

  const sendServiceMessage = async (message) => {
    if (!activeServiceChat?.requestId || lockServiceMessaging) return;

    const response = await fetch(apiUrl(`/api/chat/service/${activeServiceChat.requestId}`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      credentials: 'include',
      body: JSON.stringify(message),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'No se pudo guardar el mensaje');

    setServiceMessages((prev) => [...prev, normalizeServiceMessage(data.message)]);
    await fetchServiceChats({ preserveCurrent: true });
  };

  const handleSupportSend = () => {
    if (!supportInput.trim()) return;
    if (containsContactAttempt(supportInput)) {
      showToast('Bloqueamos datos de contacto para proteger la comisión y la seguridad.');
      return;
    }
    setSupportMessages((prev) => [...prev, { id: Date.now(), kind: 'text', text: supportInput, sender: 'me', time: 'Ahora' }]);
    setSupportInput('');
  };

  const handleServiceSend = async () => {
    if (!serviceInput.trim() || lockServiceMessaging) return;

    try {
      await sendServiceMessage({
        text: serviceInput.trim(),
        kind: 'text',
      });
      setServiceInput('');
    } catch (error) {
      showToast(error.message);
    }
  };

  const openSupportChat = (chat) => {
    setActiveMode('support');
    setActiveSupportChat(chat);
    setSupportMessages(getSupportThreadMessages(chat.id, chat.messages));
    setSupportInput('');
  };

  const openServiceChat = async (chat) => {
    setActiveMode('service');
    setActiveServiceChat(chat);
    setPaymentStage(chat.status === 'completed' ? 'completed' : 'retained');
    setServiceInput('');
    setDraftRequestId(chat.requestId || null);
    setExternalReference(chat.externalReference || '');
    setServiceLoading(true);

    try {
      const messages = await fetchServiceMessages(chat.requestId);
      setServiceMessages(messages);
    } catch (error) {
      showToast(error.message);
      setServiceMessages([]);
    } finally {
      setServiceLoading(false);
    }
  };

  const appendMessage = async (mode, message) => {
    if (mode === 'support') {
      setSupportMessages((prev) => [...prev, message]);
      return;
    }

    try {
      await sendServiceMessage({
        text: message.text,
        kind: message.kind || 'text',
        meta: {
          attachmentType: message.attachmentType || null,
          fileName: message.fileName || null,
          fileMime: message.fileMime || null,
          fileData: message.fileData || null,
          latitude: message.latitude || null,
          longitude: message.longitude || null,
          mapUrl: message.mapUrl || null,
        },
      });
    } catch (error) {
      showToast(error.message);
    }
  };

  const openAttachmentPicker = (mode, type) => {
    setPendingAttachmentMode(mode);
    setPendingAttachmentType(type);
    const ref = mode === 'support' ? supportFileInputRef : serviceFileInputRef;
    ref.current?.click();
  };

  const handleAttachmentSelected = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !pendingAttachmentMode) return;

    const dataUrl = await fileToDataUrl(file);
    await appendMessage(pendingAttachmentMode, {
      id: Date.now(),
      kind: 'attachment',
      attachmentType: pendingAttachmentType,
      fileName: file.name,
      fileMime: file.type,
      fileData: dataUrl,
      sender: 'me',
      time: 'Ahora',
      text: pendingAttachmentType === 'photo'
        ? 'Foto enviada'
        : pendingAttachmentType === 'audio'
          ? 'Audio enviado'
          : 'Documento enviado',
    });

    event.target.value = '';
    setPendingAttachmentMode(null);
    setPendingAttachmentType('document');
  };

  const handleShareLocation = (mode) => {
    if (!navigator.geolocation) {
      showToast('Tu dispositivo no permite compartir ubicación.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        await appendMessage(mode, {
          id: Date.now(),
          kind: 'location',
          latitude,
          longitude,
          mapUrl: `https://www.google.com/maps?q=${latitude},${longitude}`,
          sender: 'me',
          time: 'Ahora',
          text: 'Ubicacion compartida',
        });
      },
      () => {
        showToast('No pudimos obtener tu ubicación.');
      },
    );
  };

  const handleContract = async () => {
    if (!contractSummary || !activeServiceChat) return;
    if (!payerEmail.trim()) {
      setPaymentError('Debes indicar el email del pagador antes de abrir el formulario de cobro.');
      return;
    }
    setPaymentLoading(true);
    setBrickReady(false);
    setPaymentError('');
    setPaymentInfo('Preparando orden de pago...');
    setPaymentSteps([]);
    pushPaymentStep('Inicio de preparacion de pago');

    try {
      setPaymentStage('payment');
      const response = await fetch(apiUrl('/api/payments/create-session'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        credentials: 'include',
        body: JSON.stringify({
          embedded: true,
          provider_id: activeServiceChat.providerId,
          provider_name: activeServiceChat.name,
          payer_email: payerEmail.trim(),
          amount: contractSummary.grossTotal,
          hours,
          installments,
          hourly_rate: activeServiceChat.hourlyRate,
          title: `Servicio con ${activeServiceChat.name}`,
          description: activeServiceChat.service,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo preparar el pago');
      pushPaymentStep('Sesion de backend creada');

      const sessionId = data.session_id || null;
      const reference = data.external_reference || `matebudy-local-${Date.now()}`;
      setDraftRequestId(sessionId);
      setExternalReference(reference);
      setPaymentInfo('Orden creada. Cargando formulario de tarjeta...');
      pushPaymentStep(`Referencia: ${reference}`);
      if (sessionId) {
        setActiveServiceChat((prev) => (
          prev
            ? { ...prev, id: `service-${sessionId}`, requestId: sessionId, externalReference: reference }
            : prev
        ));
      }
      setServiceMessages((prev) => [
        ...prev,
        normalizeServiceMessage({
          id: Date.now() + 1,
          text: `Reserva preparada por ${hours} hora(s). Completa el pago aquí mismo para habilitar el chat privado.`,
          sender: 'system',
          time: 'Ahora',
        }),
      ]);

      await mountPaymentBrick(reference, contractSummary.grossTotal);
      pushPaymentStep('Intento de montaje completado');
      window.setTimeout(() => {
        const paymentContainer = document.getElementById('payment-brick-container');
        if (paymentContainer) {
          paymentContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
          pushPaymentStep('Scroll al formulario ejecutado');
        }
      }, 150);
      showToast(`Reserva preparada con ${activeServiceChat.name}: total $${contractSummary.grossTotal}`);
    } catch (error) {
      setPaymentError(maskPaymentError(error.message));
      setPaymentInfo('');
      pushPaymentStep(`Error general: ${error.message}`);
      showToast(maskPaymentError(error.message));
      setPaymentStage('quote');
    } finally {
      setPaymentLoading(false);
    }
  };

  const renderMessageBubble = (msg) => (
    <div
      key={msg.id}
      style={{
        display: 'flex',
        justifyContent: msg.sender === 'me' ? 'flex-end' : 'flex-start',
        maxWidth: msg.sender === 'system' ? '100%' : '80%',
        alignSelf: msg.sender === 'me' ? 'flex-end' : 'flex-start',
      }}
    >
      {msg.sender === 'system' ? (
        <div className="system-bubble">{msg.text}</div>
      ) : (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: msg.sender === 'me' ? '20px 20px 6px 20px' : '20px 20px 20px 6px',
            background: msg.sender === 'me' ? 'línear-gradient(135deg, var(--primary), var(--primary-dark))' : 'rgba(255,255,255,0.92)',
            color: msg.sender === 'me' ? 'white' : 'var(--text-dark)',
            boxShadow: msg.sender === 'me' ? '0 14px 26px rgba(231,123,87,0.2)' : 'var(--shadow-soft)',
          }}
        >
          {msg.kind === 'attachment' && msg.attachmentType === 'photo' && <img src={msg.fileData} alt={msg.fileName || 'Foto enviada'} style={{ width: '100%', maxWidth: '240px', borderRadius: '14px', marginBottom: '10px', objectFit: 'cover' }} />}
          {msg.kind === 'attachment' && msg.attachmentType === 'audio' && <audio controls src={msg.fileData} style={{ width: '100%', marginBottom: '10px' }} />}
          {msg.kind === 'attachment' && msg.attachmentType === 'document' && <a href={msg.fileData} download={msg.fileName} className="chat-attachment-link"><i className="fa-solid fa-file-arrow-down"></i> {msg.fileName}</a>}
          {msg.kind === 'location' && <a href={msg.mapUrl} target="_blank" rel="noreferrer" className="chat-attachment-link"><i className="fa-solid fa-location-dot"></i> Abrir ubicación compartida</a>}
          <p style={{ fontSize: '14px', lineHeight: 1.5 }}>{msg.text}</p>
          <span style={{ fontSize: '10px', color: msg.sender === 'me' ? 'rgba(255,255,255,0.72)' : 'var(--text-light)', display: 'block', textAlign: 'right', marginTop: '4px' }}>{msg.time}</span>
        </div>
      )}
    </div>
  );

  if (activeMode === 'support' && activeSupportChat) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', padding: '12px 12px 104px', background: 'transparent' }}>
        <input ref={supportFileInputRef} type="file" hidden onChange={handleAttachmentSelected} accept="image/*,.pdf,.doc,.docx,audio/*" />
        {toast && <div className="toast toast-success">{toast}</div>}
        <div className="chat-topbar">
          <button onClick={() => setActiveSupportChat(null)} className="icon-circle-button"><i className="fa-solid fa-arrow-left"></i></button>
          <img src={activeSupportChat.avatar} alt="" className="avatar-ring" style={{ width: '42px', height: '42px' }} />
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-dark)' }}>{activeSupportChat.name}</h4>
            <span style={{ fontSize: '12px', color: 'var(--text-medium)' }}>{activeSupportChat.role}</span>
          </div>
          <span className="badge badge-accent">Apoyo</span>
        </div>
        <div className="app-scroll" style={{ flex: 1, padding: '18px 4px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
          <div className="payment-callout">
            <strong>Chat protegido</strong>
            <p>Este espacio sirve para apoyo, contención y actividades. No se permiten teléfonos, direcciónes ni datos externos para proteger a la comunidad y evitar cerrar servicios por fuera.</p>
          </div>
          {supportMessages.map(renderMessageBubble)}
        </div>
        <div className="chat-composer">
          <div className="chat-attachment-row">
            <button type="button" className="icon-circle-button" onClick={() => openAttachmentPicker('support', 'photo')}><i className="fa-solid fa-image"></i></button>
            <button type="button" className="icon-circle-button" onClick={() => openAttachmentPicker('support', 'document')}><i className="fa-solid fa-file-lines"></i></button>
            <button type="button" className="icon-circle-button" onClick={() => openAttachmentPicker('support', 'audio')}><i className="fa-solid fa-microphone"></i></button>
            <button type="button" className="icon-circle-button" onClick={() => handleShareLocation('support')}><i className="fa-solid fa-location-dot"></i></button>
          </div>
          <input type="text" className="input-neu" placeholder="Comparte como te sientes o que apoyo necesitas..." value={supportInput} onChange={(e) => setSupportInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSupportSend()} style={{ borderRadius: '20px', flex: 1 }} />
          <button onClick={handleSupportSend} disabled={!supportInput.trim()} className="chat-send-button" style={{ background: supportInput.trim() ? 'línear-gradient(135deg, var(--primary), var(--primary-dark))' : 'var(--border)', cursor: supportInput.trim() ? 'pointer' : 'not-allowed' }}>
            <i className="fa-solid fa-paper-plane"></i>
          </button>
        </div>
      </div>
    );
  }

  if (activeMode === 'service' && activeServiceChat) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', padding: '12px 12px 104px', background: 'transparent' }}>
        <input ref={serviceFileInputRef} type="file" hidden onChange={handleAttachmentSelected} accept="image/*,.pdf,.doc,.docx,audio/*" />
        {toast && <div className="toast toast-success">{toast}</div>}
        <div className="chat-topbar">
          <button onClick={() => { setActiveServiceChat(null); setPaymentStage('quote'); setDraftRequestId(null); setExternalReference(''); }} className="icon-circle-button"><i className="fa-solid fa-arrow-left"></i></button>
          <img src={activeServiceChat.avatar} alt="" className="avatar-ring" style={{ width: '42px', height: '42px' }} />
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-dark)' }}>{activeServiceChat.name}</h4>
            <span style={{ fontSize: '12px', color: 'var(--text-medium)' }}>{activeServiceChat.service}</span>
          </div>
          <span className="badge badge-primary">${activeServiceChat.hourlyRate}/h</span>
        </div>
        <div className="app-scroll" style={{ flex: 1, padding: '18px 4px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
          <div className="surface-card" style={{ padding: '18px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '10px', color: 'var(--text-dark)' }}>Reserva del servicio</h3>
            <p style={{ color: 'var(--text-medium)', lineHeight: 1.6, marginBottom: '14px' }}>Antes del chat privado debes indicar cuantas horas quieres contratar y completar el pago dentro de la app.</p>
            <div className="contract-grid">
              <div className="contract-card"><label className="form-label">Horas contratadas</label><input type="number" min="1" max="12" className="form-input" value={hours} onChange={(e) => setHours(Math.max(1, Number(e.target.value) || 1))} disabled={paymentStage !== 'quote'} /></div>
              <div className="contract-card"><label className="form-label">Cuotas estimadas</label><select className="form-input" value={installments} onChange={(e) => setInstallments(Number(e.target.value))} disabled={paymentStage !== 'quote'}><option value={1}>1 pago</option><option value={3}>3 cuotas</option><option value={6}>6 cuotas</option><option value={9}>9 cuotas</option><option value={12}>12 cuotas</option></select></div>
              <div className="contract-card"><strong>Resumen</strong><span>Pago al proveedor: ${contractSummary?.providerSubtotal || 0}</span><span>Comision app integrada: {Math.round((contractSummary?.absorbedRate || 0) * 100)}%</span><span>Comision total absorbida: ${contractSummary?.appFee || 0}</span>{installments > 1 && <span>{installments} cuotas estimadas de ${contractSummary?.installmentValue || 0}</span>}<strong style={{ marginTop: '8px' }}>Total a pagar: ${contractSummary?.grossTotal || 0}</strong></div>
              <div className="contract-card"><label className="form-label">Email del pagador</label><input type="email" className="form-input" value={payerEmail} onChange={(e) => setPayerEmail(e.target.value)} placeholder={paymentEnvironment === 'production' ? 'cliente@correo.com' : 'comprador-test@email.com'} disabled={paymentStage !== 'quote'} /><span style={{ marginTop: '8px', display: 'block', color: 'var(--text-medium)', fontSize: '12px', lineHeight: 1.5 }}>{paymentEnvironment === 'production' ? 'En producción, este debe ser el email real del cliente que paga.' : 'En prueba, usa el email de un comprador de prueba de Mercado Pago para no mezclar sandbox con cuentas reales.'}</span></div>
            </div>
            <div className="info-chip-row" style={{ marginTop: '14px' }}>
              {paymentStage === 'quote' ? <button type="button" className="pill-button pill-button-primary" onClick={handleContract} disabled={paymentLoading}>{paymentLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-credit-card"></i>} {paymentLoading ? 'Preparando formulario...' : 'Abrir formulario de pago'}</button> : paymentStage === 'payment' ? <span className="badge badge-accent"><i className="fa-solid fa-wallet"></i> Completa el pago en el formulario de abajo</span> : <span className="badge badge-accent"><i className="fa-solid fa-circle-check"></i> Chat habilitado</span>}
              <span className="badge badge-secondary"><i className="fa-solid fa-lock"></i> El dinero queda retenido hasta confirmar el servicio</span>
            </div>
            {paymentStage === 'payment' && <div className="payment-brick-shell"><div className="payment-callout"><strong>Pago embebido</strong><p>{paymentEnvironment === 'production' ? 'Completa el cobro real aquí mismo con tarjeta. Verifica antes de cobrar que el email del pagador sea el correcto.' : 'Completa el cobro aquí mismo con tarjeta. En pruebas, usa comprador y tarjeta de prueba de Mercado Pago.'}</p></div>{paymentInfo && <div className="info-note" style={{ marginTop: '14px' }}><i className="fa-solid fa-hourglass-half"></i>{paymentInfo}</div>}{paymentError && <div className="alert alert-error" style={{ marginTop: '14px', marginBottom: 0 }}><i className="fa-solid fa-circle-exclamation"></i><span>{paymentError}</span></div>}{paymentDebug && <div className="info-note" style={{ marginTop: '14px' }}><i className="fa-solid fa-circle-info"></i>{paymentDebug}</div>}<div className="info-chip-row" style={{ marginTop: '14px' }}><span className={`badge ${paymentEnvironment === 'production' ? 'badge-primary' : 'badge-accent'}`}>{paymentEnvironment === 'production' ? 'Modo producción' : 'Modo prueba'}</span><span className="badge badge-secondary">Pagador: {payerEmail || 'sin email'}</span></div>{paymentSteps.length > 0 && <div className="surface-card" style={{ marginTop: '14px', padding: '14px', background: 'rgba(255,255,255,0.78)' }}><strong style={{ display: 'block', marginBottom: '8px', color: 'var(--text-dark)' }}>Diagnostico del pago</strong><div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>{paymentSteps.map((step, index) => <span key={`${step}-${index}`} style={{ color: 'var(--text-medium)', fontSize: '13px' }}>{index + 1}. {step}</span>)}</div></div>}{!brickReady && <div className="empty-state" style={{ marginTop: '14px' }}><div className="empty-state-icon"><i className="fa-solid fa-spinner fa-spin"></i></div><h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>Cargando pago</h3><p style={{ color: 'var(--text-medium)', lineHeight: 1.6 }}>Estamos preparando el formulario de Mercado Pago dentro de la app.</p></div>}<div id="payment-brick-container" style={{ minHeight: '360px' }}></div></div>}
            <div className="contract-stage-card"><strong>Estado de la contratacion</strong><div className="info-chip-row" style={{ marginTop: '10px' }}><span className={`badge ${paymentStage === 'quote' ? 'badge-accent' : 'badge-secondary'}`}>1. Cotizacion</span><span className={`badge ${paymentStage === 'payment' ? 'badge-accent' : 'badge-secondary'}`}>2. Pago en app</span><span className={`badge ${paymentStage === 'retained' ? 'badge-accent' : 'badge-secondary'}`}>3. Chat activo</span></div><p style={{ color: 'var(--text-medium)', marginTop: '12px', lineHeight: 1.6 }}>Si el servicio dura mas de lo previsto, el cliente podra ampliar horas desde este mismo chat antes de liberar el pago final.</p><p style={{ color: 'var(--text-medium)', marginTop: '8px', lineHeight: 1.6 }}>La comisión de la app ya incluye el cobro instantáneo de Mercado Pago y, si eliges cuotas sin interes, tambien absorbe ese costo dentro del total final.</p>{externalReference && <p style={{ color: 'var(--text-light)', marginTop: '8px', fontSize: '12px' }}>Referencia interna: {externalReference}</p>}</div>
          </div>
          {lockServiceMessaging ? <div className="empty-state"><div className="empty-state-icon"><i className="fa-solid fa-lock"></i></div><h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>El chat privado se habilita después del pago</h3><p style={{ color: 'var(--text-medium)', lineHeight: 1.6 }}>Primero completas la reserva y el pago retenido. Recien ahi el cliente puede conversar en privado con el proveedor.</p></div> : serviceLoading ? <div className="empty-state"><div className="empty-state-icon"><i className="fa-solid fa-spinner fa-spin"></i></div><h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>Cargando conversacion</h3><p style={{ color: 'var(--text-medium)', lineHeight: 1.6 }}>Estamos trayendo el historial real de esta contratacion.</p></div> : serviceMessages.map(renderMessageBubble)}
        </div>
        {!lockServiceMessaging && <div className="chat-composer"><div className="chat-attachment-row"><button type="button" className="icon-circle-button" onClick={() => openAttachmentPicker('service', 'photo')}><i className="fa-solid fa-image"></i></button><button type="button" className="icon-circle-button" onClick={() => openAttachmentPicker('service', 'document')}><i className="fa-solid fa-file-lines"></i></button><button type="button" className="icon-circle-button" onClick={() => openAttachmentPicker('service', 'audio')}><i className="fa-solid fa-microphone"></i></button><button type="button" className="icon-circle-button" onClick={() => handleShareLocation('service')}><i className="fa-solid fa-location-dot"></i></button></div><input type="text" className="input-neu" placeholder="Escribe un mensaje sobre el servicio..." value={serviceInput} onChange={(e) => setServiceInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void handleServiceSend()} style={{ borderRadius: '20px', flex: 1 }} /><button onClick={() => void handleServiceSend()} disabled={!serviceInput.trim()} className="chat-send-button" style={{ background: serviceInput.trim() ? 'línear-gradient(135deg, var(--primary), var(--primary-dark))' : 'var(--border)', cursor: serviceInput.trim() ? 'pointer' : 'not-allowed' }}><i className="fa-solid fa-paper-plane"></i></button></div>}
      </div>
    );
  }

  return (
    <div className="app-scroll" style={{ padding: '0 0 110px', minHeight: '100vh' }}>
      {toast && <div className="toast toast-success">{toast}</div>}
      <div className="page-shell page-stack">
        <section className="surface-card" style={{ padding: '20px' }}>
          <div className="section-title">
            <h1 style={{ fontSize: '26px', fontWeight: 800 }}><i className="fa-solid fa-comments" style={{ marginRight: '8px', color: 'var(--primary)' }}></i>Chats</h1>
            <p style={{ fontSize: '14px' }}>La ayuda humana y la contratacion funcionan por separado para que nadie pueda cerrar un servicio por fuera de la app.</p>
          </div>
        </section>

        <section className="chat-tabs-card">
          {canAccessSupportChat && <button type="button" className={`chat-tab-button ${activeMode === 'support' ? 'active' : ''}`} onClick={() => setActiveMode('support')}><i className="fa-solid fa-heart"></i> Apoyo</button>}
          {canAccessServiceArea && <button type="button" className={`chat-tab-button ${activeMode === 'service' ? 'active' : ''}`} onClick={() => setActiveMode('service')}><i className="fa-solid fa-briefcase"></i> Servicios</button>}
        </section>

        {activeMode === 'support' && canAccessSupportChat && (
          <>
            <div className="payment-callout">
              <strong>Reglas del chat de apoyo</strong>
              <p>Este canal es para contención, compañía y orientación. Si detectamos teléfonos, direcciónes, redes o correos, el mensaje se bloquea para cuidar la seguridad y evitar servicios sin comisión.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {SUPPORT_CONTACTS.map((chat) => (
                <button key={chat.id} onClick={() => openSupportChat(chat)} className="surface-card" style={{ width: '100%', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)' }}>
                  <img src={chat.avatar} alt={chat.name} className="avatar-ring" style={{ width: '54px', height: '54px' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-dark)' }}>{chat.name}</span>
                      <span className="badge badge-accent">Seguro</span>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-medium)', marginTop: '4px' }}>{chat.preview}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {activeMode === 'service' && (
          <>
            <div className="payment-callout">
              <strong>Reglas del chat de servicios</strong>
              <p>El proveedor no tiene chat libre con el cliente. La conversacion privada solo aparece después del pago y siempre queda asociada a una orden con comisión.</p>
            </div>
            <div className="surface-card" style={{ padding: '16px' }}>
              <div className="section-title" style={{ marginBottom: '10px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Conocidos</h3>
                <p style={{ fontSize: '14px' }}>Aquí aparecen personas con las que ya hubo chat, contratacion o vinculo de monitor. Puedes buscarlas por nombre.</p>
              </div>
              <input
                type="text"
                className="form-input"
                placeholder="Buscar conocidos por nombre"
                value={contactQuery}
                spellCheck
                autoCorrect="on"
                autoCapitalize="words"
                onChange={(e) => setContactQuery(e.target.value)}
              />
              <div className="list-stack" style={{ marginTop: '12px' }}>
                {contactsLoading ? (
                  <div className="info-note"><i className="fa-solid fa-spinner fa-spin"></i> Actualizando conocidos...</div>
                ) : knownContacts.length ? (
                  knownContacts.slice(0, 8).map((entry) => (
                    <div key={entry.uid || entry.id} className="surface-card" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                      <div>
                        <strong style={{ display: 'block', color: 'var(--text-dark)' }}>{entry.name}</strong>
                        <span style={{ color: 'var(--text-medium)', fontSize: '13px' }}>
                          {entry.manualStatus?.replaceAll('_', ' ') || 'sin estado'} · {entry.isOnline ? 'activo ahora' : 'sin presencia ahora'}
                        </span>
                      </div>
                      <span className={`badge ${entry.isOnline ? 'badge-primary' : 'badge-secondary'}`}>
                        {entry.isOnline ? 'En línea' : 'Sin presencia'}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="info-note"><i className="fa-solid fa-user-group"></i> Todavia no hay conocidos registrados con ese criterio.</div>
                )}
              </div>
            </div>
            {paidChats.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {paidChats.map((chat) => (
                  <button key={chat.id} onClick={() => void openServiceChat(chat)} className="surface-card" style={{ width: '100%', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)' }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <img src={chat.avatar} alt={chat.name} className="avatar-ring" style={{ width: '54px', height: '54px' }} />
                      <span style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '18px', height: '18px', borderRadius: '50%', background: 'var(--success)', color: 'white', fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white' }}>
                        <i className="fa-solid fa-check"></i>
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-dark)' }}>{chat.name}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-light)' }}>{chat.time}</span>
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--text-medium)', marginTop: '4px' }}>{chat.lastMsg}</p>
                    </div>
                    <span className="badge badge-primary">${chat.hourlyRate}/h</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon"><i className="fa-solid fa-lock"></i></div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>Todavia no tienes chats de servicios habilitados</h3>
                <p style={{ color: 'var(--text-medium)', lineHeight: 1.6 }}>Para conversar con un proveedor primero debes buscar un servicio, elegir horas y completar el pago para que el dinero quede retenido.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

