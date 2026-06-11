/* ============================================
   TRIUMPH — Main JS
   Navigation, animations, forms
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  // Each initializer is independent — failure in one doesn't break others
  const safe = (name, fn) => { try { fn(); } catch (e) { console.warn('[' + name + ']', e.message); } };
  safe('initNav', initNav);
  safe('initReveal', initReveal);
  safe('initCounters', initCounters);
  safe('initForms', initForms);
  safe('initSchedule', initSchedule);
  safe('initModal', initModal);
  safe('initSmoothLinks', initSmoothLinks);
  safe('initParallax', initParallax);
  safe('setActiveLink', setActiveLink);
});

/* ---------- Navigation ---------- */
function initNav() {
  const nav = document.querySelector('.nav');
  const burger = document.querySelector('.burger');
  const menu = document.querySelector('.nav-menu');

  const onScroll = () => {
    if (window.scrollY > 30) nav?.classList.add('scrolled');
    else nav?.classList.remove('scrolled');
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  burger?.addEventListener('click', () => {
    burger.classList.toggle('open');
    menu?.classList.toggle('open');
  });

  menu?.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      burger?.classList.remove('open');
      menu?.classList.remove('open');
    });
  });
}

function setActiveLink() {
  const path = location.pathname;
  // Normalize: '/' or '/index.html' → home, '/pages/about.html' → about
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
}

/* ---------- Reveal on scroll ---------- */
function initReveal() {
  const els = document.querySelectorAll('.reveal, .reveal-stagger, [data-reveal]');
  if (!('IntersectionObserver' in window)) {
    els.forEach(el => el.classList.add('visible'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -50px 0px' });

  els.forEach(el => io.observe(el));
}

/* ---------- Animated counters ---------- */
function initCounters() {
  const counters = document.querySelectorAll('[data-counter]');
  if (!counters.length) return;
  // Fallback for environments without IntersectionObserver
  if (!('IntersectionObserver' in window)) {
    counters.forEach(el => { el.textContent = parseFloat(el.dataset.counter).toLocaleString('ru-RU'); });
    return;
  }

  const animate = (el) => {
    const target = parseFloat(el.dataset.counter);
    const duration = 1800;
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.floor(eased * target);
      el.textContent = value.toLocaleString('ru-RU');
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target.toLocaleString('ru-RU');
    };
    requestAnimationFrame(step);
  };

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animate(entry.target);
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(c => io.observe(c));
}

/* ---------- Forms ---------- */
function initForms() {
  document.querySelectorAll('form[data-form]').forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submit = form.querySelector('[type="submit"]');
      const success = form.querySelector('.form-success');
      const originalText = submit?.textContent;

      if (submit) {
        submit.disabled = true;
        submit.textContent = 'ОТПРАВКА...';
      }

      const data = Object.fromEntries(new FormData(form).entries());

      try {
        const res = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Network error');
        if (success) {
          success.textContent = '✓ Заявка отправлена! Мы свяжемся с вами в ближайшее время.';
          success.classList.add('show');
        }
        form.reset();
        setTimeout(() => success?.classList.remove('show'), 6000);
      } catch (err) {
        if (success) {
          success.textContent = '⚠ Ошибка отправки. Попробуйте позже или позвоните нам.';
          success.classList.add('show');
          success.style.background = 'rgba(239, 68, 68, 0.1)';
          success.style.borderColor = 'rgba(239, 68, 68, 0.3)';
          success.style.color = '#f87171';
        }
      } finally {
        if (submit) {
          submit.disabled = false;
          submit.textContent = originalText;
        }
      }
    });
  });

  // Phone mask
  document.querySelectorAll('input[type="tel"]').forEach(input => {
    input.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '');
      if (v.startsWith('8')) v = '7' + v.slice(1);
      if (!v.startsWith('7') && v.length) v = '7' + v;
      if (v.length > 11) v = v.slice(0, 11);
      let formatted = '+7';
      if (v.length > 1) formatted += ' (' + v.slice(1, 4);
      if (v.length >= 5) formatted += ') ' + v.slice(4, 7);
      if (v.length >= 8) formatted += '-' + v.slice(7, 9);
      if (v.length >= 10) formatted += '-' + v.slice(9, 11);
      e.target.value = formatted;
    });
  });
}

/* ---------- Schedule filters ---------- */
function initSchedule() {
  const buttons = document.querySelectorAll('.filter-btn');
  const rows = document.querySelectorAll('.schedule-row[data-cat]');
  if (!buttons.length) return;

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.filter;
      rows.forEach(r => {
        if (cat === 'all' || r.dataset.cat === cat) {
          r.style.display = '';
        } else {
          r.style.display = 'none';
        }
      });
    });
  });
}

/* ---------- Modal ---------- */
function initModal() {
  const overlay = document.querySelector('.modal-overlay');
  if (!overlay) return;

  document.querySelectorAll('[data-modal-open]').forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    });
  });

  const close = () => {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  };

  overlay.querySelectorAll('.modal-close, [data-modal-close]').forEach(el => {
    el.addEventListener('click', close);
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
}

/* ---------- Smooth scroll for anchors ---------- */
function initSmoothLinks() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      if (href.length < 2) return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const offset = 80;
        const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });
}

/* ---------- Parallax (subtle) ---------- */
function initParallax() {
  const hero = document.querySelector('.hero-bg');
  if (!hero) return;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const y = window.scrollY * 0.3;
        hero.style.transform = `translate3d(0, ${y}px, 0)`;
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}
