import db from '../db.js';
import { verifyToken } from './auth.js';

export const sosRoutes = (app) => {

  // Create SOS alert
  app.post('/api/sos/alert', verifyToken, (req, res) => {
    const { message, location } = req.body;
    db.run(
      'INSERT INTO sos_alerts (user_id, message, location, status, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [req.user.id, message || 'SOS - Necesito ayuda', JSON.stringify(location || {}), 'active'],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ alert_id: this.lastID, status: 'active' });
      }
    );
  });

  // Get SOS alerts for monitoring
  app.get('/api/sos/alerts', verifyToken, (req, res) => {
    db.all(
      'SELECT s.*, u.name FROM sos_alerts s JOIN users u ON s.user_id = u.id WHERE s.status = ? ORDER BY s.created_at DESC',
      ['active'],
      (err, alerts) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ alerts });
      }
    );
  });

  // Cancel SOS alert
  app.delete('/api/sos/alert/:id', verifyToken, (req, res) => {
    db.run(
      'UPDATE sos_alerts SET status = ? WHERE id = ? AND user_id = ?',
      ['cancelled', req.params.id, req.user.id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
      }
    );
  });

  // Get SOS history
  app.get('/api/sos/history', verifyToken, (req, res) => {
    db.all(
      'SELECT * FROM sos_alerts WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
      [req.user.id],
      (err, alerts) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ alerts });
      }
    );
  });

};
