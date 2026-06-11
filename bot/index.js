// TRIUMPH Outreach Bot v2
// Local Telegram bot with buttons, inline keyboards, FREE Google Gemini AI

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';

if (!TOKEN) { console.error('❌ TELEGRAM_BOT_TOKEN не указан'); process.exit(1); }

const LEADS_FILE = path.join(__dirname, '..', 'outreach', 'leads.csv');
const STATS_FILE = path.join(__dirname, 'stats.json');

// ===== UTILS =====
function loadLeads() {
  if (!fs.existsSync(LEADS_FILE)) return [];
  const text = fs.readFileSync(LEADS_FILE, 'utf-8');
  const lines = text.split('\n').filter(l => l.trim());
  const headers = lines[0].replace(/"/g, '').split(',');
  return lines.slice(1).map((line, i) => {
    const values = line.match(/("([^"]|"")*"|[^,]+)/g) || [];
    const obj = { _id: i + 1 };
    headers.forEach((h, j) => {
      let v = (values[j] || '').replace(/^"|"$/g, '').replace(/""/g, '"');
      obj[h] = v;
    });
    return obj;
  });
}

function saveLeads(leads) {
  if (!leads.length) return;
  const headers = Object.keys(leads[0]).filter(k => k !== '_id');
  const lines = [headers.join(',')];
  leads.forEach(l => {
    lines.push(headers.map(h => `"${(l[h] || '').toString().replace(/"/g, '""')}"`).join(','));
  });
  fs.writeFileSync(LEADS_FILE, lines.join('\n'), 'utf-8');
}

function loadStats() {
  if (!fs.existsSync(STATS_FILE)) return { sent: 0, replied: 0, called: 0, startedAt: new Date().toISOString() };
  return JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
}

function saveStats(s) {
  fs.writeFileSync(STATS_FILE, JSON.stringify(s, null, 2));
}

function escapeMd(s) {
  if (!s) return '';
  return String(s).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

// Safe sender with fallback to plain text
async function sendSafe(bot, chatId, text, opts = {}) {
  try {
    return await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...opts });
  } catch (e) {
    if (e.message && e.message.includes("can't parse entities")) {
      const plain = String(text).replace(/[*_`\[\]()~>#+\-=|{}.!\\]/g, '');
      return await bot.sendMessage(chatId, plain, opts);
    }
    throw e;
  }
}

// ===== KEYBOARDS =====
const KB = {
  // Persistent menu (commands in Telegram side menu)
  persistent: {
    reply_markup: {
      keyboard: [
        [{ text: '📋 Лиды' }, { text: '🔍 Поиск' }],
        [{ text: '🤖 AI письмо' }, { text: '📞 Скрипт звонка' }],
        [{ text: '📊 Статистика' }, { text: '⚙️ Настройки' }],
        [{ text: '❓ Помощь' }]
      ],
      resize_keyboard: true,
      persistent: true
    }
  },

  // Main /start menu with buttons
  main: {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📋 Показать лиды', callback_data: 'leads' },
          { text: '🔍 Поиск', callback_data: 'search' }
        ],
        [
          { text: '📡 По каналам связи', callback_data: 'channels' }
        ],
        [
          { text: '🤖 AI-генератор', callback_data: 'gen' },
          { text: '📊 Дашборд', callback_data: 'dashboard' }
        ],
        [
          { text: '➕ Добавить лид', callback_data: 'add' },
          { text: '📥 Скачать базу', callback_data: 'csv' }
        ],
        [
          { text: '❓ Помощь', callback_data: 'help' }
        ]
      ]
    }
  },

  // Channels filter menu
  channels: {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🔵 Только ВКонтакте', callback_data: 'filter_vk' },
          { text: '✈️ Только Telegram', callback_data: 'filter_telegram' }
        ],
        [
          { text: '📷 Только Instagram', callback_data: 'filter_instagram' },
          { text: '💚 Только WhatsApp', callback_data: 'filter_whatsapp' }
        ],
        [
          { text: '▶️ Только YouTube', callback_data: 'filter_youtube' }
        ],
        [
          { text: '📞 С телефоном', callback_data: 'filter_phone' },
          { text: '✉️ С email', callback_data: 'filter_email' }
        ],
        [
          { text: '🌐 Со своим сайтом', callback_data: 'filter_website' }
        ],
        [
          { text: '📡 С любыми контактами', callback_data: 'filter_any' },
          { text: '❌ Без контактов', callback_data: 'filter_none' }
        ],
        [
          { text: '◀️ В меню', callback_data: 'main' }
        ]
      ]
    }
  },

  // Navigation for filtered leads
  filterNav(filter, page, totalPages) {
    const buttons = [];
    if (page > 1) buttons.push({ text: '◀️', callback_data: `${filter}_${page - 1}` });
    buttons.push({ text: `${page}/${totalPages}`, callback_data: 'noop' });
    if (page < totalPages) buttons.push({ text: '▶️', callback_data: `${filter}_${page + 1}` });
    return {
      reply_markup: {
        inline_keyboard: [
          buttons,
          [
            { text: '📡 Другой канал', callback_data: 'channels' },
            { text: '🏠 В меню', callback_data: 'main' }
          ]
        ]
      }
    };
  },

  // Back to main menu
  back: {
    reply_markup: {
      inline_keyboard: [
        [{ text: '◀️ В главное меню', callback_data: 'main' }]
      ]
    }
  },

  leadsNav(page, totalPages) {
    const buttons = [];
    if (page > 1) buttons.push({ text: '◀️ Назад', callback_data: `leads_${page - 1}` });
    buttons.push({ text: `${page}/${totalPages}`, callback_data: 'noop' });
    if (page < totalPages) buttons.push({ text: 'Вперёд ▶️', callback_data: `leads_${page + 1}` });
    return {
      reply_markup: {
        inline_keyboard: [buttons, [
          { text: '🔍 Поиск', callback_data: 'search' },
          { text: '➕ Добавить', callback_data: 'add' }
        ], [{ text: '◀️ В меню', callback_data: 'main' }]]
      }
    };
  },

  // Actions for a specific lead
  leadActions(id) {
    return {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🤖 AI письмо', callback_data: `gen_${id}` },
            { text: '📞 Скрипт', callback_data: `call_${id}` }
          ],
          [
            { text: '📡 Все контакты', callback_data: `contacts_${id}` },
            { text: '🔍 Найти в базе', callback_data: 'search' }
          ],
          [
            { text: '◀️ К лидам', callback_data: 'leads' },
            { text: '🏠 В меню', callback_data: 'main' }
          ]
        ]
      }
    };
  },

  // For AI-generated letter — copy & next
  aiActions(id) {
    return {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔄 Другой вариант', callback_data: `gen_${id}` }
          ],
          [
            { text: '📞 Скрипт звонка', callback_data: `call_${id}` },
            { text: '📡 Контакты', callback_data: `contacts_${id}` }
          ],
          [
            { text: '◀️ К лидам', callback_data: 'leads' },
            { text: '🏠 В меню', callback_data: 'main' }
          ]
        ]
      }
    };
  },

  // Cancel only
  cancel: {
    reply_markup: {
      inline_keyboard: [
        [{ text: '❌ Отмена', callback_data: 'main' }]
      ]
    }
  }
};

// ===== AI GENERATION =====
async function generateEmail(lead, userContext = '') {
  if (!GEMINI_KEY) {
    return '⚠️ GEMINI_API_KEY не задан. Получи бесплатно: https://aistudio.google.com/apikey\n\nПример для ' + lead.name + ':\n\nЗдравствуйте! Увидел ваш бизнес в 2ГИС. Сделаю сайт «под ключ» за 5-7 дней. Могу показать прототип бесплатно. Когда удобно созвониться?';
  }
  const prompt = `Ты — опытный копирайтер холодных писем для веб-разработки. Пишешь на русском, коротко (до 150 слов), по-человечески.

КОНТЕКСТ:
- Я веб-разработчик, делаю сайты «под ключ» с админ-панелью
- Пример: https://triumph37.ru (клуб единоборств)
- Цены: лендинг от 25 000 ₽, многостраничник от 80 000 ₽
- Срок: 5-7 дней / 2-4 недели
- Могу сделать прототип бесплатно

ЛИД:
- Название: ${lead.name}
- Категория: ${lead.category}
- Город: ${lead.city || 'Иваново'}
${lead.address ? `- Адрес: ${lead.address}` : ''}
${lead.priority ? `- Приоритет: ${lead.priority}` : ''}

ДОП. КОНТЕКСТ:
${userContext || '—'}

ЗАДАНИЕ: Напиши ОДНО холодное письмо:
1. Личное обращение
2. Конкретная выгода
3. Социальное доказательство (triumph37.ru)
4. Мягкий CTA
5. Подпись (Артур, @darkt30)

Только текст письма, без заголовка.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 800, topP: 0.9 },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
      ]
    })
  });

  const data = await res.json();
  if (data.error) throw new Error('Gemini: ' + data.error.message);
  if (!data.candidates || !data.candidates[0]) throw new Error('Пустой ответ');
  return data.candidates[0].content.parts[0].text.trim();
}

// ===== BOT =====
const bot = new TelegramBot(TOKEN, { polling: true });

// Persistent reply keyboard
bot.onText(/\/(start|help|меню)/, (msg) => {
  sendMainMenu(msg.chat.id);
});

async function sendMainMenu(chatId) {
  const leads = loadLeads();
  const stats = {
    vk: leads.filter(l => l.vk).length,
    tg: leads.filter(l => l.telegram).length,
    ig: leads.filter(l => l.instagram).length,
    wa: leads.filter(l => l.whatsapp).length,
    phone: leads.filter(l => l.phone).length
  };
  await sendSafe(bot, chatId, `🥊 *TRIUMPH Outreach Bot*

🤖 AI: Google Gemini (бесплатно)
📊 База: *${leads.length}* лидов

📡 Контакты: 🔵${stats.vk} ✈️${stats.tg} 📷${stats.ig} 💚${stats.wa} 📞${stats.phone}

*Выбери действие:*`, KB.main);
}

bot.onText(/\/menu/, (msg) => sendMainMenu(msg.chat.id));

// === CALLBACK QUERIES (кнопки) ===
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const msgId = query.message.message_id;

  // Acknowledge
  await bot.answerCallbackQuery(query.id);

  // Navigation
  if (data === 'main') {
    await bot.deleteMessage(chatId, msgId).catch(() => {});
    return sendMainMenu(chatId);
  }

  if (data === 'noop') return;

  if (data === 'help') {
    return sendHelp(chatId, msgId);
  }

  if (data === 'leads' || data.startsWith('leads_')) {
    const page = data === 'leads' ? 1 : parseInt(data.split('_')[1]);
    return showLeads(chatId, msgId, page);
  }

  if (data === 'search') {
    return askSearch(chatId, msgId);
  }

  if (data === 'gen') {
    return askGen(chatId, msgId);
  }

  if (data === 'dashboard') {
    return showDashboard(chatId, msgId);
  }

  if (data === 'add') {
    return askAdd(chatId, msgId);
  }

  if (data === 'csv') {
    return sendCsv(chatId);
  }

  if (data === 'channels') {
    return showChannels(chatId, msgId);
  }

  // Filters
  if (data.startsWith('filter_')) {
    const rest = data.slice(7); // e.g. "vk" or "vk_2"
    const [field, pageStr] = rest.split('_');
    return showFilteredLeads(chatId, msgId, field, pageStr ? parseInt(pageStr) : 1);
  }

  if (data.startsWith('lead_')) {
    const id = parseInt(data.split('_')[1]);
    return showLeadDetail(chatId, id, msgId);
  }

  if (data.startsWith('gen_')) {
    const id = parseInt(data.split('_')[1]);
    return generateForLead(chatId, id, msgId);
  }

  if (data.startsWith('call_')) {
    const id = parseInt(data.split('_')[1]);
    return callScript(chatId, id, msgId);
  }

  if (data.startsWith('contacts_')) {
    const id = parseInt(data.split('_')[1]);
    return showContacts(chatId, id, msgId);
  }
});

// === HANDLERS ===
async function sendHelp(chatId, msgId = null) {
  const text = `📚 *Команды бота*

*Основные:*
/start — главное меню
/leads — список лидов
/show N — карточка лида
/find запрос — поиск по базе
/has-contacts — статистика контактов

*Фильтры по каналам:*
📡 В меню → "По каналам связи"
🔵 ВКонтакте · ✈️ Telegram · 📷 Instagram
💚 WhatsApp · ▶️ YouTube
📞 Телефон · ✉️ Email · 🌐 Сайт
📡 С контактами · ❌ Без

*AI-генератор:*
/gen N — сгенерировать письмо
/gen N контекст — с доп. контекстом

*Контакты и звонки:*
/contacts N — все ссылки для связи
/call N — скрипт звонка

*Управление:*
/add — добавить лид
/del N — удалить
/leads.csv — скачать базу
/stats — статистика
/cancel — отмена

*Формат /add:*
\`Имя| Категория| Тел| Email| VK| Telegram| IG| WA\`

_Бот локальный, токен только у тебя_`;

  if (msgId) {
    await bot.editMessageText(text, {
      chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
      reply_markup: KB.back.reply_markup
    }).catch(() => sendSafe(bot, chatId, text, KB.back));
  } else {
    await sendSafe(bot, chatId, text, KB.back);
  }
}

async function showLeads(chatId, msgId, page = 1) {
  const leads = loadLeads();
  if (!leads.length) {
    return sendSafe(bot, chatId, '❌ В базе нет лидов. Добавь через /add или запусти парсер.', KB.back);
  }
  const perPage = 8;
  const start = (page - 1) * perPage;
  const items = leads.slice(start, start + perPage);
  const total = Math.ceil(leads.length / perPage);

  // Build compact lines
  const lines = items.map(l => {
    const prio = l.priority || '📋';
    const name = l.name.slice(0, 35);
    return `${prio} *#${l._id}* ${name}\n    _${escapeMd((l.category || '').slice(0, 30))}_`;
  });

  const text = `📋 *Лиды (стр. ${page}/${total}, всего ${leads.length})*\n\n${lines.join('\n\n')}`;

  if (msgId) {
    await bot.editMessageText(text, {
      chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
      reply_markup: KB.leadsNav(page, total).reply_markup
    }).catch(() => sendSafe(bot, chatId, text, KB.leadsNav(page, total)));
  } else {
    await sendSafe(bot, chatId, text, KB.leadsNav(page, total));
  }
}

async function showLeadDetail(chatId, id, msgId) {
  const leads = loadLeads();
  const lead = leads.find(l => l._id === id);
  if (!lead) return sendSafe(bot, chatId, '❌ Лид не найден', KB.back);

  const fields = Object.entries(lead)
    .filter(([k]) => k !== '_id')
    .filter(([_, v]) => v && v.trim())
    .map(([k, v]) => `*${k}*: ${escapeMd(String(v).slice(0, 100))}`);

  const text = `📇 *Лид #${id}*\n\n${fields.join('\n')}`;

  if (msgId) {
    await bot.editMessageText(text, {
      chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
      reply_markup: KB.leadActions(id).reply_markup
    }).catch(() => sendSafe(bot, chatId, text, KB.leadActions(id)));
  } else {
    await sendSafe(bot, chatId, text, KB.leadActions(id));
  }
}

async function askSearch(chatId, msgId) {
  const text = `🔍 *Поиск лидов*

Напиши запрос: название, категорию или адрес.

*Примеры:*
• "автосервис"
• "салон"
• "куконковых" (адрес)`;

  if (msgId) {
    await bot.editMessageText(text, {
      chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '◀️ В меню', callback_data: 'main' }]] }
    }).catch(() => sendSafe(bot, chatId, text, KB.back));
  } else {
    await sendSafe(bot, chatId, text, KB.back);
  }
  userStates.set(chatId, { action: 'search' });
}

async function askGen(chatId, msgId) {
  const text = `🤖 *AI-генератор писем*

Какой лид обработать? Введи его номер.

*Пример:*
• 5 — сгенерировать письмо для лида #5
• 5 акция на новый год — добавить контекст`;

  if (msgId) {
    await bot.editMessageText(text, {
      chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '◀️ В меню', callback_data: 'main' }]] }
    }).catch(() => sendSafe(bot, chatId, text, KB.back));
  } else {
    await sendSafe(bot, chatId, text, KB.back);
  }
  userStates.set(chatId, { action: 'gen' });
}

async function askAdd(chatId, msgId) {
  const text = `➕ *Добавить лид*

Формат: \`Имя|Категория|Телефон|Email|VK|Telegram|IG|WA\`

*Пример:*
\`Клуб Самурай|Спорт|+79991234567|info@samurai.ru|vk.com/samurai|t.me/samurai_iv|instagram.com/samurai.kudo|wa.me/79991234567\`

_Можно меньше полей — остальные пустые_`;

  if (msgId) {
    await bot.editMessageText(text, {
      chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '◀️ В меню', callback_data: 'main' }]] }
    }).catch(() => sendSafe(bot, chatId, text, KB.back));
  } else {
    await sendSafe(bot, chatId, text, KB.back);
  }
  userStates.set(chatId, { action: 'add' });
}

async function showChannels(chatId, msgId) {
  const leads = loadLeads();
  const stats = {
    vk: leads.filter(l => l.vk).length,
    tg: leads.filter(l => l.telegram).length,
    ig: leads.filter(l => l.instagram).length,
    wa: leads.filter(l => l.whatsapp).length,
    yt: leads.filter(l => l.youtube).length,
    phone: leads.filter(l => l.phone).length,
    email: leads.filter(l => l.email).length,
    website: leads.filter(l => l.website).length,
    any: leads.filter(l => l.phone || l.email || l.vk || l.telegram || l.instagram || l.whatsapp || l.youtube).length,
    none: leads.filter(l => !l.phone && !l.email && !l.vk && !l.telegram && !l.instagram && !l.whatsapp && !l.youtube).length
  };

  const text = `📡 *Фильтр по каналам связи*

🔵 ВКонтакте: *${stats.vk}*
✈️ Telegram: *${stats.tg}*
📷 Instagram: *${stats.ig}*
💚 WhatsApp: *${stats.wa}*
▶️ YouTube: *${stats.yt}*
📞 С телефоном: *${stats.phone}*
✉️ С email: *${stats.email}*
🌐 Со своим сайтом: *${stats.website}*

📡 С любыми контактами: *${stats.any}*
❌ Без контактов: *${stats.none}*

_👇 Нажми кнопку чтобы увидеть лиды_`;

  if (msgId) {
    await bot.editMessageText(text, {
      chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
      reply_markup: KB.channels.reply_markup
    }).catch(() => sendSafe(bot, chatId, text, KB.channels));
  } else {
    await sendSafe(bot, chatId, text, KB.channels);
  }
}

async function showFilteredLeads(chatId, msgId, field, page = 1) {
  const leads = loadLeads();
  let filtered = [];
  let title = '';
  let emptyMsg = '';

  switch (field) {
    case 'vk':
      filtered = leads.filter(l => l.vk);
      title = '🔵 Только с ВКонтакте';
      emptyMsg = '❌ Нет лидов с ВК';
      break;
    case 'telegram':
      filtered = leads.filter(l => l.telegram);
      title = '✈️ Только с Telegram';
      emptyMsg = '❌ Нет лидов с Telegram';
      break;
    case 'instagram':
      filtered = leads.filter(l => l.instagram);
      title = '📷 Только с Instagram';
      emptyMsg = '❌ Нет лидов с Instagram';
      break;
    case 'whatsapp':
      filtered = leads.filter(l => l.whatsapp);
      title = '💚 Только с WhatsApp';
      emptyMsg = '❌ Нет лидов с WhatsApp';
      break;
    case 'youtube':
      filtered = leads.filter(l => l.youtube);
      title = '▶️ Только с YouTube';
      emptyMsg = '❌ Нет лидов с YouTube';
      break;
    case 'phone':
      filtered = leads.filter(l => l.phone);
      title = '📞 С телефоном';
      emptyMsg = '❌ Нет лидов с телефоном';
      break;
    case 'email':
      filtered = leads.filter(l => l.email);
      title = '✉️ С email';
      emptyMsg = '❌ Нет лидов с email';
      break;
    case 'website':
      filtered = leads.filter(l => l.website);
      title = '🌐 Со своим сайтом';
      emptyMsg = '❌ Нет лидов с сайтом';
      break;
    case 'any':
      filtered = leads.filter(l => l.phone || l.email || l.vk || l.telegram || l.instagram || l.whatsapp || l.youtube);
      title = '📡 С любыми контактами';
      emptyMsg = '❌ Нет лидов с контактами';
      break;
    case 'none':
      filtered = leads.filter(l => !l.phone && !l.email && !l.vk && !l.telegram && !l.instagram && !l.whatsapp && !l.youtube);
      title = '❌ Без контактов';
      emptyMsg = '✅ Все лиды имеют контакты!';
      break;
    default:
      return showChannels(chatId, msgId);
  }

  if (!filtered.length) {
    const kb = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📡 Другой фильтр', callback_data: 'channels' }],
          [{ text: '🏠 В меню', callback_data: 'main' }]
        ]
      }
    };
    if (msgId) {
      try {
        return await bot.editMessageText(`${emptyMsg}\n\n*${title}*`, {
          chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
          reply_markup: kb.reply_markup
        });
      } catch (e) {}
    }
    return sendSafe(bot, chatId, `${emptyMsg}\n\n*${title}*`, kb);
  }

  const perPage = 8;
  const start = (page - 1) * perPage;
  const items = filtered.slice(start, start + perPage);
  const total = Math.ceil(filtered.length / perPage);

  // Build lines — different content based on filter
  const lines = items.map(l => {
    const prio = l.priority || '📋';
    const name = l.name.slice(0, 30);
    let contact = '';
    if (field === 'vk' && l.vk) contact = l.vk;
    else if (field === 'telegram' && l.telegram) contact = l.telegram;
    else if (field === 'instagram' && l.instagram) contact = l.instagram;
    else if (field === 'whatsapp' && l.whatsapp) contact = l.whatsapp;
    else if (field === 'youtube' && l.youtube) contact = l.youtube;
    else if (field === 'phone' && l.phone) contact = l.phone;
    else if (field === 'email' && l.email) contact = l.email;
    else if (field === 'website' && l.website) contact = l.website;
    else {
      // For 'any' or 'none' — show first available contact
      contact = l.phone || l.email || l.vk || l.telegram || l.instagram || l.whatsapp || l.youtube || '—';
    }
    return `${prio} *#${l._id}* ${escapeMd(name)}\n    _${escapeMd(String(contact).slice(0, 35))}_`;
  });

  const text = `${title} (стр. ${page}/${total}, найдено: ${filtered.length})\n\n${lines.join('\n\n')}`;

  if (msgId) {
    try {
      return await bot.editMessageText(text, {
        chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
        reply_markup: KB.filterNav(`filter_${field}`, page, total).reply_markup
      });
    } catch (e) {}
  }
  return sendSafe(bot, chatId, text, KB.filterNav(`filter_${field}`, page, total));
}

async function showDashboard(chatId, msgId) {
  const leads = loadLeads();
  const stats = loadStats();
  const withContacts = leads.filter(l => l.phone || l.email || l.vk || l.telegram || l.instagram || l.whatsapp);
  const byPriority = { '🔥 A': 0, '⭐ B': 0, '📋 C': 0 };
  leads.forEach(l => { if (byPriority[l.priority] !== undefined) byPriority[l.priority]++; });
  const byCategory = {};
  leads.forEach(l => { const c = l.category || 'Прочее'; byCategory[c] = (byCategory[c] || 0) + 1; });
  const topCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const today = new Date().toISOString().slice(0, 10);
  const daysActive = Math.floor((Date.now() - new Date(stats.startedAt).getTime()) / 86400000);

  const text = `📊 *Дашборд*

*📋 Лиды:* ${leads.length}
*📡 С контактами:* ${withContacts.length} (${Math.round(withContacts.length / Math.max(leads.length, 1) * 100)}%)

*По приоритетам:*
🔥 A — ${byPriority['🔥 A']} (горячие)
⭐ B — ${byPriority['⭐ B']} (тёплые)
📋 C — ${byPriority['📋 C']} (холодные)

*Топ категорий:*
${topCats.map(([c, n]) => `• ${escapeMd(c)}: ${n}`).join('\n') || '_нет данных_'}

*Активность:*
📨 Отправлено: ${stats.sent}
💬 Ответов: ${stats.replied}
📞 Звонков: ${stats.called || 0}
📅 Дней активности: ${daysActive}`;

  if (msgId) {
    await bot.editMessageText(text, {
      chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
      reply_markup: KB.back.reply_markup
    }).catch(() => sendSafe(bot, chatId, text, KB.back));
  } else {
    await sendSafe(bot, chatId, text, KB.back);
  }
}

async function sendCsv(chatId) {
  if (!fs.existsSync(LEADS_FILE)) return sendSafe(bot, chatId, '❌ Файл не найден', KB.back);
  await bot.sendDocument(chatId, LEADS_FILE, {}, { reply_markup: KB.back.reply_markup });
}

async function showContacts(chatId, id, msgId) {
  const lead = loadLeads().find(l => l._id === id);
  if (!lead) return sendSafe(bot, chatId, '❌ Лид не найден', KB.back);

  const links = [];
  if (lead.phone) links.push(`📞 Телефон: ${lead.phone}`);
  if (lead.email) links.push(`✉️ Email: ${lead.email}`);
  if (lead.website) links.push(`🌐 Сайт: ${lead.website}`);
  if (lead.vk) links.push(`🔵 ВКонтакте: https://${lead.vk}`);
  if (lead.telegram) links.push(`✈️ Telegram: https://${lead.telegram}`);
  if (lead.instagram) links.push(`📷 Instagram: https://${lead.instagram}`);
  if (lead.whatsapp) links.push(`💚 WhatsApp: https://${lead.whatsapp}`);
  if (lead.youtube) links.push(`▶️ YouTube: https://${lead.youtube}`);

  if (!links.length) return sendSafe(bot, chatId, `У лида #${id} нет контактов`, KB.leadActions(id));

  const text = `📡 *Контакты #${id} — ${escapeMd(lead.name)}*\n\n${links.join('\n')}\n\n_👆 Кликни ссылки — откроются_`;

  if (msgId) {
    await bot.editMessageText(text, {
      chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
      reply_markup: KB.leadActions(id).reply_markup
    }).catch(() => sendSafe(bot, chatId, text, KB.leadActions(id)));
  } else {
    await sendSafe(bot, chatId, text, KB.leadActions(id));
  }
}

async function callScript(chatId, id, msgId) {
  const lead = loadLeads().find(l => l._id === id);
  if (!lead) return sendSafe(bot, chatId, '❌ Лид не найден', KB.back);

  const text = `📞 *Скрипт звонка для #${id} — ${escapeMd(lead.name)}*

*1️⃣ Открытие (5 сек):*
"Здравствуйте! Меня зовут Артур, я веб-разработчик. Видел ваш ${escapeMd(lead.category || 'бизнес')} в 2ГИС. Удобно сейчас 2 минуты поговорить?"

→ "Нет": "Когда лучше перезвонить?"

*2️⃣ Квалификация (30 сек):*
"Сайт сейчас есть? Как клиенты находят? Главная проблема — мало заявок?"

*3️⃣ Предложение (30 сек):*
"Недавно сделал сайт клубу единоборств — triumph37.ru. У них +12 заявок/мес из поиска. Могу показать прототип бесплатно за 1 день."

*4️⃣ Закрытие:*
"Скиньте мне в WhatsApp контакт — пришлю примеры. Договорились?"

*📋 Контакты для follow-up:*
${lead.phone ? `📞 ${lead.phone}` : ''}
${lead.email ? `✉️ ${lead.email}` : ''}
${lead.telegram ? `✈️ ${lead.telegram}` : ''}
${lead.vk ? `🔵 ${lead.vk}` : ''}
${lead.whatsapp ? `💚 ${lead.whatsapp}` : ''}`;

  if (msgId) {
    await bot.editMessageText(text, {
      chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
      reply_markup: KB.leadActions(id).reply_markup
    }).catch(() => sendSafe(bot, chatId, text, KB.leadActions(id)));
  } else {
    await sendSafe(bot, chatId, text, KB.leadActions(id));
  }
}

async function generateForLead(chatId, id, msgId) {
  const lead = loadLeads().find(l => l._id === id);
  if (!lead) return sendSafe(bot, chatId, '❌ Лид не найден', KB.back);

  // Show loading
  if (msgId) {
    try { await bot.editMessageText(`⏳ Генерирую письмо для #${id} (${escapeMd(lead.name)})...`, {
      chat_id: chatId, message_id: msgId, parse_mode: 'Markdown' });
    } catch (e) {}
  } else {
    await sendSafe(bot, chatId, `⏳ Генерирую письмо для #${id} (${escapeMd(lead.name)})...`);
  }

  try {
    const aiText = await generateEmail(lead);
    const text = `✉️ *Письмо для #${id} — ${escapeMd(lead.name)}*\n\n${aiText}\n\n_Скопируй и отправь через почту/WhatsApp_`;

    // Send as new message (with buttons), keep old "loading" message
    await sendSafe(bot, chatId, text, KB.aiActions(id));
    if (msgId) {
      try { await bot.deleteMessage(chatId, msgId); } catch (e) {}
    }

    // Update stats
    const s = loadStats();
    s.sent = (s.sent || 0) + 1;
    saveStats(s);
  } catch (e) {
    await sendSafe(bot, chatId, '❌ Ошибка: ' + e.message, KB.back);
  }
}

// ===== USER STATE (for text-based flows) =====
const userStates = new Map();

bot.on('message', async (msg) => {
  if (!msg.text) return;
  const text = msg.text.trim();
  const chatId = msg.chat.id;

  // Cancel
  if (text === '/cancel' || text === 'отмена' || text === 'Отмена') {
    userStates.delete(chatId);
    return sendSafe(bot, chatId, '❌ Отменено', KB.main);
  }

  const state = userStates.get(chatId);

  // Search state
  if (state && state.action === 'search') {
    userStates.delete(chatId);
    const leads = loadLeads();
    const q = text.toLowerCase();
    const found = leads.filter(l =>
      (l.name || '').toLowerCase().includes(q) ||
      (l.category || '').toLowerCase().includes(q) ||
      (l.address || '').toLowerCase().includes(q)
    );
    if (!found.length) return sendSafe(bot, chatId, `❌ По "${text}" ничего не найдено`, KB.main);
    const lines = found.slice(0, 20).map(l =>
      `*#${l._id}* [${l.priority || '📋'}] ${escapeMd(l.name)} — ${escapeMd(l.category || '')}`
    );
    return sendSafe(bot, chatId, `🔍 *Найдено: ${found.length}*\n\n${lines.join('\n')}`, KB.main);
  }

  // AI gen state
  if (state && state.action === 'gen') {
    userStates.delete(chatId);
    const match = text.match(/^(\d+)(?:\s+(.+))?$/);
    if (!match) return sendSafe(bot, chatId, '❌ Формат: <номер> [контекст]\nПример: 5', KB.main);
    return generateForLead(chatId, parseInt(match[1]), null, match[2]);
  }

  // Add state
  if (state && state.action === 'add') {
    userStates.delete(chatId);
    return addLead(chatId, text);
  }

  // === TEXT COMMANDS (без кнопок) ===
  // Persistent keyboard buttons (text)
  if (text === '📋 Лиды') return showLeads(chatId, null, 1);
  if (text === '🔍 Поиск') return askSearch(chatId, null);
  if (text === '🤖 AI письмо') return askGen(chatId, null);
  if (text === '📞 Скрипт звонка') return askCallNum(chatId);
  if (text === '📊 Статистика') return showDashboard(chatId, null);
  if (text === '⚙️ Настройки') return showSettings(chatId);
  if (text === '❓ Помощь') return sendHelp(chatId, null);

  // Show lead by /show N
  const showMatch = text.match(/^\/show\s+(\d+)$/);
  if (showMatch) return showLeadDetail(chatId, parseInt(showMatch[1]), null);

  // Gen
  const genMatch = text.match(/^\/gen\s+(\d+)(?:\s+(.+))?$/);
  if (genMatch) return generateForLead(chatId, parseInt(genMatch[1]), null, genMatch[2]);

  // Call
  const callMatch = text.match(/^\/call\s+(\d+)$/);
  if (callMatch) return callScript(chatId, parseInt(callMatch[1]), null);

  // Contacts
  const contactsMatch = text.match(/^\/contacts\s+(\d+)$/);
  if (contactsMatch) return showContacts(chatId, parseInt(contactsMatch[1]), null);

  // Delete
  const delMatch = text.match(/^\/del\s+(\d+)$/);
  if (delMatch) return deleteLead(chatId, parseInt(delMatch[1]));

  // CSV
  if (text === '/leads.csv' || text === '/csv') return sendCsv(chatId);

  // Stats
  if (text === '/stats') return showDashboard(chatId, null);

  // Find (text after /find)
  const findMatch = text.match(/^\/find\s+(.+)$/);
  if (findMatch) {
    userStates.set(chatId, { action: 'search' });
    const leads = loadLeads();
    const q = findMatch[1].toLowerCase();
    const found = leads.filter(l =>
      (l.name || '').toLowerCase().includes(q) ||
      (l.category || '').toLowerCase().includes(q) ||
      (l.address || '').toLowerCase().includes(q)
    );
    if (!found.length) return sendSafe(bot, chatId, `❌ По "${findMatch[1]}" ничего не найдено`, KB.main);
    const lines = found.slice(0, 20).map(l =>
      `*#${l._id}* [${l.priority || '📋'}] ${escapeMd(l.name)} — ${escapeMd(l.category || '')}`
    );
    return sendSafe(bot, chatId, `🔍 *Найдено: ${found.length}*\n\n${lines.join('\n')}`, KB.main);
  }

  // Has contacts
  if (text === '/has-contacts') {
    const leads = loadLeads();
    const withAny = leads.filter(l => l.phone || l.email || l.vk || l.telegram || l.instagram || l.whatsapp);
    return sendSafe(bot, chatId, `📡 Из ${leads.length} лидов контакты есть у *${withAny.length}*`, KB.back);
  }

  // Cancel
  if (text === 'cancel' || text === '/cancel') {
    userStates.delete(chatId);
    return sendSafe(bot, chatId, '❌ Отменено', KB.main);
  }

  // Unknown text — show main menu
  if (!text.startsWith('/')) {
    return sendMainMenu(chatId);
  }
});

async function askCallNum(chatId) {
  await sendSafe(bot, chatId, '📞 *Скрипт звонка*\n\nВведи номер лида: `5`', KB.back);
  userStates.set(chatId, { action: 'call' });
}

async function showSettings(chatId) {
  const aiStatus = GEMINI_KEY ? '✅ Подключён' : '❌ Не задан';
  const text = `⚙️ *Настройки*

🤖 AI: ${aiStatus}
🎤 Модель: ${GEMINI_MODEL}
📊 Лидов в базе: ${loadLeads().length}

_Для смены настроек отредактируй \`.env\` и перезапусти бота_

*Файл:* \`/Users/artem/triumph 2026/bot/.env\``;

  await sendSafe(bot, chatId, text, KB.back);
}

async function addLead(chatId, payload) {
  const [name, category, phone, email, vk, telegram, instagram, whatsapp] = payload.split('|').map(s => s.trim());
  if (!name) return sendSafe(bot, chatId, '❌ Имя обязательно', KB.main);

  const leads = loadLeads();
  const newLead = {
    _id: leads.length ? Math.max(...leads.map(l => l._id)) + 1 : 1,
    priority: '📋 C',
    category: category || 'Новая',
    name, phone: phone || '', email: email || '',
    website: '', address: '', hours: '', lat: '', lon: '', osm_id: '-',
    vk: vk || '', telegram: telegram || '', instagram: instagram || '',
    whatsapp: whatsapp || '', youtube: ''
  };
  leads.push(newLead);
  saveLeads(leads);
  const contacts = [phone, email, vk, telegram, instagram, whatsapp].filter(Boolean).length;
  return sendSafe(bot, chatId,
    `✅ *Добавлен лид #${newLead._id}:* ${escapeMd(name)}\n📡 Контактов: ${contacts}`,
    { reply_markup: { inline_keyboard: [
      [{ text: '📇 Открыть карточку', callback_data: `lead_${newLead._id}` }],
      [{ text: '◀️ В меню', callback_data: 'main' }]
    ]}}
  );
}

async function deleteLead(chatId, id) {
  let leads = loadLeads();
  const before = leads.length;
  leads = leads.filter(l => l._id !== id);
  if (leads.length === before) return sendSafe(bot, chatId, '❌ Не найден', KB.back);
  saveLeads(leads);
  return sendSafe(bot, chatId, `🗑 Удалён лид #${id}`, KB.main);
}

bot.on('polling_error', (e) => console.error('Polling error:', e.message));

console.log('\n🥊 TRIUMPH Outreach Bot v2 запущен!');
console.log(`   AI: ${GEMINI_KEY ? '✓ ' + GEMINI_MODEL + ' (Google Gemini)' : '✗ OFF (добавь GEMINI_API_KEY)'}`);
console.log(`\n   Открой своего бота в Telegram и напиши /start\n`);

process.on('SIGINT', () => { console.log('\n\n👋 Бот остановлен'); process.exit(0); });
