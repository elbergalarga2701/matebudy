import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../AuthContext';
import { apiUrl } from '../api';

const MOODS = ['Comunidad', 'Recomendacion', 'Apoyo', 'Actividad'];

function formatTimeLabel(createdAt) {
  if (!createdAt) return 'Hace un momento';
  const diff = Date.now() - new Date(createdAt).getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `Hace ${days} d`;
}

export default function Feed() {
  const { user } = useAuth();
  const [draft, setDraft] = useState('');
  const [mood, setMood] = useState('Comunidad');
  const [posts, setPosts] = useState([]);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [expandedCommentBox, setExpandedCommentBox] = useState({});
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const fileInputRef = useRef(null);

  const authHeaders = useMemo(() => {
    const token = localStorage.getItem('mate_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [user?.uid]);

  const resolveMediaUrl = (value) => {
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith('/uploads')) {
      const isCapacitor = typeof window !== 'undefined' && window.location.protocol === 'capacitor:';
      const socketUrl = isCapacitor ? 'http://167.60.107.149:3000' : (import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000');
      return `${socketUrl}${value}`;
    }
    return apiUrl(value);
  };

  const loadPosts = async () => {
    const response = await fetch(apiUrl('/api/posts'), {
      headers: {
        ...authHeaders,
      },
      credentials: 'include',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'No se pudo cargar el muro');
    setPosts(data.posts || []);
  };

  useEffect(() => {
    void (async () => {
      try {
        await loadPosts();
      } catch (error) {
        setToast(error.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.uid]);

  const publishDraft = async () => {
    if (!draft.trim() && !selectedImage) return;
    setPublishing(true);

    try {
      const hasImage = Boolean(selectedImage);
      const response = await fetch(apiUrl('/api/posts'), {
        method: 'POST',
        headers: hasImage
          ? {
              ...authHeaders,
            }
          : {
              'Content-Type': 'application/json',
              ...authHeaders,
            },
        credentials: 'include',
        body: hasImage
          ? (() => {
              const formData = new FormData();
              formData.append('content', draft.trim());
              formData.append('mood', mood);
              formData.append('image', selectedImage);
              return formData;
            })()
          : JSON.stringify({
              content: draft.trim(),
              mood,
            }),
      });
      const raw = await response.text();
      let data = {};
      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch (parseError) {
          throw new Error(raw || 'No se pudo públicar');
        }
      }
      if (!response.ok) throw new Error(data.error || 'No se pudo públicar');

      setPosts((prev) => [data.post, ...prev]);
      setDraft('');
      setMood('Comunidad');
      setSelectedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setToast('Publicacion creada para el muro');
      setTimeout(() => setToast(''), 2500);
    } catch (error) {
      setToast(error.message || 'No se pudo públicar');
    } finally {
      setPublishing(false);
    }
  };

  const toggleLike = async (postId) => {
    try {
      const response = await fetch(apiUrl(`/api/posts/${postId}/like`), {
        method: 'POST',
        headers: {
          ...authHeaders,
        },
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo guardar el like');
      setPosts((prev) => prev.map((post) => (post.id === String(postId) ? data.post : post)));
    } catch (error) {
      setToast(error.message);
    }
  };

  const submitComment = async (postId) => {
    const draftComment = (commentDrafts[postId] || '').trim();
    if (!draftComment) return;

    try {
      const response = await fetch(apiUrl(`/api/posts/${postId}/comments`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        credentials: 'include',
        body: JSON.stringify({ text: draftComment }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo guardar el comentario');
      setPosts((prev) => prev.map((post) => (post.id === String(postId) ? data.post : post)));
      setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
    } catch (error) {
      setToast(error.message);
    }
  };

  const startEditComment = (postId, comment) => {
    setEditingCommentId(comment.id);
    setExpandedCommentBox((prev) => ({ ...prev, [postId]: true }));
    setCommentDrafts((prev) => ({ ...prev, [postId]: comment.text }));
  };

  const saveEditedComment = async (postId) => {
    const nextText = (commentDrafts[postId] || '').trim();
    if (!editingCommentId || !nextText) return;

    try {
      const response = await fetch(apiUrl(`/api/posts/${postId}/comments/${editingCommentId}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        credentials: 'include',
        body: JSON.stringify({ text: nextText }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo editar el comentario');
      setPosts((prev) => prev.map((post) => (post.id === String(postId) ? data.post : post)));
      setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
      setEditingCommentId(null);
      setExpandedCommentBox((prev) => ({ ...prev, [postId]: false }));
    } catch (error) {
      setToast(error.message);
    }
  };

  const deleteComment = async (postId, commentId) => {
    try {
      const response = await fetch(apiUrl(`/api/posts/${postId}/comments/${commentId}`), {
        method: 'DELETE',
        headers: {
          ...authHeaders,
        },
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo borrar el comentario');
      setPosts((prev) => prev.map((post) => (post.id === String(postId) ? data.post : post)));
      if (editingCommentId === commentId) {
        setEditingCommentId(null);
        setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
      }
    } catch (error) {
      setToast(error.message);
    }
  };

  return (
    <div className="app-scroll social-feed-shell" style={{ padding: '0 0 110px', minHeight: '100vh' }}>
      {toast && <div className="toast toast-success">{toast}</div>}

      <div className="page-shell social-feed-layout">
        <section className="social-feed-main">
          <header className="social-topbar animate-in">
            <div className="social-topbar-copy">
              <span className="social-topbar-kicker">Inicio</span>
              <h1>Hola, {user?.displayName || 'amigo'}</h1>
              <p>Muro real para compartir planes, pedir compañía y publicar fotos sin perder tus datos cuando cambias el perfil.</p>
            </div>

            <div className="social-topbar-tags">
              <span className="badge badge-secondary"><i className="fa-solid fa-heart"></i> Comunidad</span>
              <span className="badge badge-accent"><i className="fa-solid fa-user-tag"></i> {user?.roleLabel}</span>
            </div>
          </header>

          <section className="social-composer">
            <div className="social-composer-head">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.displayName || 'Perfil'} className="avatar-ring social-user-avatar" style={{ objectFit: 'cover' }} />
              ) : (
                <div className="feed-avatar-fallback social-user-avatar">
                  {(user?.displayName || 'U').charAt(0).toUpperCase()}
                </div>
              )}

              <div>
                <strong>Comparte algo con la comunidad</strong>
                <span>Puedes públicar texto y fotos. El corrector del teclado queda habilitado.</span>
              </div>
            </div>

            <textarea
              className="form-input textarea-field social-composer-input"
              rows={3}
              placeholder="Que esta pasando hoy? Ejemplo: salgo a caminar por la rambla a las 19, si alguien quiere compañía se suma."
              value={draft}
              spellCheck
              autoCorrect="on"
              autoCapitalize="sentences"
              onChange={(e) => setDraft(e.target.value)}
            />

            <div className="info-chip-row" style={{ marginTop: '12px' }}>
              <select className="form-input" value={mood} onChange={(e) => setMood(e.target.value)} style={{ maxWidth: '220px' }}>
                {MOODS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <button type="button" className="pill-button pill-button-secondary" onClick={() => fileInputRef.current?.click()}>
                <i className="fa-solid fa-image"></i> {selectedImage ? selectedImage.name : 'Agregar foto'}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(e) => setSelectedImage(e.target.files?.[0] || null)} />
            </div>

            <div className="social-composer-actions">
              <button type="button" className="pill-button pill-button-primary" onClick={publishDraft} disabled={publishing || (!draft.trim() && !selectedImage)}>
                <i className={`fa-solid ${publishing ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i> {publishing ? 'Publicando...' : 'Publicar'}
              </button>
              <span className="social-inline-note">Tus públicaciónes y comentarios quedan sincronizados con el servidor.</span>
            </div>
          </section>

          <div className="social-post-stream">
            {loading ? (
              <div className="empty-state">
                <div className="empty-state-icon"><i className="fa-solid fa-spinner fa-spin"></i></div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>Cargando muro</h3>
                <p style={{ color: 'var(--text-medium)', lineHeight: 1.6 }}>Estamos trayendo publicaciones reales.</p>
              </div>
            ) : posts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><i className="fa-solid fa-camera-retro"></i></div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>Todavía no hay publicaciones</h3>
                <p style={{ color: 'var(--text-medium)', lineHeight: 1.6 }}>Haz la primera publicación del muro con texto o una foto.</p>
              </div>
            ) : posts.map((post) => (
              <article key={post.id} className="social-post">
                <div className="social-post-header">
                  <div className="social-post-author">
                    {post.authorAvatar ? (
                      <img src={post.authorAvatar} alt={post.author} className="avatar-ring social-user-avatar" style={{ objectFit: 'cover' }} />
                    ) : (
                      <div className="feed-avatar-fallback social-user-avatar">{post.author.charAt(0).toUpperCase()}</div>
                    )}

                    <div className="social-post-author-copy">
                      <strong>{post.author}</strong>
                      <span>{post.role} · {formatTimeLabel(post.createdAt)}</span>
                    </div>
                  </div>

                  <span className="badge badge-primary">{post.mood}</span>
                </div>

                {post.content && <p className="social-post-body">{post.content}</p>}
                {post.imageUrl && (
                  <div className="social-post-image-container">
                    <img src={resolveMediaUrl(post.imageUrl)} alt="Publicacion" className="social-post-image" />
                  </div>
                )}

                <div className="social-post-actions">
                  <button type="button" className={`reaction-chip ${post.likedByMe ? 'active' : ''}`} onClick={() => void toggleLike(post.id)}>
                    <i className={`fa-solid ${post.likedByMe ? 'fa-heart-circle-check' : 'fa-heart'}`}></i> Me gusta {post.likedByCount}
                  </button>
                  <span className="social-post-meta"><i className="fa-solid fa-comment"></i> {post.comments.length} comentarios</span>
                </div>

                <div className="social-comments">
                  <div className="social-comments-list">
                    {post.comments.map((comment) => (
                      <div key={comment.id} className="social-comment">
                        <div className="social-comment-head">
                          <strong>{comment.author}</strong>
                          {comment.authorId === user?.uid && (
                            <div className="social-comment-actions">
                              <button type="button" className="social-comment-link" onClick={() => startEditComment(post.id, comment)}>Editar</button>
                              <button type="button" className="social-comment-link danger" onClick={() => void deleteComment(post.id, comment.id)}>Borrar</button>
                            </div>
                          )}
                        </div>
                        <p>{comment.text}</p>
                        <span>{formatTimeLabel(comment.createdAt)}</span>
                      </div>
                    ))}
                  </div>

                  <div className={`social-comment-composer ${expandedCommentBox[post.id] ? 'expanded' : 'collapsed'}`}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={editingCommentId ? 'Edita tu comentario...' : 'Escribe un comentario...'}
                      value={commentDrafts[post.id] || ''}
                      spellCheck
                      autoCorrect="on"
                      autoCapitalize="sentences"
                      onFocus={() => setExpandedCommentBox((prev) => ({ ...prev, [post.id]: true }))}
                      onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && void (editingCommentId ? saveEditedComment(post.id) : submitComment(post.id))}
                    />
                    <div className="social-comment-cta-row">
                      {editingCommentId && (
                        <button
                          type="button"
                          className="pill-button pill-button-secondary social-comment-button"
                          onClick={() => {
                            setEditingCommentId(null);
                            setCommentDrafts((prev) => ({ ...prev, [post.id]: '' }));
                          }}
                        >
                          Cancelar
                        </button>
                      )}
                      <button
                        type="button"
                        className="pill-button pill-button-primary social-comment-button"
                        onClick={() => void (editingCommentId ? saveEditedComment(post.id) : submitComment(post.id))}
                      >
                        <i className={`fa-solid ${editingCommentId ? 'fa-floppy-disk' : 'fa-reply'}`}></i> {editingCommentId ? 'Guardar' : 'Enviar'}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="social-feed-side">
          <section className="social-side-section">
            <div className="social-side-title">
              <h3>Muro real</h3>
              <p>Las públicaciónes usan tus datos actuales, asi que si actualizas tu perfil tambien se actualiza como apareces en el muro.</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
