// Contact form email sender
// Использует Gmail SMTP (или любой другой) для отправки заявок с лендинга

const nodemailer = require('nodemailer');

// Заглушка если SMTP не настроен (режим разработки)
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'artem.kurskiy.04@inbox.ru';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass }
  });

  return transporter;
}

async function sendContactEmail(data) {
  const t = getTransporter();

  const subject = `🚀 Новая заявка с сайта: ${data.name || 'Без имени'}`;
  const text = `
Новая заявка с лендинга darkt30
============================

👤 Имя: ${data.name || '—'}
📞 Телефон: ${data.phone || '—'}
✉️ Email: ${data.email || '—'}
💬 Сообщение: ${data.message || '—'}
📌 Услуга: ${data.service || '—'}
💰 Бюджет: ${data.budget || '—'}

🕐 Дата: ${new Date().toISOString()}
🌐 IP: ${data.ip || '—'}
🖥 User-Agent: ${data.userAgent || '—'}

============================
Автоматически сгенерировано.
  `.trim();

  const html = `
<div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0f; color: #fff; padding: 30px; border-radius: 12px;">
  <h2 style="color: #ff0033; margin: 0 0 20px; font-size: 1.4rem;">🚀 Новая заявка</h2>

  <table style="width: 100%; border-collapse: collapse;">
    <tr><td style="padding: 8px 0; color: #888; width: 140px;">👤 Имя:</td><td style="padding: 8px 0; color: #fff; font-weight: 600;">${data.name || '—'}</td></tr>
    <tr><td style="padding: 8px 0; color: #888;">📞 Телефон:</td><td style="padding: 8px 0; color: #fff; font-weight: 600;">${data.phone || '—'}</td></tr>
    <tr><td style="padding: 8px 0; color: #888;">✉️ Email:</td><td style="padding: 8px 0; color: #fff; font-weight: 600;">${data.email || '—'}</td></tr>
    <tr><td style="padding: 8px 0; color: #888;">💬 Сообщение:</td><td style="padding: 8px 0; color: #fff;">${data.message || '—'}</td></tr>
    <tr><td style="padding: 8px 0; color: #888;">📌 Услуга:</td><td style="padding: 8px 0; color: #ff0033; font-weight: 600;">${data.service || '—'}</td></tr>
    <tr><td style="padding: 8px 0; color: #888;">💰 Бюджет:</td><td style="padding: 8px 0; color: #ff0033; font-weight: 600;">${data.budget || '—'}</td></tr>
  </table>

  <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 20px 0;">

  <p style="color: #888; font-size: 0.85rem; margin: 0;">
    🕐 ${new Date().toLocaleString('ru-RU')}<br>
    🌐 IP: ${data.ip || '—'}
  </p>
</div>
  `.trim();

  if (t) {
    // Real sending
    await t.sendMail({
      from: `"DARKT30 Landing" <${process.env.SMTP_USER}>`,
      to: NOTIFY_EMAIL,
      replyTo: data.email || undefined,
      subject,
      text,
      html
    });
    return { ok: true, method: 'email', to: NOTIFY_EMAIL };
  }

  // Development mode — just log
  console.log('📧 [DEV] Contact form (would send to', NOTIFY_EMAIL + '):');
  console.log(text);
  return { ok: true, method: 'log', to: NOTIFY_EMAIL };
}

module.exports = { sendContactEmail, NOTIFY_EMAIL };
