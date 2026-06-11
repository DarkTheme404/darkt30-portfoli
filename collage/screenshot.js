// TRIUMPH — Collage Screenshot Script
// Censors numbers with black bars before taking screenshots

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const COLLAGE_URL = 'http://localhost:3000/collage/index.html';
const OUTPUT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// CSS for censoring — black bars with same font size
const CENSOR_CSS = `
[data-censor] {
  position: relative;
  color: transparent !important;
  text-shadow: none !important;
  user-select: none;
}
[data-censor]::after {
  content: '';
  position: absolute;
  left: 0; top: 50%;
  transform: translateY(-50%);
  width: 100%;
  height: 1em;
  background: #1c1c1c;
  border-radius: 2px;
  z-index: 5;
}
`;

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1200 },
    deviceScaleFactor: 2 // Retina quality
  });
  const page = await context.newPage();

  // === 1. SITE PAGES (real site with censoring) ===
  console.log('1. Capturing real site pages with censoring...');

  const pages = [
    { url: 'http://localhost:3000/', file: 'site-home.png', name: 'Главная' },
    { url: 'http://localhost:3000/pages/coaches.html', file: 'site-coaches.png', name: 'Тренеры' },
    { url: 'http://localhost:3000/pages/schedule.html', file: 'site-schedule.png', name: 'Расписание' },
    { url: 'http://localhost:3000/pages/pricing.html', file: 'site-pricing.png', name: 'Цены' },
    { url: 'http://localhost:3000/pages/blog.html', file: 'site-blog.png', name: 'Блог' },
    { url: 'http://localhost:3000/admin', file: 'admin.png', name: 'Админка' }
  ];

  for (const p of pages) {
    await page.goto(p.url, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500); // wait for JS to render

    // Inject censoring CSS
    await page.addStyleTag({ content: CENSOR_CSS });
    // Also censor by selectors
    await page.addStyleTag({ content: `
      .hero-stat .num,
      .price-amount .num,
      [data-counter],
      .stat-value {
        color: transparent !important;
        position: relative;
      }
      .hero-stat .num::before,
      .price-amount .num::before,
      [data-counter]::before,
      .stat-value::before {
        content: '';
        position: absolute;
        left: 0; top: 0;
        width: 100%;
        height: 100%;
        background: var(--black-3, #1c1c1c);
        z-index: 5;
        border-radius: 4px;
      }
    ` });

    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, p.file),
      fullPage: false
    });
    console.log('   ✓ ' + p.name);
  }

  // === 2. PORTFOLIO COLLAGE ===
  console.log('2. Capturing portfolio collage...');
  await page.goto(COLLAGE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.addStyleTag({ content: CENSOR_CSS });
  await page.waitForTimeout(500);

  await page.screenshot({
    path: path.join(OUTPUT_DIR, 'collage.png'),
    fullPage: true
  });
  console.log('   ✓ Collage');

  // === 3. HERO BANNER (wide) ===
  await page.setViewportSize({ width: 1920, height: 800 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.addStyleTag({ content: CENSOR_CSS });
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(OUTPUT_DIR, 'hero-banner.png'),
    clip: { x: 0, y: 0, width: 1920, height: 800 }
  });
  console.log('   ✓ Hero banner');

  await browser.close();

  console.log('\n✅ Done! Files in: ' + OUTPUT_DIR);
  console.log(fs.readdirSync(OUTPUT_DIR).join('\n'));
})();
