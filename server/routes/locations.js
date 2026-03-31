import db from '../db.js';
import { verifyToken } from './auth.js';

export const locationRoutes = (app) => {

  // Update user location
  app.post('/api/location/update', verifyToken, (req, res) => {
    const { lat, lng } = req.body;
    if (!lat || !lng) return res.status(400).json({ error: 'Latitud y longitud requeridas' });

    db.run(
      'INSERT OR REPLACE INTO locations (user_id, lat, lng, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
      [req.user.id, lat, lng],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
      }
    );
  });

  // Get nearby providers
  app.get('/api/location/nearby-providers', verifyToken, (req, res) => {
    const { lat, lng, radius = 5 } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'Ubicación requerida' });

    const distanceQuery = `
      SELECT u.*, l.lat, l.lng,
             (6371 * acos(cos(radians(?)) * cos(radians(l.lat)) * cos(radians(l.lng - ?)) + sin(radians(?)) * sin(radians(l.lat)))) AS distance
      FROM users u
      JOIN locations l ON u.id = l.user_id
      WHERE u.role = 'service_provider'
      AND l.updated_at > datetime('now', '-5 minutes')
      AND u.isVerified = 1
      HAVING distance < ?
      ORDER BY distance ASC
      LIMIT 50
    `;

    db.all(distanceQuery, [lat, lng, lat, radius], (err, providers) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ providers });
    });
  });

  // Get user location
  app.get('/api/location/current', verifyToken, (req, res) => {
    db.get('SELECT * FROM locations WHERE user_id = ?', [req.user.id], (err, location) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ location });
    });
  });

};
