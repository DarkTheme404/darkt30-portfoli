// Generate OG cover for landing page (1200x630 for social media)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1
  });
  const page = await ctx.newPage();

  // Load landing
  await page.goto('http://localhost:4000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Hide elements that shouldn't appear in OG
  await page.addStyleTag({
    content: `
      header, .cursor, .scroll-indicator, .scroll-progress,
      nav, .grid-floor, .particles { display: none !important; }
      .hero { padding-top: 0 !important; min-height: 630px !important; }
      .cube { display: none !important; }
    `
  });

  // Wait for animations to settle
  await page.waitForTimeout(1000);

  // Screenshot viewport
  const out = path.join(__dirname, 'og-cover.jpg');
  await page.screenshot({
    path: out,
    type: 'jpeg',
    quality: 90,
    fullPage: false
  });

  await browser.close();
  const stats = fs.statSync(out);
  console.log(`✓ og-cover.jpg created: ${(stats.size / 1024).toFixed(1)} KB`);
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
