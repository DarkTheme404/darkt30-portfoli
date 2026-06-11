// TRIUMPH — Promo Video Generator (v2)
// Records each slide separately with proper animation control

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const FFMPEG = '/opt/homebrew/bin/ffmpeg';
const VIDEO_URL = 'http://localhost:3000/collage/video.html';
const FRAMES_DIR = path.join(__dirname, 'video-frames');
const OUTPUT = path.join(__dirname, 'screenshots', 'promo-video.mp4');

if (fs.existsSync(FRAMES_DIR)) {
  for (const f of fs.readdirSync(FRAMES_DIR)) fs.unlinkSync(path.join(FRAMES_DIR, f));
} else {
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
}
if (!fs.existsSync(path.dirname(OUTPUT))) fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });

const FPS = 30;
const TOTAL = 15; // seconds total

// 5 slides, 3 seconds each
const SLIDES = [
  { idx: 0, name: 'hook',     dur: 3, label: 'САЙТЫ КОТОРЫЕ ПРОДАЮТ' },
  { idx: 1, name: 'kicker',   dur: 3, label: 'КЕЙС · TRIUMPH' },
  { idx: 2, name: 'features', dur: 3, label: 'ЧТО ВХОДИТ' },
  { idx: 3, name: 'price',    dur: 3, label: 'СТОИМОСТЬ' },
  { idx: 4, name: 'cta',      dur: 3, label: 'ЗАКАЖИ САЙТ' }
];

async function recordSlides() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();

  // Disable the auto-sliding animation and make each slide visible at controlled time
  await page.addInitScript(() => {
    window._forceTime = 0;
  });

  await page.goto(VIDEO_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

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
      height: 1em;
      background: #1c1c1c;
      border-radius: 3px;
      z-index: 5;
    }
  ` });

  // Override the main auto-slide animation
  // We'll set transform directly to show the current slide, while keeping inner animations
  let frameIdx = 0;

  for (const slide of SLIDES) {
    console.log(`\n→ Slide ${slide.idx + 1}/${SLIDES.length}: ${slide.label} (${slide.dur}s)`);

    // Position the slides container to show this slide
    await page.evaluate((slideIdx) => {
      const slides = document.querySelector('.slides');
      // Disable animation
      slides.style.animation = 'none';
      slides.style.transition = 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
      // Move to this slide
      slides.style.transform = `translateY(-${slideIdx * 1920}px)`;
      // Stop progress bar
      const prog = document.querySelector('.progress');
      if (prog) prog.style.animation = 'none';
    }, slide.idx);

    // Wait for transition
    await page.waitForTimeout(700);

    // Record frames for this slide
    const slideFrames = slide.dur * FPS;
    for (let f = 0; f < slideFrames; f++) {
      const filename = path.join(FRAMES_DIR, `f${String(frameIdx).padStart(5, '0')}.png`);
      await page.screenshot({ path: filename, type: 'png', omitBackground: false });
      frameIdx++;
      if (frameIdx % 30 === 0) {
        process.stdout.write(`  ${frameIdx}/${TOTAL * FPS} frames (${(frameIdx/FPS).toFixed(1)}s)\r`);
      }
    }
  }
  console.log(`\n✓ Captured ${frameIdx} frames`);

  await browser.close();
}

async function stitchVideo() {
  console.log('\nStitching video with ffmpeg...');
  const inputPattern = path.join(FRAMES_DIR, 'f%05d.png');
  const cmd = [
    FFMPEG, '-y',
    '-framerate', String(FPS),
    '-i', `"${inputPattern}"`,
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'medium',
    '-crf', '22',
    '-vf', 'scale=1080:1920:flags=lanczos',
    '-movflags', '+faststart',
    `"${OUTPUT}"`
  ].join(' ');
  execSync(cmd, { stdio: 'inherit' });
  console.log('✓ Video: ' + OUTPUT);
}

async function cleanup() {
  const files = fs.readdirSync(FRAMES_DIR);
  for (const f of files) fs.unlinkSync(path.join(FRAMES_DIR, f));
  fs.rmdirSync(FRAMES_DIR);
}

(async () => {
  try {
    await recordSlides();
    await stitchVideo();
    await cleanup();
    const stats = fs.statSync(OUTPUT);
    console.log(`\n✅ Final: ${OUTPUT} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
