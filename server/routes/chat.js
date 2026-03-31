import db from '../db.js';
import jwt from 'jsonwebtoken';
import { verifyToken } from './auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'matebudy_super_secret_key_mvp_only';
const SERVICE_CHAT_ALLOWED_STATUSES = ['paid_retained', 'accepted', 'in_progress', 'released_manually'];

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
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

function parseJson(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

async function getTransactionForUser(transactionId, userId) {
  return getAsync(
    `SELECT *
     FROM transactions
     WHERE id = ?
       AND (client_id = ? OR provider_id = ?)`,
    [transactionId, userId, userId],
  );
}

function isServiceChatEnabled(transaction) {
  return Boolean(transaction && SERVICE_CHAT_ALLOWED_STATUSES.includes(transaction.status));
}

function roomIdForTransaction(transactionId) {
  return `service_tx_${transactionId}`;
}

function formatServiceMessage(row, currentUserId) {
  const meta = parseJson(row.meta, null) || {};
  const sender = row.kind === 'system'
    ? 'system'
    : Number(row.sender_id) === Number(currentUserId)
      ? 'me'
      : 'other';

  return {
    id: row.id,
    kind: row.kind || 'text',
    text: row.text,
    sender,
    time: row.created_at,
    attachmentType: meta.attachmentType || null,
    fileName: meta.fileName || null,
    fileMime: meta.fileMime || null,
    fileData: meta.fileData || null,
    latitude: meta.latitude || null,
    longitude: meta.longitude || null,
    mapUrl: meta.mapUrl || null,
  };
}

export const chatRoutes = (app, io) => {

  // Get chat history
  app.get('/api/chat/history/:userId', verifyToken, (req, res) => {
    const roomId = [req.user.id, parseInt(req.params.userId)].sort().join('_');
    db.all(
      'SELECT * FROM messages WHERE room_id = ? ORDER BY created_at DESC LIMIT 100',
      [roomId],
      (err, messages) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ messages: messages.reverse() });
      }
    );
  });

  // Get all chats for user
  app.get('/api/chat/conversations', verifyToken, (req, res) => {
    db.all(
      `SELECT DISTINCT
        CASE
          WHEN sender_id = ? THEN room_id
          ELSE room_id
        END as room_id,
        sender_id,
        text,
        created_at
      FROM messages
      WHERE room_id LIKE '%' || ? || '%'
      ORDER BY created_at DESC`,
      [req.user.id, req.user.id],
      (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ conversations: rows });
      }
    );
  });

  app.get('/api/chat/service/:transactionId', verifyToken, async (req, res) => {
    try {
      const transaction = await getTransactionForUser(req.params.transactionId, req.user.id);
      if (!transaction) return res.status(404).json({ error: 'Contratacion no encontrada' });
      if (!isServiceChatEnabled(transaction)) {
        return res.status(403).json({ error: 'El chat privado aun no esta habilitado para esta contratacion' });
      }

      const rows = await allAsync(
        `SELECT *
         FROM messages
         WHERE room_id = ?
         ORDER BY created_at ASC, id ASC`,
        [roomIdForTransaction(req.params.transactionId)],
      );

      res.json({
        messages: rows.map((row) => formatServiceMessage(row, req.user.id)),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/chat/service/:transactionId', verifyToken, async (req, res) => {
    try {
      const transaction = await getTransactionForUser(req.params.transactionId, req.user.id);
      if (!transaction) return res.status(404).json({ error: 'Contratacion no encontrada' });
      if (!isServiceChatEnabled(transaction)) {
        return res.status(403).json({ error: 'El chat privado aun no esta habilitado para esta contratacion' });
      }

      const text = String(req.body.text || '').trim();
      const kind = String(req.body.kind || 'text').trim() || 'text';
      const meta = req.body.meta || null;

      if (!text) {
        return res.status(400).json({ error: 'El mensaje no puede estar vacio' });
      }

      const result = await runAsync(
        `INSERT INTO messages (room_id, sender_id, text, kind, meta, created_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          roomIdForTransaction(req.params.transactionId),
          req.user.id,
          text,
          kind,
          meta ? JSON.stringify(meta) : null,
        ],
      );

      const created = await getAsync('SELECT * FROM messages WHERE id = ?', [result.lastID]);
      const formatted = formatServiceMessage(created, req.user.id);
      io.to(roomIdForTransaction(req.params.transactionId)).emit('receive_message', {
        room_id: roomIdForTransaction(req.params.transactionId),
        ...formatted,
      });

      res.status(201).json({ message: formatted });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // WebSocket handling
  io.on('connection', (socket) => {
    console.log('WebSocket Connection:', socket.id);

    socket.on('join_room', ({ token, room_id }) => {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.join(room_id);
        console.log(`User ${decoded.id} joined room ${room_id}`);
      } catch (e) {
        socket.emit('error', 'Token inválido para Socket');
      }
    });

    socket.on('send_message', ({ token, room_id, text }) => {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const msgObj = {
          room_id,
          sender_id: decoded.id,
          text,
          created_at: new Date().toISOString()
        };
        db.run(
          'INSERT INTO messages (room_id, sender_id, text, created_at) VALUES (?, ?, ?, ?)',
          [msgObj.room_id, msgObj.sender_id, msgObj.text, msgObj.created_at],
          function (err) {
            if (!err) {
              msgObj.id = this.lastID;
              io.to(room_id).emit('receive_message', msgObj);
            }
          }
        );
      } catch (e) {
        socket.emit('error', 'Error enviando mensaje');
      }
    });

    socket.on('typing', ({ token, room_id, isTyping }) => {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.to(room_id).emit('user_typing', { userId: decoded.id, isTyping });
      } catch (e) { }
    });
  });

};
