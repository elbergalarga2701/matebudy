import db from '../db.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { verifyToken } from './auth.js';
import { legacyUploadsDir, projectUploadsDir, uploadsDir } from '../paths.js';

const LEGACY_POST_IMAGE_DIRS = [uploadsDir, legacyUploadsDir, projectUploadsDir]
  .filter(Boolean)
  .filter((dir, index, array) => array.indexOf(dir) === index);

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || '') || '';
    const safeExtension = extension.replace(/[^.\w-]/g, '').toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExtension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo imagenes permitidas para publicaciones'));
  },
});

function maybeUploadSingleImage(req, res, next) {
  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  if (!contentType.includes('multipart/form-data')) {
    next();
    return;
  }

  upload.single('image')(req, res, (error) => {
    if (error) {
      res.status(400).json({ error: error.message || 'No se pudo procesar la publicacion' });
      return;
    }
    next();
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function safeUnlink(filePath) {
  if (!filePath) return;
  fs.unlink(filePath, () => {});
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
}

function resolveLegacyUploadPath(uploadUrl) {
  const fileName = path.basename(String(uploadUrl || ''));
  if (!fileName) return null;

  for (const dir of LEGACY_POST_IMAGE_DIRS) {
    const candidate = path.join(dir, fileName);
    if (fileExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

function normalizePostImageUrl(value) {
  if (!value) return '';
  if (/^(data:|https?:|blob:)/i.test(String(value))) return value;

  return String(value).startsWith('/uploads/') ? value : value;
}

function deleteStoredPostImage(value) {
  if (!value || !String(value).startsWith('/uploads/')) return;
  const filePath = resolveLegacyUploadPath(value);
  safeUnlink(filePath);
}

async function toInlineDataUrl(file) {
  if (!file?.path) return null;

  const bytes = await fs.promises.readFile(file.path);
  const mimeType = file.mimetype || 'image/jpeg';
  safeUnlink(file.path);
  return `data:${mimeType};base64,${bytes.toString('base64')}`;
}

function mimeTypeForImagePath(filePath) {
  const extension = path.extname(String(filePath || '')).toLowerCase();

  switch (extension) {
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.avif':
      return 'image/avif';
    default:
      return 'image/jpeg';
  }
}

async function resolveHydratedPostImage(value) {
  const normalized = normalizePostImageUrl(value);
  if (!normalized) return '';
  if (!String(normalized).startsWith('/uploads/')) return normalized;

  const filePath = resolveLegacyUploadPath(normalized);
  if (!filePath) return '';

  try {
    const bytes = await fs.promises.readFile(filePath);
    return `data:${mimeTypeForImagePath(filePath)};base64,${bytes.toString('base64')}`;
  } catch (error) {
    return '';
  }
}

async function hydratePosts(currentUserId) {
  const posts = await allAsync(
    `SELECT
       p.id,
       p.user_id,
       p.content,
       p.image_url,
       p.mood,
       p.created_at,
       u.name AS author,
       u.avatar AS author_avatar,
       u.role AS author_role,
       u.manualStatus AS author_manual_status,
       up.is_online AS author_is_online,
       (
         SELECT COUNT(*)
         FROM post_likes pl
         WHERE pl.post_id = p.id
       ) AS likes_count,
       (
         SELECT COUNT(*)
         FROM post_likes pl
         WHERE pl.post_id = p.id AND pl.user_id = ?
       ) AS liked_by_me
     FROM posts p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN user_presence up ON up.user_id = u.id
     ORDER BY p.created_at DESC, p.id DESC`,
    [currentUserId || 0],
  );

  const comments = await allAsync(
    `SELECT
       c.id,
       c.post_id,
       c.user_id,
       c.text,
       c.created_at,
       u.name AS author
     FROM post_comments c
     JOIN users u ON u.id = c.user_id
     ORDER BY c.created_at ASC, c.id ASC`,
  );

  const commentsByPost = comments.reduce((acc, comment) => {
    const list = acc[comment.post_id] || [];
    list.push({
      id: String(comment.id),
      authorId: String(comment.user_id),
      author: comment.author,
      text: comment.text,
      createdAt: comment.created_at,
    });
    acc[comment.post_id] = list;
    return acc;
  }, {});

  return Promise.all(posts.map(async (post) => ({
    id: String(post.id),
    authorId: String(post.user_id),
    author: post.author,
    authorAvatar: post.author_avatar || '',
    role: post.author_role,
    manualStatus: post.author_manual_status || 'en_linea',
    isOnline: Boolean(post.author_is_online),
    content: post.content,
    imageUrl: await resolveHydratedPostImage(post.image_url),
    mood: post.mood || 'Comunidad',
    likedByCount: Number(post.likes_count || 0),
    likedByMe: Boolean(post.liked_by_me),
    comments: commentsByPost[post.id] || [],
    createdAt: post.created_at,
  })));
}

export const postRoutes = (app) => {
  app.get('/api/posts', verifyToken, async (req, res) => {
    try {
      const posts = await hydratePosts(req.user.id);
      res.json({ posts });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/posts', verifyToken, maybeUploadSingleImage, async (req, res) => {
    try {
      const content = String(req.body.content || '').trim();
      const mood = String(req.body.mood || 'Comunidad').trim() || 'Comunidad';
      if (!content && !req.file) {
        return res.status(400).json({ error: 'La publicacion necesita texto o imagen' });
      }

      const imageValue = req.file ? await toInlineDataUrl(req.file) : null;

      await runAsync(
        `INSERT INTO posts (user_id, content, image_url, mood, created_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [req.user.id, content, imageValue, mood],
      );

      const posts = await hydratePosts(req.user.id);
      res.status(201).json({ post: posts[0] || null });
    } catch (error) {
      safeUnlink(req.file?.path);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/posts/:postId', verifyToken, async (req, res) => {
    try {
      const existing = await getAsync('SELECT * FROM posts WHERE id = ?', [req.params.postId]);

      if (!existing) {
        return res.status(404).json({ error: 'Publicacion no encontrada' });
      }

      if (Number(existing.user_id) !== Number(req.user.id)) {
        return res.status(403).json({ error: 'Solo puedes borrar tus propias publicaciones' });
      }

      await runAsync('DELETE FROM post_comments WHERE post_id = ?', [req.params.postId]);
      await runAsync('DELETE FROM post_likes WHERE post_id = ?', [req.params.postId]);
      await runAsync('DELETE FROM posts WHERE id = ?', [req.params.postId]);
      deleteStoredPostImage(existing.image_url);

      res.json({ success: true, postId: String(req.params.postId) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/posts/:postId/comments', verifyToken, async (req, res) => {
    try {
      const text = String(req.body.text || '').trim();
      if (!text) return res.status(400).json({ error: 'El comentario no puede estar vacio' });

      await runAsync(
        `INSERT INTO post_comments (post_id, user_id, text, created_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
        [req.params.postId, req.user.id, text],
      );

      const posts = await hydratePosts(req.user.id);
      const post = posts.find((entry) => entry.id === String(req.params.postId));
      res.json({ post });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/posts/:postId/comments/:commentId', verifyToken, async (req, res) => {
    try {
      const text = String(req.body.text || '').trim();
      if (!text) return res.status(400).json({ error: 'El comentario no puede estar vacio' });

      const existing = await getAsync(
        'SELECT * FROM post_comments WHERE id = ? AND post_id = ?',
        [req.params.commentId, req.params.postId],
      );

      if (!existing) {
        return res.status(404).json({ error: 'Comentario no encontrado' });
      }

      if (Number(existing.user_id) !== Number(req.user.id)) {
        return res.status(403).json({ error: 'Solo puedes editar tus comentarios' });
      }

      await runAsync(
        'UPDATE post_comments SET text = ? WHERE id = ? AND post_id = ?',
        [text, req.params.commentId, req.params.postId],
      );

      const posts = await hydratePosts(req.user.id);
      const post = posts.find((entry) => entry.id === String(req.params.postId));
      res.json({ post });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/posts/:postId/comments/:commentId', verifyToken, async (req, res) => {
    try {
      const existing = await getAsync(
        'SELECT * FROM post_comments WHERE id = ? AND post_id = ?',
        [req.params.commentId, req.params.postId],
      );

      if (!existing) {
        return res.status(404).json({ error: 'Comentario no encontrado' });
      }

      if (Number(existing.user_id) !== Number(req.user.id)) {
        return res.status(403).json({ error: 'Solo puedes borrar tus comentarios' });
      }

      await runAsync(
        'DELETE FROM post_comments WHERE id = ? AND post_id = ?',
        [req.params.commentId, req.params.postId],
      );

      const posts = await hydratePosts(req.user.id);
      const post = posts.find((entry) => entry.id === String(req.params.postId));
      res.json({ post });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/posts/:postId/like', verifyToken, async (req, res) => {
    try {
      const existing = await getAsync(
        'SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?',
        [req.params.postId, req.user.id],
      );

      if (existing) {
        await runAsync('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?', [req.params.postId, req.user.id]);
      } else {
        await runAsync(
          'INSERT INTO post_likes (post_id, user_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
          [req.params.postId, req.user.id],
        );
      }

      const posts = await hydratePosts(req.user.id);
      const post = posts.find((entry) => entry.id === String(req.params.postId));
      res.json({ post });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
};
