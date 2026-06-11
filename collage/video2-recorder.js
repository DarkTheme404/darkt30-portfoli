// TRIUMPH — Voiceover Video Generator
// Records HTML slides + syncs captions with audio timing

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync, execFileSync } = require('child_process');

const FFMPEG = '/opt/homebrew/bin/ffmpeg';
const VIDEO_URL = 'http://localhost:3000/collage/video2.html';
const FRAMES_DIR = path.join(__dirname, 'video2-frames');
const AUDIO_OUT = path.join(__dirname, 'voiceover.wav');
const VIDEO_OUT = path.join(__dirname, 'screenshots', 'promo-voiceover.mp4');

if (fs.existsSync(FRAMES_DIR)) {
  for (const f of fs.readdirSync(FRAMES_DIR)) fs.unlinkSync(path.join(FRAMES_DIR, f));
} else fs.mkdirSync(FRAMES_DIR, { recursive: true });
if (!fs.existsSync(path.dirname(VIDEO_OUT))) fs.mkdirSync(path.dirname(VIDEO_OUT), { recursive: true });

// Each slide gets a fixed duration matching its audio length + small padding
const SLIDES = [
  { idx: 0, dur: 8.0,  file: 'audio-1.aiff', text: 'В 2024 году девяносто три процента клиентов ищут товары и услуги в интернете. А вас там просто нет.' },
  { idx: 1, dur: 8.0,  file: 'audio-2.aiff', text: 'Без сайта вы теряете клиентов каждый день. Они уходят к конкурентам, у которых сайт есть. И возвращаться не будут.' },
  { idx: 2, dur: 9.5,  file: 'audio-3.aiff', text: 'Сайт — это ваш менеджер, который работает двадцать четыре на семь. Он продаёт, отвечает на вопросы и записывает клиентов, пока вы спите.' },
  { idx: 3, dur: 8.0,  file: 'audio-4.aiff', text: 'Я делаю современные сайты с админкой, чтобы вы сами управляли ценами, фото и текстами. Без программистов.' },
  { idx: 4, dur: 7.0,  file: 'audio-5.aiff', text: 'Напишите мне — расскажу, как сайт будет продавать для вашего бизнеса. Консультация бесплатно.' }
];

const FPS = 30;
const TOTAL_DUR = SLIDES.reduce((s, x) => s + x.dur, 0);
const TOTAL_FRAMES = Math.round(TOTAL_DUR * FPS);

async function buildAudio() {
  console.log('\nBuilding merged audio...');
  // Concatenate AIFF files with silence between
  const listFile = path.join(FRAMES_DIR, 'list.txt');
  const lines = [];
  for (const s of SLIDES) {
    lines.push(`file '${path.resolve(__dirname, s.file)}'`);
  }
  fs.writeFileSync(listFile, lines.join('\n'));
  execSync(`${FFMPEG} -y -f concat -safe 0 -i "${listFile}" -c copy "${AUDIO_OUT}.aiff" 2>&1 | tail -3`, { stdio: 'inherit' });
  // Convert to WAV
  execSync(`${FFMPEG} -y -i "${AUDIO_OUT}.aiff" -ar 48000 -ac 2 "${AUDIO_OUT}" 2>&1 | tail -2`, { stdio: 'inherit' });
  // Get exact duration
  const out = execSync(`${FFMPEG} -i "${AUDIO_OUT}" 2>&1 | grep "Duration"`).toString();
  console.log('  Audio duration:', out.match(/Duration: (\S+)/)?.[1]);
}

async function recordVideo() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();
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

  let frameIdx = 0;
  const startWall = Date.now();
  const startAudio = startWall;

  for (const slide of SLIDES) {
    const slideFrames = Math.round(slide.dur * FPS);
    console.log(`\n→ Slide ${slide.idx + 1}/${SLIDES.length}: ${slide.dur}s`);

    // Activate slide
    await page.evaluate(({ idx, text }) => {
      window._currentText = text;
      document.querySelectorAll('.slide').forEach((s, i) => {
        s.classList.toggle('active', i === idx);
      });
      // Update captions
      const captionsEl = document.getElementById('captions');
      const words = text.split(/\s+/);
      const cap = document.createElement('div');
      cap.className = 'caption visible';
      cap.innerHTML = words.map(w => `<span class="word">${w}</span>`).join(' ');
      captionsEl.innerHTML = '';
      captionsEl.appendChild(cap);
    }, { idx: slide.idx, text: slide.text });

    await page.waitForTimeout(400);

    // Record frames
    for (let f = 0; f < slideFrames; f++) {
      const filename = path.join(FRAMES_DIR, `f${String(frameIdx).padStart(5, '0')}.png`);
      await page.screenshot({ path: filename, type: 'png' });
      frameIdx++;
    }
    process.stdout.write(`  ${frameIdx}/${TOTAL_FRAMES} frames (${(frameIdx/FPS).toFixed(1)}s)\r`);
  }
  console.log(`\n✓ Captured ${frameIdx} frames`);
  await browser.close();
}

async function stitchVideo() {
  console.log('\nStitching video...');
  const inputPattern = path.join(FRAMES_DIR, 'f%05d.png');
  const tempVideo = path.join(FRAMES_DIR, 'temp.mp4');
  const cmd1 = [
    FFMPEG, '-y',
    '-framerate', String(FPS),
    '-i', `"${inputPattern}"`,
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'medium',
    '-crf', '22',
    '-vf', 'scale=1080:1920:flags=lanczos',
    `"${tempVideo}"`
  ].join(' ');
  execSync(cmd1, { stdio: 'inherit' });

  // Mux audio
  const cmd2 = [
    FFMPEG, '-y',
    '-i', `"${tempVideo}"`,
    '-i', `"${AUDIO_OUT}"`,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-shortest',
    '-movflags', '+faststart',
    `"${VIDEO_OUT}"`
  ].join(' ');
  execSync(cmd2, { stdio: 'inherit' });

  fs.unlinkSync(tempVideo);
  console.log('✓ Video: ' + VIDEO_OUT);
}

async function cleanup() {
  for (const f of fs.readdirSync(FRAMES_DIR)) {
    if (f !== 'list.txt') fs.unlinkSync(path.join(FRAMES_DIR, f));
  }
  fs.unlinkSync(path.join(FRAMES_DIR, 'list.txt'));
  fs.rmdirSync(FRAMES_DIR);
  if (fs.existsSync(AUDIO_OUT + '.aiff')) fs.unlinkSync(AUDIO_OUT + '.aiff');
}

(async () => {
  try {
    await buildAudio();
    await recordVideo();
    await stitchVideo();
    await cleanup();
    const stats = fs.statSync(VIDEO_OUT);
    console.log(`\n✅ Final: ${VIDEO_OUT} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
