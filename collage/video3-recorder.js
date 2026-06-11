// TRIUMPH — Voiceover Video v3
// Records HTML slides with synced captions to match user's audio

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const FFMPEG = '/opt/homebrew/bin/ffmpeg';
const VIDEO_URL = 'http://localhost:3000/collage/video2.html';
const FRAMES_DIR = path.join(__dirname, 'video3-frames');
const USER_AUDIO = path.join(__dirname, 'voiceover', 'ElevenLabs_2026-06-10T11_22_06_Prince Nur - Smooth, Rich and Engaging_pvc_sp95_s60_sb75_se40_b_m2.mp3');
const AUDIO_NORMALIZED = path.join(__dirname, 'voiceover-final.wav');
const VIDEO_OUT = path.join(__dirname, 'screenshots', 'promo-voiceover.mp4');

// Use execFileSync to avoid shell parsing of paths with spaces
const { execFileSync } = require('child_process');
function runFFmpeg(args, opts = {}) {
  return execFileSync(FFMPEG, args, { stdio: 'inherit', ...opts });
}

if (fs.existsSync(FRAMES_DIR)) {
  for (const f of fs.readdirSync(FRAMES_DIR)) fs.unlinkSync(path.join(FRAMES_DIR, f));
} else fs.mkdirSync(FRAMES_DIR, { recursive: true });

const FPS = 30;

// Match real audio duration exactly
const AUDIO_DUR = 36.91;
const TOTAL_FRAMES = Math.ceil(AUDIO_DUR * FPS); // 1108

// 5 slides, distributed proportionally
const SLIDES = [
  { idx: 0, weight: 0.18, text: 'В 2024 году девяносто три процента клиентов ищут товары и услуги в интернете. А вас там просто нет.' },
  { idx: 1, weight: 0.20, text: 'Без сайта вы теряете клиентов каждый день. Они уходят к конкурентам, у которых сайт есть. И возвращаться не будут.' },
  { idx: 2, weight: 0.22, text: 'Сайт — это ваш менеджер, который работает двадцать четыре на семь. Он продаёт, отвечает на вопросы и записывает клиентов, пока вы спите.' },
  { idx: 3, weight: 0.20, text: 'Я делаю современные сайты с админкой, чтобы вы сами управляли ценами, фото и текстами. Без программистов.' },
  { idx: 4, weight: 0.20, text: 'Напишите мне — расскажу, как сайт будет продавать для вашего бизнеса. Консультация бесплатно.' }
];

// Calculate slide durations based on weights
const totalWeight = SLIDES.reduce((s, x) => s + x.weight, 0);
let acc = 0;
const slideTimings = SLIDES.map(s => {
  const dur = (s.weight / totalWeight) * AUDIO_DUR;
  const start = acc;
  acc += dur;
  return { ...s, start, dur, frames: Math.round(dur * FPS) };
});
// Adjust last to match exactly
const framesSum = slideTimings.reduce((s, x) => s + x.frames, 0);
if (framesSum < TOTAL_FRAMES) {
  slideTimings[slideTimings.length - 1].frames += TOTAL_FRAMES - framesSum;
} else if (framesSum > TOTAL_FRAMES) {
  // Reduce from middle slides
  let diff = framesSum - TOTAL_FRAMES;
  for (let i = 1; i < slideTimings.length && diff > 0; i++) {
    const take = Math.min(diff, slideTimings[i].frames - 10);
    slideTimings[i].frames -= take;
    diff -= take;
  }
}

async function normalizeAudio() {
  console.log('Normalizing audio...');
  runFFmpeg([
    '-y', '-i', USER_AUDIO,
    '-ar', '48000', '-ac', '2',
    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
    AUDIO_NORMALIZED
  ]);
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
  for (const slide of slideTimings) {
    console.log(`→ Slide ${slide.idx + 1}/${SLIDES.length}: ${slide.start.toFixed(1)}s–${(slide.start+slide.dur).toFixed(1)}s (${slide.frames} frames)`);

    // Activate slide
    await page.evaluate(({ idx, text }) => {
      document.querySelectorAll('.slide').forEach((s, i) => {
        s.classList.toggle('active', i === idx);
      });
      const captionsEl = document.getElementById('captions');
      const words = text.split(/\s+/);
      const cap = document.createElement('div');
      cap.className = 'caption visible';
      cap.innerHTML = words.map(w => `<span class="word">${w}</span>`).join(' ');
      captionsEl.innerHTML = '';
      captionsEl.appendChild(cap);
    }, { idx: slide.idx, text: slide.text });

    await page.waitForTimeout(400);

    for (let f = 0; f < slide.frames; f++) {
      const filename = path.join(FRAMES_DIR, `f${String(frameIdx).padStart(5, '0')}.png`);
      await page.screenshot({ path: filename, type: 'png' });
      frameIdx++;
    }
  }
  console.log(`✓ Captured ${frameIdx} frames`);
  await browser.close();
}

async function stitchVideo() {
  console.log('\nStitching video...');
  const inputPattern = path.join(FRAMES_DIR, 'f%05d.png');
  const tempVideo = path.join(FRAMES_DIR, 'temp.mp4');

  // Step 1: make video from frames
  runFFmpeg([
    '-y', '-framerate', String(FPS),
    '-i', inputPattern,
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'medium',
    '-crf', '22',
    '-vf', 'scale=1080:1920:flags=lanczos',
    tempVideo
  ]);

  // Step 2: mux audio
  runFFmpeg([
    '-y',
    '-i', tempVideo,
    '-i', AUDIO_NORMALIZED,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    '-movflags', '+faststart',
    VIDEO_OUT
  ]);

  fs.unlinkSync(tempVideo);
  console.log('✓ Video: ' + VIDEO_OUT);
}

async function cleanup() {
  for (const f of fs.readdirSync(FRAMES_DIR)) {
    fs.unlinkSync(path.join(FRAMES_DIR, f));
  }
  fs.rmdirSync(FRAMES_DIR);
  if (fs.existsSync(AUDIO_NORMALIZED)) fs.unlinkSync(AUDIO_NORMALIZED);
}

(async () => {
  try {
    await normalizeAudio();
    await recordVideo();
    await stitchVideo();
    await cleanup();
    const stats = fs.statSync(VIDEO_OUT);
    console.log(`\n✅ Final: ${VIDEO_OUT} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    open(VIDEO_OUT);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
