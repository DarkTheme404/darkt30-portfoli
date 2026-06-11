// Kwork Cover Generator
// Creates PNG previews in different sizes for Kwork

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SIZES = [
  // Kwork preview + social
  { w: 1200, h: 630, name: 'kwork-cover.png', desc: 'Главный Kwork' },
  { w: 1200, h: 800, name: 'kwork-cover-tall.png', desc: 'Вертикальный Kwork' },
  { w: 1080, h: 1080, name: 'kwork-cover-square.png', desc: 'Соцсети (квадрат)' }
];

const URL = 'http://localhost:3000/collage/kwork-cover.html';
const OUT_DIR = path.join(__dirname, 'screenshots');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  for (const size of SIZES) {
    console.log(`📐 ${size.w}×${size.h} — ${size.desc}`);
    const context = await browser.newContext({
      viewport: { width: size.w, height: size.h },
      deviceScaleFactor: 2
    });
    const page = await context.newPage();
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Scale the cover to fit (it's designed 1200x630)
    await page.evaluate(({ w, h }) => {
      const cover = document.querySelector('.cover');
      cover.style.width = w + 'px';
      cover.style.height = h + 'px';
      // For tall version, allow content to scale
      if (h > 630) {
        cover.style.gridTemplateColumns = '1fr';
        cover.style.gap = '30px';
        cover.style.padding = '40px';
      }
    }, { w: size.w, h: size.h });
    await page.waitForTimeout(500);

    const out = path.join(OUT_DIR, size.name);
    await page.screenshot({ path: out, type: 'png' });
    console.log('   ✓', size.name);
    await context.close();
  }
  await browser.close();
  console.log('\n✅ Готово!');
})();
