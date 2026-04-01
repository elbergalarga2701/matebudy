import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../AuthContext';
import { apiUrl, publicFileUrl } from '../api';

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
  const [deletingPostId, setDeletingPostId] = useState(null);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [expandedCommentBox, setExpandedCommentBox] = useState({});
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [hiddenBrokenImages, setHiddenBrokenImages] = useState({});
  const fileInputRef = useRef(null);

  const authHeaders = useMemo(() => {
    const token = localStorage.getItem('mate_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [user?.uid]);

  const resolveAssetUrl = (value) => {
    if (!value) return '';
    const url = publicFileUrl(value);
    return url;
  };

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2500);
  };

  const loadPosts = async () => {
    const response = await fetch(apiUrl('/api/posts'), {
      headers: { ...authHeaders },
      credentials: 'include',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'No se pudo cargar el muro');
    setPosts(data.posts || []);
    setHiddenBrokenImages({});
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
        headers: hasImage ? { ...authHeaders } : { 'Content-Type': 'application/json', ...authHeaders },
        credentials: 'include',
        body: hasImage
          ? (() => {
            const formData = new FormData();
            formData.append('content', draft.trim());
            formData.append('mood', mood);
            formData.append('image', selectedImage);
            return formData;
          })()
          : JSON.stringify({ content: draft.trim(), mood }),
      });

      const raw = await response.text();
      let data = {};
      if (raw) {
        try { data = JSON.parse(raw); } catch (error) { throw new Error(raw || 'No se pudo publicar'); }
      }

      if (!response.ok) throw new Error(data.error || 'No se pudo publicar');

      setPosts((prev) => [data.post, ...prev]);
      setDraft('');
      setMood('Comunidad');
      setSelectedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      showToast('Publicacion creada para el muro');
    } catch (error) {
      showToast(error.message || 'No se pudo publicar');
    } finally {
      setPublishing(false);
    }
  };

  const deletePost = async (postId) => {
    setDeletingPostId(String(postId));

    try {
      const response = await fetch(apiUrl(`/api/posts/${postId}`), {
        method: 'DELETE',
        headers: { ...authHeaders },
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo borrar la publicacion');

      setPosts((prev) => prev.filter((post) => post.id !== String(postId)));
      setHiddenBrokenImages((prev) => {
        const next = { ...prev };
        delete next[String(postId)];
        return next;
      });
      showToast('Publicacion eliminada');
    } catch (error) {
      showToast(error.message || 'No se pudo borrar la publicacion');
    } finally {
      setDeletingPostId(null);
    }
  };

  const toggleLike = async (postId) => {
    try {
      const response = await fetch(apiUrl(`/api/posts/${postId}/like`), {
        method: 'POST',
        headers: { ...authHeaders },
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo guardar el like');
      setPosts((prev) => prev.map((post) => (post.id === String(postId) ? data.post : post)));
    } catch (error) {
      showToast(error.message);
    }
  };

  const submitComment = async (postId) => {
    const draftComment = (commentDrafts[postId] || '').trim();
    if (!draftComment) return;

    try {
      const response = await fetch(apiUrl(`/api/posts/${postId}/comments`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        credentials: 'include',
        body: JSON.stringify({ text: draftComment }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo guardar el comentario');
      setPosts((prev) => prev.map((post) => (post.id === String(postId) ? data.post : post)));
      setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
      setEditingCommentId(null);
    } catch (error) {
      showToast(error.message);
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
        headers: { 'Content-Type': 'application/json', ...authHeaders },
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
      showToast(error.message);
    }
  };

  const deleteComment = async (postId, commentId) => {
    try {
      const response = await fetch(apiUrl(`/api/posts/${postId}/comments/${commentId}`), {
        method: 'DELETE',
        headers: { ...authHeaders },
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
      showToast(error.message);
    }
  };

  return (
    <div className="social-feed-shell">
      {toast && <div className="toast">{toast}</div>}

      {/* Header */}
      <header className="social-topbar animate-in">
        <div>
          <span className="badge badge-secondary" style={{ marginBottom: '12px' }}>Inicio</span>
          <h1>Hola, {user?.displayName || 'amigo'}</h1>
          <p style={{ marginTop: '8px' }}>Comparte momentos, pide compania y conecta con la comunidad.</p>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
          <span className="badge badge-primary">
            <i className="fa-solid fa-heart"></i> Comunidad
          </span>
          <span className="badge badge-accent">
            <i className="fa-solid fa-user-tag"></i> {user?.roleLabel}
          </span>
        </div>
      </header>

      {/* Composer */}
      <section className="social-composer animate-in">
        <div className="social-composer-head">
          {user?.avatar ? (
            <img src={resolveAssetUrl(user.avatar)} alt={user.displayName || 'Perfil'} className="social-user-avatar" style={{ objectFit: 'cover' }} />
          ) : (
            <div className="social-user-avatar">
              {(user?.displayName || 'U').charAt(0).toUpperCase()}
            </div>
          )}

          <div>
            <strong style={{ display: 'block', fontSize: '15px' }}>Comparte algo</strong>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Que esta pasando hoy?</span>
          </div>
        </div>

        <textarea
          className="social-composer-input"
          rows={3}
          placeholder="Escribe algo..."
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />

        <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
          <select
            className="form-input"
            value={mood}
            onChange={(event) => setMood(event.target.value)}
            style={{ padding: '10px 14px', fontSize: '14px' }}
          >
            {MOODS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fileInputRef.current?.click()}
            style={{ padding: '10px 20px', fontSize: '14px' }}
          >
            <i className="fa-solid fa-image"></i> {selectedImage ? selectedImage.name : 'Foto'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(event) => setSelectedImage(event.target.files?.[0] || null)} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={publishDraft}
            disabled={publishing || (!draft.trim() && !selectedImage)}
            style={{ padding: '12px 24px' }}
          >
            <i className={`fa-solid ${publishing ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
            {publishing ? 'Publicando...' : 'Publicar'}
          </button>
        </div>
      </section>

      {/* Posts Feed */}
      <div className="social-post-stream">
        {loading ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <i className="fa-solid fa-spinner fa-spin"></i>
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Cargando publicaciones</h3>
            <p style={{ color: 'var(--text-muted)' }}>Un momento...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <i className="fa-solid fa-camera-retro"></i>
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Sin publicaciones</h3>
            <p style={{ color: 'var(--text-muted)' }}>Se el primero en publicar algo!</p>
          </div>
        ) : (
          posts.map((post) => (
            <article key={post.id} className="social-post animate-in">
              <div className="social-post-header">
                <div className="social-post-author">
                  {post.authorAvatar ? (
                    <img src={resolveAssetUrl(post.authorAvatar)} alt={post.author} className="social-user-avatar" style={{ objectFit: 'cover' }} />
                  ) : (
                    <div className="social-user-avatar">{post.author.charAt(0).toUpperCase()}</div>
                  )}

                  <div>
                    <strong style={{ display: 'block', fontSize: '15px' }}>{post.author}</strong>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatTimeLabel(post.createdAt)}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="badge badge-secondary">{post.mood}</span>
                  {String(post.authorId) === String(user?.uid) && (
                    <button
                      type="button"
                      onClick={() => void deletePost(post.id)}
                      disabled={deletingPostId === post.id}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--danger)',
                        cursor: deletingPostId === post.id ? 'not-allowed' : 'pointer',
                        padding: '6px',
                        opacity: deletingPostId === post.id ? 0.5 : 1,
                      }}
                    >
                      <i className={`fa-solid ${deletingPostId === post.id ? 'fa-spinner fa-spin' : 'fa-trash'}`}></i>
                    </button>
                  )}
                </div>
              </div>

              {post.content && <p className="social-post-body">{post.content}</p>}

              {post.imageUrl && !hiddenBrokenImages[post.id] && (
                <img
                  src={resolveAssetUrl(post.imageUrl)}
                  alt="Publicacion"
                  className="social-post-image"
                  onError={() => {
                    setHiddenBrokenImages((prev) => ({ ...prev, [post.id]: true }));
                    showToast('No se pudo cargar la imagen');
                  }}
                />
              )}

              <div className="social-post-actions">
                <button
                  type="button"
                  className={`reaction-chip ${post.likedByMe ? 'active' : ''}`}
                  onClick={() => void toggleLike(post.id)}
                >
                  <i className={`fa-solid ${post.likedByMe ? 'fa-heart' : 'fa-heart'}`}></i>
                  {post.likedByCount}
                </button>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="fa-solid fa-comment"></i> {post.comments.length} comentarios
                </span>
              </div>

              {/* Comments */}
              {post.comments.length > 0 && (
                <div className="social-comments" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
                  <div className="social-comments-list">
                    {post.comments.map((comment) => (
                      <div key={comment.id} className="social-comment" style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                          <strong style={{ fontSize: '14px' }}>{comment.author}</strong>
                          {comment.authorId === user?.uid && (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={() => startEditComment(post.id, comment)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: '12px', cursor: 'pointer', padding: 0 }}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteComment(post.id, comment.id)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--danger)', fontSize: '12px', cursor: 'pointer', padding: 0 }}
                              >
                                Borrar
                              </button>
                            </div>
                          )}
                        </div>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{comment.text}</p>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatTimeLabel(comment.createdAt)}</span>
                      </div>
                    ))}
                  </div>

                  <div className={`social-comment-composer ${expandedCommentBox[post.id] ? 'expanded' : 'collapsed'}`} style={{ marginTop: '12px' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={editingCommentId ? 'Edita tu comentario...' : 'Escribe un comentario...'}
                      value={commentDrafts[post.id] || ''}
                      onFocus={() => setExpandedCommentBox((prev) => ({ ...prev, [post.id]: true }))}
                      onChange={(event) => setCommentDrafts((prev) => ({ ...prev, [postId]: event.target.value }))}
                      onKeyDown={(event) => event.key === 'Enter' && void (editingCommentId ? saveEditedComment(post.id) : submitComment(post.id))}
                      style={{ fontSize: '14px', padding: '10px 14px' }}
                    />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
                      {editingCommentId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCommentId(null);
                            setCommentDrafts((prev) => ({ ...prev, [post.id]: '' }));
                          }}
                          className="btn btn-secondary"
                          style={{ padding: '8px 16px', fontSize: '13px' }}
                        >
                          Cancelar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void (editingCommentId ? saveEditedComment(post.id) : submitComment(post.id))}
                        className="btn btn-primary"
                        style={{ padding: '8px 16px', fontSize: '13px' }}
                      >
                        <i className={`fa-solid ${editingCommentId ? 'fa-floppy-disk' : 'fa-reply'}`}></i>
                        {editingCommentId ? 'Guardar' : 'Enviar'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
