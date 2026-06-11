/* ============================================
   TRIUMPH — Site data loader (v3.1)
   Loads /api/content and hydrates page
   Auto-renders all known patterns
   ============================================ */

(function() {
  function showDebug(status, msg) {
    let el = document.getElementById('sitedata-debug');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sitedata-debug';
      el.style.cssText = 'position:fixed;bottom:8px;left:8px;z-index:99999;background:#000;color:#fff;padding:6px 10px;font:11px/1.4 monospace;border-radius:4px;opacity:0.85;max-width:400px;pointer-events:none;';
      document.body.appendChild(el);
    }
    el.textContent = '[' + status + '] ' + msg;
  }

  const SiteData = {
    _data: null,
    _ready: false,
    _callbacks: [],

    async load() {
      showDebug('…', 'fetching /api/content');
      try {
        const res = await fetch('/api/content?_=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        this._data = await res.json();
        this._ready = true;
        showDebug('✓', 'loaded: ' + (this._data.coaches?.length || 0) + ' coaches, ' + (this._data.media?.length || 0) + ' media');
        // Fire callbacks
        const cbs = this._callbacks.slice();
        this._callbacks = [];
        cbs.forEach(cb => { try { cb(this._data); } catch (e) { console.error('callback err', e); } });
      } catch (e) {
        showDebug('✗', 'fetch failed: ' + e.message);
        console.error('❌ SiteData load failed', e);
      }
    },

    onReady(cb) {
      if (this._ready) {
        try { cb(this._data); } catch (e) { console.error('onReady err', e); }
      } else {
        this._callbacks.push(cb);
      }
    },

    // Accessors
    get coaches() { return this._data?.coaches || []; },
    get media() { return this._data?.media || []; },
    get branding() { return this._data?.branding || {}; },
    pageContent(s) { return this._data?.pageContent?.[s] || {}; },
    settingBy(k) { return this._data?.settings?.[k] || ''; },

    applyBranding() {
      const b = this.branding;
      if (b.logo) {
        document.querySelectorAll('[data-logo-wrap]').forEach(el => {
          el.innerHTML = '<img data-logo-img src="' + b.logo + '" alt="ТРИУМФ" style="height: 40px; display: block;">';
        });
      }
      if (b.favicon) {
        const link = document.querySelector('link[rel="icon"]');
        if (link) link.href = b.favicon;
      }
      if (b.heroImage) {
        const heroBg = document.querySelector('.hero-bg');
        if (heroBg) {
          heroBg.style.backgroundImage = 'url("' + b.heroImage + '")';
          heroBg.style.backgroundSize = 'cover';
          heroBg.style.backgroundPosition = 'center';
        }
      }
    },

    applyDataBinds() {
      document.querySelectorAll('[data-bind]').forEach(el => {
        const path = el.dataset.bind.split('.');
        let val = this._data;
        for (const p of path) val = val?.[p];
        if (val === undefined || val === null) return;
        el.textContent = val;
      });
    },

    // ---- Auto-renderers (called by onReady on each page) ----
    renderMainTrainer() {
      // Kept for backward compatibility — now uses slider
      this.renderHomeCoachSlider();
    },

    renderHomeCoachSlider() {
      const slider = document.getElementById('home-coach-slider');
      if (!slider) return;
      const track = document.getElementById('home-coach-track');
      const dots = document.getElementById('home-coach-dots');
      if (!track) return;
      const coaches = this.coaches;
      if (!coaches.length) {
        track.innerHTML = '<div class="coach-slide"><div class="coach-slide-body"><h2>Тренеры появятся скоро</h2><p>Команда формируется. Следите за обновлениями.</p></div></div>';
        return;
      }
      track.innerHTML = coaches.map((c, i) => `
        <div class="coach-slide">
          <div class="coach-slide-photo">
            ${c.photo ? '<img src="' + c.photo + '" alt="' + escapeAttr(c.name) + '">' : '<div class="placeholder">' + (c.emoji || '👤') + '</div>'}
          </div>
          <div class="coach-slide-body">
            <div class="coach-slide-num">${String(i + 1).padStart(2, '0')}</div>
            <h2>${escapeHtml(c.name)}</h2>
            <div class="role">${escapeHtml(c.role || '')}</div>
            <p>${escapeHtml(c.bio || '')}</p>
            ${(c.achievements && c.achievements.length) ? '<div class="coach-slide-credentials">' + c.achievements.slice(0, 4).map(a => '<span class="cred">' + escapeHtml(a) + '</span>').join('') + '</div>' : ''}
            <div style="margin-top: 24px;">
              <a href="/pages/coaches.html" class="btn btn-ghost btn-sm">Подробнее о команде</a>
            </div>
          </div>
        </div>
      `).join('');

      // Dots
      dots.innerHTML = coaches.map((_, i) =>
        '<button class="coach-slider-dot' + (i === 0 ? ' active' : '') + '" data-i="' + i + '" aria-label="Слайд ' + (i + 1) + '"></button>'
      ).join('');

      this._initSlider('home-coach', coaches.length);
    },

    renderHeroCoachMini() {
      const wrap = document.getElementById('hero-coach-mini');
      if (!wrap) return;
      const track = document.getElementById('hero-coach-track');
      const dots = document.getElementById('hero-coach-dots');
      if (!track) return;
      const coaches = this.coaches;
      if (!coaches.length) return;
      track.innerHTML = coaches.map(c => {
        const photoHtml = c.photo
          ? '<img src="' + c.photo + '" alt="' + escapeAttr(c.name) + '">'
          : '<div class="placeholder">' + (c.emoji || '👤') + '</div>';
        return `
          <div class="hero-coach-mini-slide">
            <div class="slide-photo">${photoHtml}</div>
            <div class="slide-info">
              <div class="name">${escapeHtml(c.name)}</div>
              <div class="role">${escapeHtml(c.role || '')}<span class="live">● ТРЕНИРУЕТ</span></div>
            </div>
          </div>
        `;
      }).join('');

      dots.innerHTML = coaches.map((_, i) =>
        '<span class="dot' + (i === 0 ? ' active' : '') + '" data-i="' + i + '"></span>'
      ).join('');

      this._initSlider('hero-coach', coaches.length, 5000);
    },

    _initSlider(key, total, autoMs = 0) {
      if (!total) return;
      const trackId = key === 'home-coach' ? 'home-coach-track' : 'hero-coach-track';
      const dotsId = key === 'home-coach' ? 'home-coach-dots' : 'hero-coach-dots';
      const prevId = key === 'home-coach' ? 'home-coach-prev' : 'hero-coach-prev';
      const nextId = key === 'home-coach' ? 'home-coach-next' : 'hero-coach-next';
      const track = document.getElementById(trackId);
      const dots = document.getElementById(dotsId);
      if (!track || !dots) return;
      let i = 0;
      const stateKey = '_slider_' + key;
      if (this[stateKey]) clearInterval(this[stateKey]);
      const go = (n) => {
        i = (n + total) % total;
        track.style.transform = 'translateX(-' + (i * 100) + '%)';
        dots.querySelectorAll('[data-i]').forEach((d, idx) => {
          d.classList.toggle('active', idx === i);
        });
      };
      // Bind events
      dots.querySelectorAll('[data-i]').forEach((d) => {
        d.onclick = () => go(parseInt(d.dataset.i, 10));
      });
      if (prevId) {
        const prev = document.getElementById(prevId);
        if (prev) prev.onclick = () => { go(i - 1); restart(); };
      }
      if (nextId) {
        const next = document.getElementById(nextId);
        if (next) next.onclick = () => { go(i + 1); restart(); };
      }
      // Swipe support
      let startX = 0;
      track.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
      track.addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 50) {
          go(dx < 0 ? i + 1 : i - 1);
          restart();
        }
      }, { passive: true });
      // Auto-rotate
      const restart = () => {
        if (this[stateKey]) clearInterval(this[stateKey]);
        if (autoMs > 0) this[stateKey] = setInterval(() => go(i + 1), autoMs);
      };
      restart();
      // Pause on hover
      const slider = track.closest('.coach-slider, .hero-coach-mini');
      if (slider) {
        slider.onmouseenter = () => clearInterval(this[stateKey]);
        slider.onmouseleave = restart;
      }
    },

    renderCoachesGrid() {
      const grid = document.getElementById('coaches-grid');
      if (!grid) return;
      grid.innerHTML = this.coaches.map(c => `
        <div class="coach-card">
          <div class="coach-photo">${c.photo ? '<img src="' + c.photo + '" alt="' + c.name + '">' : (c.emoji || '👤')}</div>
          <div class="coach-info">
            <h3>${c.name}</h3>
            <div class="role">${c.role}</div>
            <p>${c.bio || ''}</p>
            <ul class="coach-achievements">
              ${(c.achievements || []).map(i => '<li>' + i + '</li>').join('')}
            </ul>
          </div>
        </div>
      `).join('');
    },

    renderSchedule() {
      const table = document.getElementById('schedule');
      if (!table) return;
      const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
      const items = [...(this._data?.schedule || [])].sort((a, b) => days.indexOf(a.day) - days.indexOf(b.day) || a.time.localeCompare(b.time));
      table.innerHTML = `
        <div class="schedule-row head">
          <div>День</div><div>Время</div><div>Группа</div><div>Тренер</div><div></div>
        </div>
        ${items.map(s => `
          <div class="schedule-row" data-cat="${s.category}">
            <div class="schedule-day">${s.day}</div>
            <div class="schedule-time">${s.time}</div>
            <div class="schedule-class">${s.class}</div>
            <div class="schedule-coach">${s.coach}</div>
            <div><a href="/pages/signup.html" class="btn btn-ghost btn-sm">Записаться</a></div>
          </div>
        `).join('')}
      `;
    },

    renderBlog() {
      const grid = document.getElementById('blog-grid');
      if (!grid) return;
      const posts = (this._data?.blog || []).filter(p => p.published !== false);
      grid.innerHTML = posts.map(p => `
        <article class="blog-card">
          <div class="blog-cover">${p.cover ? '<img src="' + p.cover + '" alt="" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;">' : (p.emoji || '📄')}</div>
          <div class="blog-card-body">
            <div class="blog-meta">
              <span class="cat">${p.category || 'Новости'}</span>
              <span>${formatDate(p.date)}</span>
            </div>
            <h3>${p.title}</h3>
            <p>${p.excerpt || ''}</p>
            <a href="#" class="blog-link">Читать</a>
          </div>
        </article>
      `).join('') || '<div class="empty" style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray-2);">Публикаций пока нет</div>';
    },

    renderAboutGallery() {
      // About visual: first image
      const visual = document.getElementById('about-visual');
      const firstImg = this.media.find(m => m.type === 'image');
      if (visual && firstImg) {
        const img = document.createElement('img');
        img.src = firstImg.url;
        img.alt = '';
        visual.appendChild(img);
      }
      // Gallery grid
      const grid = document.getElementById('gallery-grid');
      if (grid) {
        const imgs = this.media.filter(m => m.type === 'image').slice(0, 12);
        grid.innerHTML = imgs.length
          ? imgs.map(m => `<a href="${m.url}" target="_blank" class="gallery-item"><img src="${m.url}" alt="${m.originalName || ''}" loading="lazy"></a>`).join('')
          : '<div class="empty" style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray-2);">Фотографии появятся в ближайшее время</div>';
      }
    },

    autoRender() {
      // Universal hydration for all pages
      this.applyBranding();
      this.applyDataBinds();
      this.renderHomeCoachSlider();
      this.renderHeroCoachMini();
      this.renderCoachesGrid();
      this.renderSchedule();
      this.renderBlog();
      this.renderAboutGallery();
      this.bindScheduleFilters();
      this.setActiveNav();

      // Re-init reveal animations on dynamically inserted content
      if (typeof window.initReveal === 'function') {
        try { window.initReveal(); } catch (e) {}
      }
    },

    setActiveNav() {
      const path = window.location.pathname;
      const isHome = path === '/' || path === '/index.html' || path === '';
      document.querySelectorAll('.nav-menu a').forEach(a => {
        const href = a.getAttribute('href');
        if (!href) return;
        if (isHome && (href === '/' || href === '/index.html')) {
          a.classList.add('active');
        } else if (href === path) {
          a.classList.add('active');
        } else if (path.startsWith(href) && href !== '/' && href !== '/index.html') {
          a.classList.add('active');
        }
      });
    },

    bindScheduleFilters() {
      const buttons = document.querySelectorAll('.filter-btn');
      if (!buttons.length) return;
      buttons.forEach(btn => {
        if (btn.dataset.bound) return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', () => {
          buttons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const cat = btn.dataset.filter;
          document.querySelectorAll('.schedule-row[data-cat]').forEach(r => {
            r.style.display = (cat === 'all' || (r.dataset.cat || '').includes(cat)) ? '' : 'none';
          });
        });
      });
    }
  };

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  SiteData.formatDate = formatDate;

  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function escapeAttr(s) { return escapeHtml(s); }
  SiteData.escapeHtml = escapeHtml;

  window.SiteData = SiteData;
  window.SiteDataReload = () => SiteData.load();

  // Auto-render when data is ready
  SiteData.onReady(() => SiteData.autoRender());

  // Start loading immediately
  SiteData.load();
})();
