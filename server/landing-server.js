// DARKT30 Landing — Server
// Standalone Express для лендинга: отдаёт статику + обрабатывает форму
// Запускается отдельно на порту 4000 (или PORT)

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const { sendContactEmail, NOTIFY_EMAIL } = require('./contact/mailer');
const { addLead } = require('./contact/storage');

const PORT = process.env.PORT || 4000;
const LANDING_DIR = path.join(__dirname, '..', 'landing');
const NOTIFY = process.env.NOTIFY_EMAIL || NOTIFY_EMAIL;

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Static landing
app.use(express.static(LANDING_DIR));

// SEO files
app.get('/sitemap.xml', (req, res) => {
  const base = process.env.SITE_URL || `http://localhost:${PORT}`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${base}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;
  res.set('Content-Type', 'application/xml');
  res.send(xml);
});

app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *\nAllow: /\nSitemap: ${process.env.SITE_URL || 'http://localhost:' + PORT}/sitemap.xml\n`);
});

// Contact form endpoint
app.post('/api/contact', async (req, res) => {
  try {
    const data = req.body || {};
    data.ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    data.userAgent = req.headers['user-agent']?.slice(0, 200);

    // Basic validation
    if (!data.name || (!data.phone && !data.email && !data.message)) {
      return res.status(400).json({ ok: false, error: 'Укажите имя и хотя бы телефон/email/сообщение' });
    }

    // Save to file
    const lead = addLead(data);

    // Send email
    const result = await sendContactEmail(data);

    console.log(`[${new Date().toISOString()}] New lead #${lead.id}: ${data.name} (${data.phone || data.email})`);

    res.json({ ok: true, id: lead.id, ...result });
  } catch (e) {
    console.error('Contact form error:', e);
    res.status(500).json({ ok: false, error: 'Ошибка отправки. Попробуйте позже.' });
  }
});

// Stats endpoint (for analytics)
app.post('/api/track', (req, res) => {
  // Lightweight tracking
  res.json({ ok: true });
});

// Health
app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(LANDING_DIR, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🥊 DARKT30 Landing Server`);
  console.log(`   → http://localhost:${PORT}`);
  console.log(`   → Notify: ${NOTIFY}`);
  console.log(`   → SMTP: ${process.env.SMTP_HOST ? '✓ ' + process.env.SMTP_HOST : '✗ OFF (dev mode)'}\n`);
});
