const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const multer = require('multer');
const store = require('./store');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Disable caching for HTML and API responses
app.use((req, res, next) => {
  if (req.path === '/' || req.path.endsWith('.html') || req.path.startsWith('/api/')) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
});

// ---------- MULTER (file uploads) ----------
const UPLOADS_ROOT = path.join(__dirname, '..', 'public', 'uploads');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // folder is passed via query string (?folder=branding) or defaults to 'photos'
    const folder = (req.query.folder || 'photos').replace(/[^a-zA-Z0-9_-]/g, '');
    let sub = folder;
    if (file.mimetype.startsWith('video/')) sub = 'videos';
    else if (folder === 'coaches') sub = 'photos/coaches';
    const dest = path.join(UPLOADS_ROOT, sub);
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 40);
    const stamp = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    cb(null, `${base}-${stamp}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (req, file, cb) => {
    const ok = /^(image|video)\//.test(file.mimetype);
    if (!ok) return cb(new Error('Разрешены только изображения и видео'));
    cb(null, true);
  }
});

// Simple token-based admin auth
const ADMIN_TOKEN = 'triumph-admin-token-secret';
const sessions = new Map();

function authRequired(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ---------- STATIC ----------
app.use('/css', express.static(path.join(__dirname, '..', 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, '..', 'public', 'js')));
app.use('/images', express.static(path.join(__dirname, '..', 'public', 'images')));
app.use('/pages', express.static(path.join(__dirname, '..', 'public', 'pages')));
app.use('/admin/css', express.static(path.join(__dirname, '..', 'admin', 'css')));
app.use('/admin/js', express.static(path.join(__dirname, '..', 'admin', 'js')));
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));
app.use('/uploads', express.static(UPLOADS_ROOT));
// Collage (for portfolio screenshots)
app.use('/collage', express.static(path.join(__dirname, '..', 'collage')));
// Portfolio landing
app.use('/landing', express.static(path.join(__dirname, '..', 'landing')));

// ---------- PUBLIC API ----------
app.get('/api/content', (req, res) => {
  const data = store.get();
  if (!data) return res.status(500).json({ error: 'Data load failed' });
  // Don't expose admin creds
  const { admin, ...safe } = data;
  res.json(safe);
});

app.post('/api/leads', (req, res) => {
  const body = req.body || {};
  if (!body.name || !body.phone) {
    return res.status(400).json({ error: 'Имя и телефон обязательны' });
  }
  const lead = store.pushLead(body);
  res.json({ ok: true, lead });
});

// ---------- ADMIN AUTH ----------
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  const data = store.get();
  if (!data) return res.status(500).json({ error: 'Server error' });
  if (username === data.admin.username && password === data.admin.password) {
    const token = `${ADMIN_TOKEN}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessions.set(token, { username, ts: Date.now() });
    return res.json({ ok: true, token });
  }
  res.status(401).json({ error: 'Неверный логин или пароль' });
});

app.post('/api/admin/logout', (req, res) => {
  const token = req.headers['x-admin-token'];
  if (token) sessions.delete(token);
  res.json({ ok: true });
});

app.get('/api/admin/me', authRequired, (req, res) => {
  res.json({ ok: true });
});

// ---------- ADMIN: STATS ----------
app.get('/api/admin/stats', authRequired, (req, res) => {
  const data = store.get();
  if (!data) return res.status(500).json({ error: 'Server error' });
  const today = new Date().toISOString().slice(0, 10);
  const todayLeads = data.leads.filter(l => (l.createdAt || '').slice(0, 10) === today).length;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekLeads = data.leads.filter(l => new Date(l.createdAt).getTime() > weekAgo).length;
  res.json({
    totalLeads: data.leads.length,
    todayLeads,
    weekLeads,
    newLeads: data.leads.filter(l => l.status === 'new').length,
    totalCoaches: data.coaches.length,
    totalSchedule: data.schedule.length,
    totalPosts: data.blog.length
  });
});

// ---------- ADMIN: SETTINGS ----------
app.put('/api/admin/settings', authRequired, (req, res) => {
  const data = store.update({ settings: req.body.settings, stats: req.body.stats, hero: req.body.hero });
  res.json({ ok: true, data });
});

// ---------- ADMIN: LEADS ----------
app.get('/api/admin/leads', authRequired, (req, res) => {
  const data = store.get();
  res.json(data.leads);
});

app.patch('/api/admin/leads/:id', authRequired, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const lead = store.updateLead(id, req.body);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  res.json(lead);
});

app.delete('/api/admin/leads/:id', authRequired, (req, res) => {
  const id = parseInt(req.params.id, 10);
  store.deleteLead(id);
  res.json({ ok: true });
});

// ---------- ADMIN: COACHES ----------
app.post('/api/admin/coaches', authRequired, (req, res) => {
  res.json(store.addCoach(req.body));
});

app.put('/api/admin/coaches/:id', authRequired, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const coach = store.updateCoach(id, req.body);
  if (!coach) return res.status(404).json({ error: 'Not found' });
  res.json(coach);
});

app.delete('/api/admin/coaches/:id', authRequired, (req, res) => {
  const id = parseInt(req.params.id, 10);
  store.deleteCoach(id);
  res.json({ ok: true });
});

// ---------- ADMIN: SCHEDULE ----------
app.post('/api/admin/schedule', authRequired, (req, res) => {
  res.json(store.addScheduleItem(req.body));
});

app.put('/api/admin/schedule/:id', authRequired, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = store.updateScheduleItem(id, req.body);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

app.delete('/api/admin/schedule/:id', authRequired, (req, res) => {
  const id = parseInt(req.params.id, 10);
  store.deleteScheduleItem(id);
  res.json({ ok: true });
});

// ---------- ADMIN: PRICING ----------
app.put('/api/admin/pricing', authRequired, (req, res) => {
  res.json(store.updatePricing(req.body));
});

// ---------- ADMIN: BLOG ----------
app.post('/api/admin/blog', authRequired, (req, res) => {
  res.json(store.addPost(req.body));
});

app.put('/api/admin/blog/:id', authRequired, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const post = store.updatePost(id, req.body);
  if (!post) return res.status(404).json({ error: 'Not found' });
  res.json(post);
});

app.delete('/api/admin/blog/:id', authRequired, (req, res) => {
  const id = parseInt(req.params.id, 10);
  store.deletePost(id);
  res.json({ ok: true });
});

// ---------- ADMIN: FILE UPLOAD ----------
app.post('/api/admin/upload', authRequired, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
  const url = `/uploads/${req.file.destination.replace(UPLOADS_ROOT, '').replace(/^[\/\\]/, '')}/${req.file.filename}`.replace(/\\/g, '/');
  const fullUrl = `/uploads/${path.relative(UPLOADS_ROOT, req.file.path).replace(/\\/g, '/')}`;
  const isVideo = req.file.mimetype.startsWith('video/');
  res.json({
    ok: true,
    file: {
      url: fullUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mime: req.file.mimetype,
      type: isVideo ? 'video' : 'image',
      folder: req.query.folder || 'photos'
    }
  });
});

// ---------- ADMIN: MEDIA LIBRARY ----------
app.post('/api/admin/media', authRequired, (req, res) => {
  res.json(store.addMedia(req.body));
});

app.put('/api/admin/media/:id', authRequired, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = store.updateMedia(id, req.body);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

app.delete('/api/admin/media/:id', authRequired, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const removed = store.deleteMedia(id);
  if (removed && removed.url) {
    // remove file from disk
    const filePath = path.join(__dirname, '..', 'public', removed.url);
    fs.unlink(filePath, () => {});
  }
  res.json({ ok: true });
});

// ---------- ADMIN: BRANDING ----------
app.get('/api/admin/branding', authRequired, (req, res) => {
  const data = store.get();
  res.json(data.branding || {});
});

app.put('/api/admin/branding', authRequired, (req, res) => {
  res.json(store.updateBranding(req.body));
});

// ---------- ADMIN: PAGE CONTENT ----------
app.get('/api/admin/page-content', authRequired, (req, res) => {
  const data = store.get();
  res.json(data.pageContent || {});
});

app.get('/api/admin/page-content/:section', authRequired, (req, res) => {
  const data = store.get();
  res.json((data.pageContent || {})[req.params.section] || {});
});

app.put('/api/admin/page-content/:section', authRequired, (req, res) => {
  res.json(store.updatePageContent(req.params.section, req.body));
});

// ---------- ADMIN: COACH PHOTO (upload + set) ----------
app.put('/api/admin/coaches/:id/photo', authRequired, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const coach = store.updateCoach(id, { photo: req.body.photo });
  if (!coach) return res.status(404).json({ error: 'Not found' });
  res.json(coach);
});

// ---------- ROUTES ----------
// Helper to safely send file if it exists
const sendIfExists = (filePath, fallback = null) => (req, res) => {
  if (fs.existsSync(filePath)) return res.sendFile(filePath);
  if (fallback) return res.sendFile(fallback);
  res.status(404).end('Not found');
};

const PUBLIC_INDEX = path.join(__dirname, '..', 'public', 'index.html');
const ADMIN_INDEX = path.join(__dirname, '..', 'admin', 'index.html');

app.get('/', sendIfExists(PUBLIC_INDEX));
app.get('/index.html', sendIfExists(PUBLIC_INDEX));
app.get('/admin', sendIfExists(ADMIN_INDEX));
app.get('/admin/', sendIfExists(ADMIN_INDEX));
app.get('/admin/index.html', sendIfExists(ADMIN_INDEX));
app.get('/admin/:page', sendIfExists(ADMIN_INDEX));

// Catch-all: any non-API, non-static, non-upload path returns index.html
// (only if it doesn't look like a file — files are handled by express.static above)
app.get(/^\/(?!api\/|uploads\/|css\/|js\/|images\/|pages\/|admin\/).*/, (req, res) => {
  // If request is for a file (has extension), return 404
  if (path.extname(req.path)) return res.status(404).end('Not found');
  res.sendFile(PUBLIC_INDEX);
});

// ---------- ERROR HANDLER (multer) ----------
app.use((err, req, res, next) => {
  if (err) {
    res.status(400).json({ error: err.message || 'Server error' });
    return;
  }
  next();
});

// ---------- START ----------
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  const localIPs = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIPs.push(iface.address);
      }
    }
  }
  console.log(`\n🥊 TRIUMPH Fight Club running`);
  console.log(`   → Local:    http://localhost:${PORT}/`);
  if (localIPs.length) {
    console.log(`   → Network:  http://${localIPs[0]}:${PORT}/`);
  }
  console.log(`   → Admin:    http://localhost:${PORT}/admin  (admin / triumph2026)`);
  console.log(`   → Listening on ${HOST}:${PORT}\n`);
});
