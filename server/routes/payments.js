import db from '../db.js';
import { verifyToken } from './auth.js';

const MP_API_BASE = 'https://api.mercadopago.com';
const DEFAULT_FRONTEND_ORIGIN = process.env.APP_FRONTEND_URL || 'http://localhost:5173';

function readEnv(name, fallback = '') {
  return process.env[name] || fallback;
}

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

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

function normalizeChatStatus(status) {
  if (status === 'paid_retained') return 'retained';
  if (status === 'released_manually') return 'completed';
  if (status === 'payment_pending') return 'payment';
  if (status === 'quote_created') return 'quote';
  return status;
}

async function insertSystemMessage(transactionId, text, meta = null) {
  if (!transactionId || !text) return;

  await runAsync(
    `INSERT INTO messages (room_id, sender_id, text, kind, meta, created_at)
     VALUES (?, NULL, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [`service_tx_${transactionId}`, text, 'system', meta ? JSON.stringify(meta) : null],
  );
}

async function getSetting(key) {
  const row = await getAsync('SELECT value FROM app_settings WHERE key = ?', [key]);
  return row?.value || '';
}

async function getMercadoPagoConfig() {
  return {
    environment: (await getSetting('mp_environment')) || readEnv('MP_ENVIRONMENT', 'test'),
    accessToken: (await getSetting('mp_access_token')) || readEnv('MP_ACCESS_TOKEN'),
    publicKey: (await getSetting('mp_public_key')) || readEnv('MP_PUBLIC_KEY'),
    webhookUrl: (await getSetting('mp_webhook_url')) || readEnv('MP_WEBHOOK_URL'),
    successUrl: (await getSetting('mp_success_url')) || readEnv('MP_SUCCESS_URL', `${DEFAULT_FRONTEND_ORIGIN}/#/chat?payment=success`),
    pendingUrl: (await getSetting('mp_pending_url')) || readEnv('MP_PENDING_URL', `${DEFAULT_FRONTEND_ORIGIN}/#/chat?payment=pending`),
    failureUrl: (await getSetting('mp_failure_url')) || readEnv('MP_FAILURE_URL', `${DEFAULT_FRONTEND_ORIGIN}/#/chat?payment=failure`),
  };
}

async function mercadoPagoRequest(path, options = {}) {
  const { accessToken } = await getMercadoPagoConfig();
  if (!accessToken) {
    throw new Error('Falta MP_ACCESS_TOKEN en el backend');
  }

  const response = await fetch(`${MP_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detailedMessage = data.message || data.error || data.cause?.[0]?.description || data.cause?.[0]?.code || 'Error consultando Mercado Pago';
    throw new Error(detailedMessage);
  }

  return data;
}

async function syncPaymentStatus(paymentId) {
  const payment = await mercadoPagoRequest(`/v1/payments/${paymentId}`);
  const externalReference = payment.external_reference;
  if (!externalReference) return payment;

  let status = 'payment_pending';
  if (payment.status === 'approved') status = 'paid_retained';
  if (payment.status === 'rejected' || payment.status === 'cancelled') status = 'payment_failed';
  if (payment.status === 'refunded') status = 'refunded';
  if (payment.status === 'charged_back') status = 'disputed';

  await runAsync(
    `UPDATE transactions
     SET status = ?, mp_payment_id = ?, mp_status = ?, notification_payload = ?
     WHERE external_reference = ?`,
    [status, String(payment.id), payment.status, JSON.stringify(payment), externalReference],
  );

  return payment;
}

async function createPaymentSession(payload, authUser = null) {
  const {
    provider_id,
    provider_name,
    amount,
    hours,
    installments = 1,
    embedded = false,
    payer_email,
    title = 'Servicio MateBudY',
    description = 'Reserva de servicio con retencion manual',
  } = payload;

  if (!amount || !hours) {
    throw new Error('amount y hours son obligatorios');
  }

  let provider = null;
  if (provider_id) {
    provider = await getAsync('SELECT id, name FROM users WHERE id = ?', [provider_id]);
  }

  const providerName = provider?.name || provider_name || 'Proveedor MateBudY';
  const externalReference = `matebudy-${authUser?.id || 'local'}-${Date.now()}`;
  const config = await getMercadoPagoConfig();

  const insertResult = await runAsync(
    `INSERT INTO transactions
     (client_id, provider_id, amount, hours, installments, status, fee, provider_amount, currency, external_reference, provider_name, service_label, hourly_rate, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      authUser?.id || null,
      provider?.id || null,
      amount,
      hours,
      installments,
      'quote_created',
      Number(amount) * 0.15,
      Number(amount),
      'UYU',
      externalReference,
      providerName,
      description,
      Number(payload.hourly_rate || 0),
    ],
  );

  await insertSystemMessage(
    insertResult.lastID,
    `Reserva creada para ${providerName}. Completa el pago dentro de la app para habilitar el chat privado.`,
    {
      providerName,
      service: description,
      hours: Number(hours),
      amount: Number(amount),
    },
  );

  if (embedded) {
    return {
      session_id: insertResult.lastID,
      amount,
      status: 'quote_created',
      external_reference: externalReference,
      checkout_mode: 'embedded',
    };
  }

  if (!config.accessToken) {
    return {
      session_id: insertResult.lastID,
      amount,
      status: 'quote_created',
      external_reference: externalReference,
      checkout_mode: 'demo',
      message: 'Configura MP_ACCESS_TOKEN para crear preferencias reales',
    };
  }

  const preference = await mercadoPagoRequest('/checkout/preferences', {
    method: 'POST',
    body: JSON.stringify({
      items: [
        {
          id: String(insertResult.lastID),
          title,
          description: `${description} - ${providerName}`,
          quantity: 1,
          currency_id: 'UYU',
          unit_price: Number(amount),
        },
      ],
      payer: payer_email ? { email: payer_email } : undefined,
      external_reference: externalReference,
      notification_url: config.webhookUrl || undefined,
      back_urls: {
        success: config.successUrl,
        pending: config.pendingUrl,
        failure: config.failureUrl,
      },
      auto_return: 'approved',
    }),
  });

  await runAsync(
    'UPDATE transactions SET mp_preference_id = ?, mp_status = ? WHERE id = ?',
    [preference.id, 'preference_created', insertResult.lastID],
  );

  return {
    session_id: insertResult.lastID,
    amount,
    status: 'quote_created',
    external_reference: externalReference,
    preference_id: preference.id,
    init_point: preference.init_point,
    sandbox_init_point: preference.sandbox_init_point,
    checkout_mode: 'mercadopago',
  };
}

export const paymentRoutes = (app) => {
  app.get('/api/payments/config', verifyToken, async (req, res) => {
    const config = await getMercadoPagoConfig();
    res.json({
      publicKeyConfigured: Boolean(config.publicKey),
      accessTokenConfigured: Boolean(config.accessToken),
      webhookConfigured: Boolean(config.webhookUrl),
      environment: config.environment || 'test',
    });
  });

  app.get('/api/payments/public-config', async (req, res) => {
    const config = await getMercadoPagoConfig();
    res.json({
      publicKey: config.publicKey || '',
      environment: config.environment || 'test',
    });
  });

  app.post('/api/payments/create-session', verifyToken, async (req, res) => {
    try {
      const session = await createPaymentSession(
        { ...req.body, payer_email: req.body.payer_email || req.user.email },
        req.user,
      );
      res.json(session);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/payments/create-session-public', async (req, res) => {
    try {
      const session = await createPaymentSession(req.body, null);
      res.json(session);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/payments/process-public', async (req, res) => {
    try {
      const {
        transaction_amount,
        token,
        description,
        installments,
        payment_method_id,
        issuer_id,
        payer,
        external_reference,
      } = req.body;

      const config = await getMercadoPagoConfig();
      if (!config.accessToken) {
        return res.status(400).json({ error: 'Configura el Access Token de Mercado Pago en admin' });
      }

      const idempotencyKey = `matebudy-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const payment = await mercadoPagoRequest('/v1/payments', {
        method: 'POST',
        headers: {
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          transaction_amount: Number(transaction_amount),
          token,
          description,
          installments: Number(installments),
          payment_method_id,
          issuer_id: issuer_id ? Number(issuer_id) : undefined,
          payer,
          external_reference,
        }),
      });

      if (external_reference) {
        const transaction = await getAsync(
          'SELECT id FROM transactions WHERE external_reference = ?',
          [external_reference],
        );
        let status = 'payment_pending';
        if (payment.status === 'approved') status = 'paid_retained';
        if (payment.status === 'rejected' || payment.status === 'cancelled') status = 'payment_failed';
        if (payment.status === 'in_process') status = 'payment_pending';

        await runAsync(
          `UPDATE transactions
           SET status = ?, mp_payment_id = ?, mp_status = ?, notification_payload = ?
           WHERE external_reference = ?`,
          [status, String(payment.id), payment.status, JSON.stringify(payment), external_reference],
        );

        if (transaction?.id && payment.status === 'approved') {
          await insertSystemMessage(
            transaction.id,
            'Pago aprobado. El chat privado quedo habilitado y el dinero permanece retenido hasta finalizar el servicio.',
            {
              paymentId: String(payment.id),
              paymentStatus: payment.status,
            },
          );
        }
      }

      res.json({
        id: payment.id,
        status: payment.status,
        status_detail: payment.status_detail,
      });
    } catch (error) {
      console.error('Mercado Pago process-public error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/payments/webhook', async (req, res) => {
    try {
      const paymentId = req.query['data.id'] || req.body?.data?.id;
      const topic = req.query.type || req.query.topic || req.body?.type;

      if (topic === 'payment' && paymentId) {
        await syncPaymentStatus(paymentId);
      }

      res.status(200).json({ received: true });
    } catch (error) {
      res.status(200).json({ received: false, error: error.message });
    }
  });

  app.post('/api/payments/confirm/:sessionId', verifyToken, async (req, res) => {
    try {
      const transaction = await getAsync(
        'SELECT * FROM transactions WHERE id = ? AND client_id = ?',
        [req.params.sessionId, req.user.id],
      );

      if (!transaction) return res.status(404).json({ error: 'Transaccion no encontrada' });

      await runAsync(
        'UPDATE transactions SET status = ?, mp_status = COALESCE(mp_status, ?) WHERE id = ?',
        ['paid_retained', 'manual_confirmed', req.params.sessionId],
      );
      await insertSystemMessage(req.params.sessionId, 'Pago confirmado manualmente. El chat privado ya puede utilizarse.');

      res.json({ success: true, status: 'paid_retained' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/payments/release/:sessionId', verifyToken, async (req, res) => {
    try {
      const transaction = await getAsync(
        'SELECT * FROM transactions WHERE id = ? AND client_id = ?',
        [req.params.sessionId, req.user.id],
      );

      if (!transaction) return res.status(404).json({ error: 'Transaccion no encontrada' });

      await runAsync(
        'UPDATE transactions SET status = ?, released_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['released_manually', req.params.sessionId],
      );
      await insertSystemMessage(req.params.sessionId, 'Servicio marcado como finalizado. Se libero el pago al proveedor.');

      res.json({
        success: true,
        status: 'released_manually',
        provider_amount: transaction.provider_amount || transaction.amount,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/payments/refund/:sessionId', verifyToken, async (req, res) => {
    try {
      const transaction = await getAsync(
        'SELECT * FROM transactions WHERE id = ? AND client_id = ?',
        [req.params.sessionId, req.user.id],
      );

      if (!transaction) return res.status(404).json({ error: 'Transaccion no encontrada' });

      if (transaction.mp_payment_id) {
        await mercadoPagoRequest(`/v1/payments/${transaction.mp_payment_id}/refunds`, {
          method: 'POST',
          body: JSON.stringify({}),
        });
      }

      await runAsync(
        'UPDATE transactions SET status = ?, refunded_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['refunded', req.params.sessionId],
      );
      await insertSystemMessage(req.params.sessionId, 'Se registro un reembolso para esta contratacion.');

      res.json({ success: true, status: 'refunded' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/payments/dispute/:sessionId', verifyToken, async (req, res) => {
    try {
      await runAsync(
        'UPDATE transactions SET status = ?, disputed_at = CURRENT_TIMESTAMP WHERE id = ? AND (client_id = ? OR provider_id = ?)',
        ['disputed', req.params.sessionId, req.user.id, req.user.id],
      );
      await insertSystemMessage(req.params.sessionId, 'La contratacion fue marcada en disputa y requiere revision.');
      res.json({ success: true, status: 'disputed' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/payments/wallet', verifyToken, async (req, res) => {
    try {
      const earnings = await getAsync(
        'SELECT SUM(provider_amount) as earnings FROM transactions WHERE provider_id = ? AND status = ?',
        [req.user.id, 'released_manually'],
      );

      const transactions = await allAsync(
        'SELECT * FROM transactions WHERE client_id = ? OR provider_id = ? ORDER BY created_at DESC LIMIT 20',
        [req.user.id, req.user.id],
      );

      res.json({
        balance: earnings?.earnings || 0,
        transactions,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/payments/service-chats', verifyToken, async (req, res) => {
    try {
      const transactions = await allAsync(
        `SELECT
           t.*,
           client.name AS client_name,
           provider.name AS provider_account_name,
           last_message.text AS last_message_text,
           last_message.kind AS last_message_kind,
           last_message.created_at AS last_message_at
         FROM transactions t
         LEFT JOIN users client ON client.id = t.client_id
         LEFT JOIN users provider ON provider.id = t.provider_id
         LEFT JOIN messages last_message
           ON last_message.id = (
             SELECT m.id
             FROM messages m
             WHERE m.room_id = 'service_tx_' || t.id
             ORDER BY m.created_at DESC, m.id DESC
             LIMIT 1
           )
         WHERE (t.client_id = ? OR t.provider_id = ?)
           AND t.status IN ('paid_retained', 'accepted', 'in_progress', 'released_manually')
         ORDER BY COALESCE(last_message.created_at, t.created_at) DESC`,
        [req.user.id, req.user.id],
      );

      const chats = transactions.map((transaction) => {
        const isClient = Number(transaction.client_id) === Number(req.user.id);
        const counterpartName = isClient
          ? transaction.provider_account_name || transaction.provider_name || 'Proveedor'
          : transaction.client_name || 'Cliente';
        const serviceLabel = transaction.service_label || 'Servicio MateBudY';

        return {
          id: `service-${transaction.id}`,
          requestId: transaction.id,
          transactionId: transaction.id,
          providerId: transaction.provider_id,
          name: counterpartName,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(counterpartName)}`,
          lastMsg: transaction.last_message_text || `Chat habilitado para ${serviceLabel}`,
          time: transaction.last_message_at || transaction.created_at,
          hourlyRate: Number(transaction.hourly_rate || 0),
          service: serviceLabel,
          status: normalizeChatStatus(transaction.status),
          hours: Number(transaction.hours || 0),
          total: Number(transaction.amount || 0),
          externalReference: transaction.external_reference || '',
        };
      });

      res.json({ chats });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
};
