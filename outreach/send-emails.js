// TRIUMPH Outreach — Email Sender
// Sends personalized emails from leads.csv via SMTP (Gmail recommended)
// Run: node send-emails.js
// Set ENV vars before running:
//   SMTP_USER=your@gmail.com
//   SMTP_PASS=app-password
//   FROM_NAME="Твоё Имя"

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const LEADS_FILE = path.join(__dirname, 'leads.csv');
const TEMPLATE_FILE = path.join(__dirname, 'templates.md');

const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_NAME = process.env.FROM_NAME || 'Веб-разработчик';

if (!SMTP_USER || !SMTP_PASS) {
  console.error('\n❌ Нужны SMTP_USER и SMTP_PASS в переменных среды');
  console.log('\nДля Gmail:');
  console.log('  1. Включи 2FA: https://myaccount.google.com/security');
  console.log('  2. Создай App Password: https://myaccount.google.com/apppasswords');
  console.log('  3. export SMTP_USER=you@gmail.com SMTP_PASS=xxxx-xxxx-xxxx');
  console.log('  4. export FROM_NAME="Иван Иванов"');
  process.exit(1);
}

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const headers = lines[0].replace(/"/g, '').split(',');
  return lines.slice(1).map(line => {
    const values = line.match(/("([^"]|"")*"|[^,]+)/g) || [];
    const obj = {};
    headers.forEach((h, i) => {
      let v = (values[i] || '').replace(/^"|"$/g, '').replace(/""/g, '"');
      obj[h] = v;
    });
    return obj;
  });
}

function template(type, lead) {
  return {
    subject: `Сайт для ${lead.name} — как получить +30% клиентов из интернета`,
    body: `Здравствуйте!

Меня зовут ${FROM_NAME}, я веб-разработчик из Иванова.

Нашёл ${lead.name} в 2ГИС — увидел, что нет своего сайта. 
Решил написать, потому что это упущенная выгода.

Вот что я имею в виду:
• 9 из 10 человек ищут услуги вроде ваших в интернете
• У конкурентов с сайтом клиенты оставляют заявки 24/7
• У вас клиенты просто проходят мимо

Я делаю современные сайты «под ключ»:
✓ Дизайн в вашем стиле
✓ Адаптив под телефон
✓ Админ-панель (сами меняете цены, фото, тексты)
✓ Форма записи + Telegram-бот

Сроки: 5–7 дней для лендинга, 2–4 недели для многостраничника.
Цена: от 25 000 ₽ за лендинг, от 80 000 ₽ за полноценный сайт.

Вот пример — клуб единоборств «ТРИУМФ» (тоже Иваново): 
https://triumph37.ru

Могу сделать бесплатный прототип вашего сайта за 1 день — 
просто чтобы посмотреть, как это выглядит.

Когда удобно созвониться на 5 минут?

С уважением,
${FROM_NAME}`
  }[type];
}

async function main() {
  console.log('\n📧 Загружаю лидов...');
  const csv = fs.readFileSync(LEADS_FILE, 'utf-8');
  const leads = parseCSV(csv);
  console.log(`   Найдено: ${leads.length}`);

  const withEmail = leads.filter(l => l.email);
  console.log(`   С email: ${withEmail.length}`);

  if (!withEmail.length) {
    console.log('\n💡 В leads.csv нет email-ов. Это нормально — используй WhatsApp/Telegram из templates.md');
    process.exit(0);
  }

  const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });

  console.log(`\n📤 Отправляю ${withEmail.length} писем...\n`);
  let sent = 0, failed = 0;

  for (const lead of withEmail) {
    const t = template('cold', lead);
    try {
      await transport.sendMail({
        from: `"${FROM_NAME}" <${SMTP_USER}>`,
        to: lead.email,
        subject: t.subject,
        text: t.body
      });
      console.log(`   ✓ ${lead.name} <${lead.email}>`);
      sent++;
      // Rate limit
      await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
    } catch (e) {
      console.log(`   ✗ ${lead.email} — ${e.message}`);
      failed++;
    }
  }

  console.log(`\n✅ Отправлено: ${sent} · Ошибок: ${failed}`);
  console.log('\n💡 Через 3 дня запусти follow-up (отдельный скрипт)');
}

main().catch(e => { console.error(e); process.exit(1); });
