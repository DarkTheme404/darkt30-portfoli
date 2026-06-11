# 🥊 DARKT30 — Portfolio Landing

**Современный cyberpunk-лендинг** Артёма Курского — web-разработчик из Иванова.

## 📂 Структура

```
landing/
├── index.html          ← Главная страница (HTML)
├── style.css           ← Стили (cyberpunk/awwwards)
├── script.js           ← JS: particles, glitch, scroll, 3D cube
└── README.md           ← Этот файл

server/
├── landing-server.js    ← Express-сервер (порт 4000)
├── contact/
│   ├── mailer.js       ← Отправка email
│   ├── storage.js       ← Логирование в JSON
│   └── leads.json       ← Все заявки (создаётся автоматически)
```

## 🚀 Запуск

### Development
```bash
cd "/Users/artem/triumph 2026"
npm install express nodemailer dotenv
node server/landing-server.js
# → http://localhost:4000
```

Без SMTP заявки сохраняются в `server/contact/leads.json` и логируются в консоль.

### Production
```bash
NOTIFY_EMAIL=artem.kurskiy.04@inbox.ru \
SMTP_HOST=smtp.yandex.ru \
SMTP_USER=artem.kurskiy.04@yandex.ru \
SMTP_PASS=your-password \
PORT=80 \
node server/landing-server.js
```

## 📧 Настройка SMTP

### Yandex (рекомендую для inbox.ru/yandex.ru)
```
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=artem.kurskiy.04@yandex.ru
SMTP_PASS=пароль_приложения
```

Чтобы создать пароль приложения Yandex: [id.yandex.ru/security/app-passwords](https://id.yandex.ru/security/app-passwords)

### Gmail
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your@gmail.com
SMTP_PASS=app-password
```

Пароль приложения Gmail: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)

## 📊 Google Analytics

1. Создай GA4 property: [analytics.google.com](https://analytics.google.com)
2. Скопируй ID (формат `G-XXXXXXXXXX`)
3. В `index.html` замени строку:
   ```html
   <script>window.GA_ID = window.GA_ID || null;</script>
   ```
   на:
   ```html
   <script>window.GA_ID = 'G-XXXXXXXXXX';</script>
   ```

## 🌐 Деплой

### 1. Vercel (рекомендую, бесплатно, 1 минута)

1. Залей код на GitHub
2. Зайди на [vercel.com](https://vercel.com) → Sign Up with GitHub
3. Import Repository → выбери репо
4. **Build command**: `npm install` (или пусто)
5. **Output directory**: `landing`
6. Deploy → получишь URL типа `darkt30-portfolio.vercel.app`

> Форма не будет работать на Vercel по умолчанию (нет SMTP). Решения:
> - Используй **Formspree** (https://formspree.io) — бесплатно до 50 заявок/мес
> - Или задеплой **server** отдельно на Railway/Render

### 2. Netlify (тоже бесплатно)

1. Зайди на [app.netlify.com/drop](https://app.netlify.com/drop)
2. Перетащи папку `landing/`
3. Получишь URL

### 3. VPS (полный контроль, ~300 ₽/мес)

```bash
# На сервере (через SSH)
git clone https://github.com/your/portfolio.git
cd portfolio
npm install
NODE_ENV=production \
SMTP_HOST=smtp.yandex.ru \
SMTP_USER=artem.kurskiy.04@yandex.ru \
SMTP_PASS=your-password \
PORT=80 \
node server/landing-server.js &

# Чтобы сервер работал после перезагрузки — pm2:
npm install -g pm2
pm2 start server/landing-server.js --name landing
pm2 startup
pm2 save
```

### 4. Домен

Купи `darkt30.ru` (~600 ₽/год):
- [reg.ru](https://reg.ru)
- [beget.com](https://beget.com)
- [timeweb.com](https://timeweb.com)

Привяжи к Vercel/Netlify/VPS через A-запись.

## 📋 Чеклист перед запуском

- [ ] Купил домен
- [ ] Настроил SMTP (Yandex рекомендую)
- [ ] Получил Google Analytics ID
- [ ] Протестировал форму (отправил себе тест)
- [ ] Залил на GitHub
- [ ] Задеплоил на Vercel/Netlify/VPS
- [ ] Привязал домен
- [ ] Проверил SSL (https)
- [ ] Добавил в закладки браузера
- [ ] Дал ссылку заказчикам

## 💰 Стоимость

| Что | Стоимость |
|---|---|
| Домен `.ru` | ~600 ₽/год |
| Хостинг (Vercel) | **Бесплатно** |
| VPS (если с формой) | ~300 ₽/мес |
| SMTP (Yandex) | **Бесплатно** |
| Google Analytics | **Бесплатно** |
| **ИТОГО** | **0 – 4 200 ₽/год** |

## 🛠️ Кастомизация

### Изменить контакты
`index.html` → найди `darkt30`, `darktheme303`, `+79012875122` → замени на свои

### Изменить кейс TRIUMPH
Замени `triumph37.ru` и статистику в секции `<section class="work">`

### Изменить цены
Найди `25 000 ₽`, `80 000 ₽`, `150 000 ₽` в `index.html`

### Добавить аналитику Yandex.Metrica
После `</head>` вставь:
```html
<!-- Yandex.Metrica counter -->
<script type="text/javascript">
  (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
  m[i].l=1*new Date();
  for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
  k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
  (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
  ym(XXXXXXXX, "init", { clickmap:true, trackLinks:true, accurateTrackBounce:true });
</script>
<noscript><div><img src="https://mc.yandex.ru/watch/XXXXXXXX" style="position:absolute; left:-9999px;" alt=""></div></noscript>
```

Замени `XXXXXXXX` на номер счётчика.
