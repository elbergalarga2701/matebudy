import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../AuthContext';
import { apiUrl } from '../api';
import { showMatebudyNotification } from '../notifications';

const SUPPORT_THREADS_KEY = 'mate_support_threads';

const SUPPORT_CONTACTS = [
  {
    id: 'support-hub',
    name: 'Canal de apoyo Matebudy',
    role: 'Soporte oficial',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Apoyo',
  },
];

function readSupportThreads() {
  try { return JSON.parse(localStorage.getItem(SUPPORT_THREADS_KEY) || '{}'); } catch { return {}; }
}

function writeSupportThreads(threads) {
  localStorage.setItem(SUPPORT_THREADS_KEY, JSON.stringify(threads));
}

function getSupportThreadMessages(threadId, fallback = []) {
  const threads = readSupportThreads();
  return threads[threadId] || fallback;
}

function setSupportThreadMessages(threadId, messages) {
  const threads = readSupportThreads();
  threads[threadId] = messages;
  writeSupportThreads(threads);
}

export default function Chat() {
  const { user, billingConfig } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageDraft, setMessageDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState('');
  const messagesEndRef = useRef(null);

  const authHeaders = useMemo(() => {
    const token = localStorage.getItem('mate_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [user?.uid]);

  const showToast = (msg, timeout = 2500) => {
    setToast(msg);
    setTimeout(() => setToast(''), timeout);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Cargar contactos
  useEffect(() => {
    const loadContacts = async () => {
      try {
        const response = await fetch(apiUrl('/api/chat/contacts'), {
          headers: { ...authHeaders },
          credentials: 'include',
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'No se pudo cargar el chat');

        const allContacts = [...SUPPORT_CONTACTS];
        if (data.contacts && Array.isArray(data.contacts)) {
          allContacts.push(...data.contacts);
        }
        setContacts(allContacts);
      } catch (error) {
        setContacts([...SUPPORT_CONTACTS]);
      } finally {
        setLoading(false);
      }
    };

    void loadContacts();
  }, [authHeaders]);

  // Cargar mensajes al seleccionar contacto
  const loadMessages = async (contact) => {
    setSelectedContact(contact);
    setLoading(true);

    try {
      if (contact.id === 'support-hub') {
        const stored = getSupportThreadMessages('support-hub', SUPPORT_CONTACTS[0].messages || []);
        setMessages(stored);
      } else {
        const response = await fetch(apiUrl(`/api/chat/messages/${contact.id}`), {
          headers: { ...authHeaders },
          credentials: 'include',
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'No se pudo cargar mensajes');
        setMessages(data.messages || []);
      }
    } catch (error) {
      showToast(error.message);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    const text = messageDraft.trim();
    if (!text || !selectedContact) return;

    setSending(true);
    try {
      if (selectedContact.id === 'support-hub') {
        const newMessage = {
          id: Date.now(),
          text,
          sender: 'me',
          time: new Date().toISOString(),
          isMine: true,
        };
        const updated = [...messages, newMessage];
        setMessages(updated);
        setSupportThreadMessages('support-hub', updated);
        setMessageDraft('');

        // Simular respuesta
        setTimeout(() => {
          const replyMessage = {
            id: Date.now() + 1,
            text: 'Gracias por escribir. Un miembro del equipo te respondera pronto.',
            sender: 'other',
            time: new Date().toISOString(),
            isMine: false,
          };
          const withReply = [...updated, replyMessage];
          setMessages(withReply);
          setSupportThreadMessages('support-hub', withReply);
          showMatebudyNotification('Canal de apoyo', 'Nuevo mensaje del equipo');
        }, 1500);
      } else {
        const response = await fetch(apiUrl('/api/chat/messages'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          credentials: 'include',
          body: JSON.stringify({
            recipientId: selectedContact.id,
            text,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'No se pudo enviar');

        setMessages((prev) => [...prev, data.message]);
        setMessageDraft('');
        showToast('Mensaje enviado');
      }
    } catch (error) {
      showToast(error.message || 'No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `Hace ${minutes} min`;
    if (hours < 24) return `Hace ${hours} h`;
    if (days < 7) return `Hace ${days} d`;
    return date.toLocaleDateString();
  };

  return (
    <div className="chat-shell" style={{ padding: '0', maxWidth: '100%', width: '100%' }}>
      {toast && <div className="toast">{toast}</div>}

      <div style={{
        display: 'grid',
        gridTemplateColumns: selectedContact ? '280px 1fr' : '1fr',
        height: 'calc(100vh - var(--nav-height) - 40px)',
        gap: '16px',
        padding: '20px',
      }}>
        {/* Contact List */}
        <div className="card" style={{
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 'var(--radius-xl)',
        }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border-light)' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className="fa-solid fa-comments" style={{ color: 'var(--primary)' }}></i>
              Chats
            </h2>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading && contacts.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '32px', marginBottom: '12px', display: 'block' }}></i>
                Cargando chats...
              </div>
            ) : contacts.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <i className="fa-solid fa-inbox" style={{ fontSize: '48px', marginBottom: '16px', display: 'block', opacity: 0.3 }}></i>
                <p>No hay chats para mostrar</p>
              </div>
            ) : (
              contacts.map((contact) => (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => loadMessages(contact)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '16px 20px',
                    background: selectedContact?.id === contact.id ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--border-light)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  {contact.avatar ? (
                    <img
                      src={contact.avatar}
                      alt={contact.name}
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: 'var(--radius-full)',
                        objectFit: 'cover'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--gradient-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '18px',
                    }}>
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: 'block', fontSize: '15px', marginBottom: '4px' }}>{contact.name}</strong>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block' }}>
                      {contact.preview || contact.role || 'Ver mensajes'}
                    </span>
                  </div>

                  {contact.unreadCount > 0 && (
                    <span className="badge badge-primary" style={{ minWidth: '24px', height: '24px', padding: '0 8px' }}>
                      {contact.unreadCount}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Messages Area */}
        {selectedContact && (
          <div className="card" style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: 'var(--radius-xl)',
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
            }}>
              <button
                type="button"
                onClick={() => setSelectedContact(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <i className="fa-solid fa-arrow-left" style={{ fontSize: '18px' }}></i>
              </button>

              {selectedContact.avatar ? (
                <img
                  src={selectedContact.avatar}
                  alt={selectedContact.name}
                  style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-full)', objectFit: 'cover' }}
                />
              ) : (
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--gradient-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '16px',
                }}>
                  {selectedContact.name.charAt(0).toUpperCase()}
                </div>
              )}

              <div>
                <strong style={{ display: 'block', fontSize: '16px' }}>{selectedContact.name}</strong>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {selectedContact.role || selectedContact.preview || 'En linea'}
                </span>
              </div>
            </div>

            {/* Messages */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px',
              background: 'var(--bg-secondary)',
            }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '32px' }}></i>
                </div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <i className="fa-solid fa-comments" style={{ fontSize: '48px', marginBottom: '16px', display: 'block', opacity: 0.3 }}></i>
                  <p>Comienza la conversacion</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {messages.map((msg, i) => {
                    const isMine = msg.isMine || msg.sender === 'me';
                    return (
                      <div
                        key={msg.id || i}
                        className={`chat-message ${isMine ? 'me' : 'other'}`}
                        style={{ alignItems: isMine ? 'flex-end' : 'flex-start' }}
                      >
                        <div
                          className="chat-bubble"
                          style={{
                            background: isMine ? 'var(--gradient-primary)' : 'var(--bg-card)',
                            color: isMine ? 'white' : 'var(--text-primary)',
                            borderBottomRightRadius: isMine ? '6px' : 'var(--radius-lg)',
                            borderBottomLeftRadius: isMine ? 'var(--radius-lg)' : '6px',
                            maxWidth: '80%',
                            padding: '12px 16px',
                            boxShadow: 'var(--shadow-sm)',
                          }}
                        >
                          <p style={{ fontSize: '14px', lineHeight: 1.5, margin: 0 }}>{msg.text}</p>
                          <span style={{ fontSize: '11px', opacity: 0.7, display: 'block', marginTop: '6px' }}>
                            {formatTime(msg.time)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid var(--border-light)',
              background: 'var(--bg-card)',
            }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Escribe un mensaje..."
                  value={messageDraft}
                  onChange={(e) => setMessageDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                  disabled={sending}
                  style={{ flex: 1, padding: '12px 16px' }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={sendMessage}
                  disabled={sending || !messageDraft.trim()}
                  style={{ padding: '12px 20px' }}
                >
                  <i className={`fa-solid ${sending ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
