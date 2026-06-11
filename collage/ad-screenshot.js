// Sales ad screenshot
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1080 },
    deviceScaleFactor: 2
  });
  const page = await context.newPage();

  await page.goto('http://localhost:3000/collage/ad.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Censor numbers
  await page.addStyleTag({ content: `
    [data-censor] {
      color: transparent !important;
      position: relative;
    }
    [data-censor]::after {
      content: '';
      position: absolute;
      left: 0; top: 50%;
      transform: translateY(-50%);
      width: 100%;
      height: 1.2em;
      background: #1c1c1c;
      border-radius: 3px;
      z-index: 5;
    }
    [data-censor] small { color: transparent !important; }
  ` });

  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(__dirname, 'screenshots', 'ad-sales.png'),
    fullPage: false
  });
  console.log('✓ ad-sales.png saved');

  // Variant 2 — без цены (больше фокус на тренировки)
  await page.evaluate(() => {
    document.querySelector('.ad-promo').textContent = '★ ЗАПИШИСЬ СЕЙЧАС';
  });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(__dirname, 'screenshots', 'ad-sales-v2.png'),
    fullPage: false
  });
  console.log('✓ ad-sales-v2.png saved');

  await browser.close();
})();
