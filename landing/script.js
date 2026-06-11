// ARTHUR KURSKIY — Landing JavaScript
// Cyberpunk effects: particles, glitch, scroll-reveal, counters, 3D cube

(function() {
  'use strict';

  // ========== LOADING SCREEN ==========
  const loader = document.getElementById('loader');
  const loaderBar = loader?.querySelector('.loader-bar-fill');
  const loaderPercent = loader?.querySelector('.loader-percent');
  let loadProgress = 0;

  const loadInterval = setInterval(() => {
    loadProgress += Math.random() * 15;
    if (loadProgress >= 100) {
      loadProgress = 100;
      if (loaderBar) loaderBar.style.width = '100%';
      if (loaderPercent) loaderPercent.textContent = '100%';
      clearInterval(loadInterval);
      setTimeout(() => loader?.classList.add('hidden'), 400);
    } else {
      if (loaderBar) loaderBar.style.width = loadProgress + '%';
      if (loaderPercent) loaderPercent.textContent = Math.floor(loadProgress) + '%';
    }
  }, 80);

  // ========== CUSTOM CURSOR ==========
  const cursor = document.getElementById('cursor');
  const follower = document.getElementById('cursorFollower');
  let mouseX = 0, mouseY = 0, followerX = 0, followerY = 0;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (cursor) {
      cursor.style.left = mouseX + 'px';
      cursor.style.top = mouseY + 'px';
    }
  });

  function animateCursor() {
    followerX += (mouseX - followerX) * 0.15;
    followerY += (mouseY - followerY) * 0.15;
    if (follower) {
      follower.style.left = followerX + 'px';
      follower.style.top = followerY + 'px';
    }
    requestAnimationFrame(animateCursor);
  }
  animateCursor();

  document.querySelectorAll('a, button, .service, .case, .step, .contact-card').forEach(el => {
    el.addEventListener('mouseenter', () => {
      cursor?.classList.add('hover');
      follower?.classList.add('hover');
    });
    el.addEventListener('mouseleave', () => {
      cursor?.classList.remove('hover');
      follower?.classList.remove('hover');
    });
  });

  // ========== PARTICLE NETWORK ==========
  const canvas = document.getElementById('particles');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let particles = [];
    const PARTICLE_COUNT = window.innerWidth < 768 ? 40 : 80;
    let animationId;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    class Particle {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.4;
        this.vy = (Math.random() - 0.5) * 0.4;
        this.radius = Math.random() * 1.5 + 0.5;
        this.opacity = Math.random() * 0.5 + 0.2;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 0, 51, ${this.opacity})`;
        ctx.fill();
      }
    }

    function init() {
      particles = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push(new Particle());
      }
    }
    init();
    window.addEventListener('resize', () => {
      PARTICLE_COUNT = window.innerWidth < 768 ? 40 : 80;
      init();
    });

    function connect() {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 130) {
            const opacity = 1 - distance / 130;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(255, 0, 51, ${opacity * 0.3})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
        // Mouse connection
        const dx = particles[i].x - mouseX;
        const dy = particles[i].y - mouseY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 150) {
          const opacity = 1 - distance / 150;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(mouseX, mouseY);
          ctx.strokeStyle = `rgba(255, 0, 51, ${opacity * 0.5})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.update();
        p.draw();
      });
      connect();
      animationId = requestAnimationFrame(animate);
    }
    animate();
  }

  // ========== NAV SCROLL ==========
  const nav = document.getElementById('nav');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) nav?.classList.add('scrolled');
    else nav?.classList.remove('scrolled');
  });

  // ========== REVEAL ON SCROLL ==========
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        // Counter animation
        entry.target.querySelectorAll('[data-target]').forEach(el => {
          if (el.dataset.counted) return;
          el.dataset.counted = '1';
          animateCounter(el);
        });
      }
    });
  }, { threshold: 0.15 });

  document.querySelectorAll('.reveal, .step, .service, .section-title').forEach(el => {
    observer.observe(el);
  });

  // ========== COUNTER ANIMATION ==========
  function animateCounter(el) {
    const target = parseInt(el.dataset.target);
    if (isNaN(target)) return;
    const duration = 1500;
    const start = performance.now();
    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(eased * target);
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target;
    }
    requestAnimationFrame(step);
  }

  // Initial reveal for hero
  setTimeout(() => {
    document.querySelectorAll('.hero .reveal').forEach(el => el.classList.add('in'));
    // Trigger counters in hero immediately
    document.querySelectorAll('.hero-stats [data-target]').forEach(el => {
      if (!el.dataset.counted) {
        el.dataset.counted = '1';
        animateCounter(el);
      }
    });
  }, 1000);

  // ========== SMOOTH SCROLL ==========
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#' || href.length < 2) return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const offset = 80;
        const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  // ========== PHONE MASK ==========
  const phoneInput = document.getElementById('phone');
  if (phoneInput) {
    phoneInput.addEventListener('input', (e) => {
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
  }

  // ========== LEAD FORM SUBMIT ==========
  const leadForm = document.getElementById('leadForm');
  const formSuccess = document.getElementById('formSuccess');
  if (leadForm) {
    leadForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = leadForm.querySelector('.form-submit');
      const originalHTML = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="fs-text">ОТПРАВКА...</span>';

      const data = Object.fromEntries(new FormData(leadForm).entries());

      try {
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const result = await res.json();
        if (!res.ok || !result.ok) throw new Error(result.error || 'Ошибка отправки');

        // Show success
        leadForm.querySelectorAll('input, select, textarea, button').forEach(el => el.disabled = true);
        leadForm.querySelector('.form-submit').style.display = 'none';
        formSuccess.classList.add('show');

        // Track event (for GA if added)
        if (typeof gtag === 'function') {
          gtag('event', 'lead_submit', { service: data.service, budget: data.budget });
        }

        // Auto-hide form, show success
        setTimeout(() => {
          formSuccess.innerHTML = '<div class="fs-icon">🎉</div><div class="fs-text">Спасибо! Напишу вам в течение часа.</div>';
        }, 200);
      } catch (err) {
        alert('⚠️ ' + err.message);
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHTML;
      }
    });
  }

  // ========== PARALLAX ==========
  window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;
    const heroBg = document.querySelector('.grid-glow');
    if (heroBg) {
      heroBg.style.transform = `translateY(${scrolled * 0.3}px)`;
    }
  });

  console.log('%c★ DARKT30 ★', 'color: #ff0033; font-size: 30px; font-weight: bold;');
  console.log('%cСайт-портфолио Артёма Курского', 'color: #888; font-size: 12px;');
})();
