# 🥊 ТРИУМФ — Клуб единоборств (Иваново)

Многостраничный сайт клуба единоборств **«ТРИУМФ»** (г. Иваново) + инструменты для поиска клиентов на разработку сайтов.

## 📂 Структура проекта

```
triumph 2026/
├── public/                  # Сайт клуба (фронтенд)
│   ├── index.html           # Главная
│   ├── pages/               # Внутренние страницы
│   ├── css/style.css        # Стили
│   └── js/
│       ├── main.js
│       └── site-data.v3.js  # Гидратор данных из API
│
├── admin/                   # Админ-панель клуба (SPA)
│   ├── index.html
│   ├── css/admin.css
│   └── js/admin.js
│
├── server/                  # Backend (Node.js + Express)
│   ├── index.js
│   ├── store.js
│   └── data/content.json
│
├── bot/                     # 🤖 Локальный Telegram-бот для outreach
│   ├── index.js
│   ├── start.sh
│   ├── .env.example
│   └── README.md
│
├── outreach/                # 📊 Инструменты поиска клиентов
│   ├── leads.csv            # 30 готовых лидов
│   ├── generate-leads.js    # Парсер OpenStreetMap
│   ├── find-socials.js      # Парсер 2ГИС (соцсети)
│   ├── send-emails.js       # Email-рассылка
│   ├── templates.md
│   └── README.md
│
├── collage/                 # 🎨 Портфолио-материалы
│   ├── index.html           # HTML-коллаж
│   ├── video.html / video2.html
│   ├── ad.html
│   ├── screenshot.js
│   ├── video-recorder.js
│   └── screenshots/         # PNG/MP4
│
├── voiceover/               # Озвучка от ElevenLabs
│
├── package.json
└── README.md
```

## 🚀 Запуск

### Сайт + админка
```bash
cd "/Users/artem/triumph 2026"
npm install
npm start
# → http://localhost:3000
# → http://localhost:3000/admin (admin / triumph2026)
```

### Telegram-бот для outreach
```bash
cd "/Users/artem/triumph 2026/bot"
./start.sh
```

### Генерация промо-материалов
```bash
cd "/Users/artem/triumph 2026/collage"
node screenshot.js
node video-recorder.js
```

## 📋 Что внутри

| Компонент | Технологии | Описание |
|---|---|---|
| **Сайт** | HTML/CSS/JS, parallax, glassmorphism | 9 страниц, адаптивный |
| **Админка** | Vanilla JS SPA | Управление контентом, медиа, текстами |
| **Backend** | Node.js + Express | REST API, multer для медиа |
| **Хранилище** | JSON | Контент, лиды, расписание |
| **Telegram-бот** | node-telegram-bot-api + Gemini | Локальный outreach с AI |
| **Outreach** | OSM + 2ГИС | Парсеры лидов + email-рассылка |
| **Коллаж** | Playwright + ffmpeg | Портфолио (скриншоты + видео) |

## 🎯 Использование

- **Сайт клуба** — готовый сайт (ТРИУМФ)
- **Админка** — управление сайтом без кода
- **Бот + outreach** — поиск клиентов на разработку сайтов
- **Коллаж** — портфолио-материалы

---

Разработчик: AI · Версия 1.0 · Июнь 2026
