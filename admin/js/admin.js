/* ============================================
   TRIUMPH — Admin Panel JS
   ============================================ */

const API = '/api';
const TOKEN_KEY = 'triumph_admin_token';

const api = {
  get token() { return localStorage.getItem(TOKEN_KEY); },
  set token(v) { v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY); },

  async req(path, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    // Only set JSON content-type when there's a JSON body
    if (opts.body && !(opts.body instanceof FormData)) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }
    if (this.token) headers['X-Admin-Token'] = this.token;
    const res = await fetch(API + path, { ...opts, headers });
    if (res.status === 401) {
      this.token = null;
      showLogin();
      throw new Error('Unauthorized');
    }
    return res;
  },

  async login(username, password) {
    const res = await fetch(API + '/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    this.token = data.token;
    return data;
  },

  async logout() {
    try { await this.req('/admin/logout', { method: 'POST' }); } catch (e) {}
    this.token = null;
    showLogin();
  },

  // Stats
  stats: () => api.req('/admin/stats').then(r => r.json()),
  // Content
  content: () => api.req('/content').then(r => r.json()),
  saveSettings: (data) => api.req('/admin/settings', { method: 'PUT', body: JSON.stringify(data) }),

  // Media + branding + page-content
  uploadFile: async (file, folder = 'photos') => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await api.req(`/admin/upload?folder=${encodeURIComponent(folder)}`, { method: 'POST', body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  },
  addMedia: (data) => api.req('/admin/media', { method: 'POST', body: JSON.stringify(data) }),
  deleteMedia: (id) => api.req(`/admin/media/${id}`, { method: 'DELETE' }),
  updateMedia: (id, data) => api.req(`/admin/media/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  saveBranding: (data) => api.req('/admin/branding', { method: 'PUT', body: JSON.stringify(data) }),
  savePageContent: (section, data) => api.req(`/admin/page-content/${section}`, { method: 'PUT', body: JSON.stringify(data) }),

  setCoachPhoto: (id, photo) => api.req(`/admin/coaches/${id}/photo`, { method: 'PUT', body: JSON.stringify({ photo }) }),
  // Leads
  leads: () => api.req('/admin/leads').then(r => r.json()),
  updateLead: (id, patch) => api.req(`/admin/leads/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteLead: (id) => api.req(`/admin/leads/${id}`, { method: 'DELETE' }),
  // Coaches
  addCoach: (data) => api.req('/admin/coaches', { method: 'POST', body: JSON.stringify(data) }),
  updateCoach: (id, data) => api.req(`/admin/coaches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCoach: (id) => api.req(`/admin/coaches/${id}`, { method: 'DELETE' }),
  // Schedule
  addSchedule: (data) => api.req('/admin/schedule', { method: 'POST', body: JSON.stringify(data) }),
  updateSchedule: (id, data) => api.req(`/admin/schedule/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSchedule: (id) => api.req(`/admin/schedule/${id}`, { method: 'DELETE' }),
  // Pricing
  savePricing: (data) => api.req('/admin/pricing', { method: 'PUT', body: JSON.stringify(data) }),
  // Blog
  addPost: (data) => api.req('/admin/blog', { method: 'POST', body: JSON.stringify(data) }),
  updatePost: (id, data) => api.req(`/admin/blog/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePost: (id) => api.req(`/admin/blog/${id}`, { method: 'DELETE' })
};

/* ============================================
   TOAST
   ============================================ */
function toast(msg, type = 'info') {
  const container = document.querySelector('.toast-container') || (() => {
    const c = document.createElement('div');
    c.className = 'toast-container';
    document.body.appendChild(c);
    return c;
  })();
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${msg}</span>`;
  container.appendChild(t);
  setTimeout(() => {
    t.style.animation = 'slideIn 0.2s reverse';
    setTimeout(() => t.remove(), 200);
  }, 3500);
}

/* ============================================
   LOGIN / APP
   ============================================ */
function showLogin() {
  document.getElementById('login-view').style.display = 'flex';
  document.getElementById('app-view').style.display = 'none';
  document.getElementById('login-form').reset();
  document.getElementById('login-error').classList.remove('show');
}

function showApp() {
  document.getElementById('login-view').style.display = 'none';
  document.getElementById('app-view').style.display = 'grid';
  initApp();
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.remove('show');
  try {
    await api.login(username, password);
    showApp();
  } catch (err) {
    errEl.textContent = err.message || 'Ошибка входа';
    errEl.classList.add('show');
  }
});

/* ============================================
   APP INIT
   ============================================ */
let DATA = null;
let ACTIVE_TAB = 'dashboard';

async function initApp() {
  try {
    DATA = await api.content();
    render();
    bindNavigation();
    bindLogout();
  } catch (err) {
    toast('Ошибка загрузки данных', 'error');
  }
}

function bindNavigation() {
  document.querySelectorAll('[data-nav]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('[data-nav]').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      ACTIVE_TAB = item.dataset.nav;
      renderTab();
      document.querySelector('.sidebar')?.classList.remove('open');
    });
  });
}

function bindLogout() {
  document.getElementById('logout-btn').addEventListener('click', () => {
    api.logout();
    toast('Вы вышли из системы', 'info');
  });
  document.getElementById('menu-toggle')?.addEventListener('click', () => {
    document.querySelector('.sidebar')?.classList.toggle('open');
  });
}

function render() {
  updateBadge();
  renderTab();
}

function updateBadge() {
  const newLeads = DATA.leads.filter(l => l.status === 'new').length;
  document.querySelectorAll('[data-badge="leads"]').forEach(el => {
    el.textContent = newLeads;
    el.style.display = newLeads ? '' : 'none';
  });
}

function renderTab() {
  const main = document.getElementById('main-content');
  const titles = {
    dashboard: { h: 'Дашборд', p: 'Обзор активности клуба' },
    leads: { h: 'Заявки', p: 'Заявки с сайта и запись на пробное' },
    coaches: { h: 'Тренеры', p: 'Управление командой тренеров' },
    schedule: { h: 'Расписание', p: 'Группы и время тренировок' },
    pricing: { h: 'Тарифы', p: 'Абонементы и цены' },
    blog: { h: 'Блог и новости', p: 'Публикации на сайте' },
    media: { h: 'Медиа-библиотека', p: 'Фото и видео с тренировок' },
    branding: { h: 'Брендинг', p: 'Логотип, фавикон, hero-изображение' },
    texts: { h: 'Тексты страниц', p: 'Редактирование контента сайта' },
    settings: { h: 'Настройки сайта', p: 'Контакты, статистика, главный экран' }
  };
  const t = titles[ACTIVE_TAB] || titles.dashboard;
  document.getElementById('page-title').textContent = t.h;
  document.getElementById('page-subtitle').textContent = t.p;

  const renderers = {
    dashboard: renderDashboard,
    leads: renderLeads,
    coaches: renderCoaches,
    schedule: renderSchedule,
    pricing: renderPricing,
    blog: renderBlog,
    media: renderMedia,
    branding: renderBranding,
    texts: renderTexts,
    settings: renderSettings
  };
  (renderers[ACTIVE_TAB] || renderDashboard)(main);
}

/* ============================================
   DASHBOARD
   ============================================ */
async function renderDashboard(el) {
  const stats = await api.stats();
  const recentLeads = DATA.leads.slice(0, 5);

  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">📥</div>
        <div class="stat-label">Всего заявок</div>
        <div class="stat-value">${stats.totalLeads}</div>
        <div class="stat-trend up">+${stats.weekLeads} за неделю</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⚡</div>
        <div class="stat-label">Новые</div>
        <div class="stat-value">${stats.newLeads}</div>
        <div class="stat-trend">требуют обработки</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📅</div>
        <div class="stat-label">Сегодня</div>
        <div class="stat-value">${stats.todayLeads}</div>
        <div class="stat-trend">новых заявок</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">👥</div>
        <div class="stat-label">Тренеры</div>
        <div class="stat-value">${stats.totalCoaches}</div>
        <div class="stat-trend">в команде</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📋</div>
        <div class="stat-label">Группы</div>
        <div class="stat-value">${stats.totalSchedule}</div>
        <div class="stat-trend">в расписании</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📰</div>
        <div class="stat-label">Публикации</div>
        <div class="stat-value">${stats.totalPosts}</div>
        <div class="stat-trend">в блоге</div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div>
          <h2>Последние заявки</h2>
          <p>5 самых свежих обращений с сайта</p>
        </div>
        <a href="#" data-nav="leads" class="btn btn-ghost btn-sm">Все заявки</a>
      </div>
      ${recentLeads.length ? renderLeadsTable(recentLeads, true) : '<div class="empty"><div class="icon">📭</div><h4>Заявок пока нет</h4></div>'}
    </div>
  `;

  el.querySelectorAll('[data-nav]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      document.querySelectorAll('[data-nav]').forEach(i => i.classList.remove('active'));
      document.querySelector(`[data-nav="${a.dataset.nav}"]`)?.classList.add('active');
      ACTIVE_TAB = a.dataset.nav;
      renderTab();
    });
  });
}

/* ============================================
   LEADS
   ============================================ */
function renderLeads(el) {
  el.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div>
          <h2>Все заявки (${DATA.leads.length})</h2>
          <p>Обращения через формы сайта</p>
        </div>
        <div class="card-actions">
          <select class="filter-leads" style="padding: 8px 12px; background: var(--black-3); border: 1px solid var(--glass-border); border-radius: 8px; color: var(--white); font-size: 0.85rem;">
            <option value="all">Все</option>
            <option value="new">Новые</option>
            <option value="contacted">Связались</option>
            <option value="done">Завершено</option>
            <option value="rejected">Отклонено</option>
          </select>
          <button class="btn btn-ghost btn-sm" onclick="exportLeads()">📥 Экспорт CSV</button>
        </div>
      </div>
      <div class="table-wrap" id="leads-table-wrap">
        ${renderLeadsTable(DATA.leads)}
      </div>
    </div>
  `;

  el.querySelector('.filter-leads').addEventListener('change', (e) => {
    const status = e.target.value;
    const filtered = status === 'all' ? DATA.leads : DATA.leads.filter(l => l.status === status);
    document.getElementById('leads-table-wrap').innerHTML = renderLeadsTable(filtered);
    bindLeadsActions();
  });

  bindLeadsActions();
}

function renderLeadsTable(leads, compact = false) {
  if (!leads.length) return '<div class="empty"><div class="icon">📭</div><h4>Заявок нет</h4></div>';
  return `
    <table class="table">
      <thead>
        <tr>
          <th>Клиент</th>
          <th>Контакт</th>
          ${compact ? '' : '<th>Направление</th>'}
          <th>Комментарий</th>
          <th>Дата</th>
          <th>Статус</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        ${leads.map(l => `
          <tr data-lead-id="${l.id}">
            <td>
              <div class="lead-name">${escapeHtml(l.name || '—')}</div>
              ${l.age ? `<div class="lead-meta">${l.age} лет</div>` : ''}
            </td>
            <td>
              <a href="tel:${l.phone}" class="lead-phone">${escapeHtml(l.phone || '—')}</a>
              ${l.email ? `<div class="lead-meta">${escapeHtml(l.email)}</div>` : ''}
            </td>
            ${compact ? '' : `<td>${escapeHtml(l.direction || l.time || '—')}</td>`}
            <td><div class="lead-comment">${escapeHtml(l.comment || l.message || '—')}</div></td>
            <td><div class="lead-meta">${formatDate(l.createdAt)}</div></td>
            <td>
              <select class="status-select" data-id="${l.id}" style="padding: 4px 8px; background: var(--black-3); border: 1px solid var(--glass-border); border-radius: 6px; color: var(--white); font-size: 0.78rem;">
                <option value="new" ${l.status === 'new' ? 'selected' : ''}>Новая</option>
                <option value="contacted" ${l.status === 'contacted' ? 'selected' : ''}>Связались</option>
                <option value="done" ${l.status === 'done' ? 'selected' : ''}>Завершено</option>
                <option value="rejected" ${l.status === 'rejected' ? 'selected' : ''}>Отклонено</option>
              </select>
            </td>
            <td>
              <button class="btn btn-icon" onclick="deleteLead(${l.id})" title="Удалить">🗑</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function bindLeadsActions() {
  document.querySelectorAll('.status-select').forEach(sel => {
    sel.onchange = async (e) => {
      const id = parseInt(e.target.dataset.id, 10);
      try {
        await api.updateLead(id, { status: e.target.value });
        const lead = DATA.leads.find(l => l.id === id);
        if (lead) lead.status = e.target.value;
        updateBadge();
        toast('Статус обновлён', 'success');
      } catch (err) {
        toast('Ошибка обновления', 'error');
      }
    };
  });
}

window.deleteLead = async function(id) {
  if (!confirm('Удалить заявку?')) return;
  try {
    await api.deleteLead(id);
    DATA.leads = DATA.leads.filter(l => l.id !== id);
    updateBadge();
    renderTab();
    toast('Заявка удалена', 'success');
  } catch (err) {
    toast('Ошибка удаления', 'error');
  }
};

window.exportLeads = function() {
  const rows = [['Имя', 'Телефон', 'Email', 'Направление', 'Возраст', 'Комментарий', 'Дата', 'Статус']];
  DATA.leads.forEach(l => {
    rows.push([l.name, l.phone, l.email || '', l.direction || '', l.age || '', l.comment || l.message || '', l.createdAt, l.status]);
  });
  const csv = '\ufeff' + rows.map(r => r.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('CSV экспортирован', 'success');
};

/* ============================================
   COACHES
   ============================================ */
function renderCoaches(el) {
  el.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div>
          <h2>Тренеры (${DATA.coaches.length})</h2>
          <p>Команда клуба</p>
        </div>
        <div class="card-actions">
          <button class="btn btn-primary" onclick="openCoachModal()">+ Добавить</button>
        </div>
      </div>
      <div class="table-wrap">
        ${renderCoachesTable()}
      </div>
    </div>
  `;
}

function renderCoachesTable() {
  if (!DATA.coaches.length) return '<div class="empty"><div class="icon">👥</div><h4>Нет тренеров</h4></div>';
  return `
    <table class="table">
      <thead>
        <tr>
          <th></th>
          <th>Тренер</th>
          <th>Специализация</th>
          <th>Достижения</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        ${DATA.coaches.map(c => `
          <tr>
            <td>
              <div style="width: 44px; height: 44px; border-radius: 8px; overflow: hidden; background: var(--black-3); display: flex; align-items: center; justify-content: center; font-size: 1.4rem;">
                ${c.photo ? `<img src="${c.photo}" style="width:100%;height:100%;object-fit:cover">` : (c.emoji || '👤')}
              </div>
            </td>
            <td>
              <div class="lead-name">${escapeHtml(c.name)}</div>
              <div class="lead-meta">${escapeHtml(c.bio || '').slice(0, 60)}...</div>
            </td>
            <td>${escapeHtml(c.role)}</td>
            <td>
              <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                ${(c.achievements || []).slice(0, 3).map(a => `<span class="status" style="background: var(--glass); color: var(--gray);">${escapeHtml(a)}</span>`).join('')}
              </div>
            </td>
            <td>
              <button class="btn btn-icon" onclick='openCoachModal(${JSON.stringify(c).replace(/'/g, "&apos;")})' title="Редактировать">✎</button>
              <button class="btn btn-icon" onclick="deleteCoach(${c.id})" title="Удалить">🗑</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

window.openCoachModal = function(coach = null) {
  const isEdit = !!coach;
  const photo = coach?.photo || '';
  showModal(`
    <h3>${isEdit ? 'Редактировать' : 'Новый'} тренер</h3>
    <form id="coach-form">
      <div class="form-group">
        <label>Фото тренера</label>
        <div class="photo-uploader">
          <div class="preview" id="coach-photo-preview">
            ${photo ? `<img src="${photo}" alt="">` : (coach?.emoji || '👤')}
          </div>
          <div style="flex: 1;">
            <input type="file" id="coach-photo-input" accept="image/*" style="display:none">
            <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('coach-photo-input').click()">📤 Загрузить фото</button>
            ${photo ? '<button type="button" class="btn btn-danger btn-sm" onclick="clearCoachPhoto()">Удалить</button>' : ''}
            <input type="hidden" name="photo" id="coach-photo-url" value="${photo}">
            <div class="form-help">JPG/PNG, желательно 600×800 (портрет)</div>
          </div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Имя</label>
          <input name="name" required value="${coach?.name || ''}">
        </div>
        <div class="form-group">
          <label>Эмодзи (если без фото)</label>
          <input name="emoji" value="${coach?.emoji || '👊'}" maxlength="2">
        </div>
      </div>
      <div class="form-group">
        <label>Специализация</label>
        <input name="role" required value="${coach?.role || ''}" placeholder="Тренер · Кудо, ММА">
      </div>
      <div class="form-group">
        <label>Биография</label>
        <textarea name="bio">${coach?.bio || ''}</textarea>
      </div>
      <div class="form-group">
        <label>Достижения (каждое с новой строки)</label>
        <textarea name="achievements">${(coach?.achievements || []).join('\n')}</textarea>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Отмена</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Сохранить' : 'Добавить'}</button>
      </div>
    </form>
  `);

  // Photo upload handler
  const photoInput = document.getElementById('coach-photo-input');
  photoInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await api.uploadFile(file, 'coaches');
      document.getElementById('coach-photo-url').value = data.file.url;
      const prev = document.getElementById('coach-photo-preview');
      prev.innerHTML = `<img src="${data.file.url}" alt="">`;
      // Add to media library
      try {
        const created = await api.addMedia({
          url: data.file.url,
          filename: data.file.filename,
          originalName: data.file.originalName,
          size: data.file.size,
          mime: data.file.mime,
          type: data.file.type,
          category: 'trainer',
          title: `Тренер: ${data.file.originalName}`
        });
        DATA.media.unshift(created);
      } catch (e) { /* non-fatal */ }
      toast('Фото загружено', 'success');
    } catch (err) {
      toast('Ошибка загрузки фото: ' + err.message, 'error');
    }
  });

  document.getElementById('coach-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      name: fd.get('name'),
      role: fd.get('role'),
      bio: fd.get('bio'),
      emoji: fd.get('emoji'),
      photo: fd.get('photo'),
      achievements: (fd.get('achievements') || '').toString().split('\n').map(s => s.trim()).filter(Boolean)
    };
    try {
      if (isEdit) {
        const updated = await api.updateCoach(coach.id, data);
        const idx = DATA.coaches.findIndex(c => c.id === coach.id);
        DATA.coaches[idx] = updated;
        toast('Тренер обновлён', 'success');
      } else {
        const created = await api.addCoach(data);
        DATA.coaches.push(created);
        toast('Тренер добавлен', 'success');
      }
      closeModal();
      renderTab();
    } catch (err) {
      toast('Ошибка сохранения', 'error');
    }
  };
};

window.clearCoachPhoto = function() {
  document.getElementById('coach-photo-url').value = '';
  document.getElementById('coach-photo-preview').innerHTML = '👤';
};

window.deleteCoach = async function(id) {
  if (!confirm('Удалить тренера?')) return;
  try {
    await api.deleteCoach(id);
    DATA.coaches = DATA.coaches.filter(c => c.id !== id);
    renderTab();
    toast('Тренер удалён', 'success');
  } catch (err) {
    toast('Ошибка удаления', 'error');
  }
};

/* ============================================
   SCHEDULE
   ============================================ */
function renderSchedule(el) {
  el.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div>
          <h2>Расписание (${DATA.schedule.length} групп)</h2>
          <p>Тренировки по дням недели</p>
        </div>
        <div class="card-actions">
          <button class="btn btn-primary" onclick="openScheduleModal()">+ Добавить группу</button>
        </div>
      </div>
      <div class="table-wrap">
        ${renderScheduleTable()}
      </div>
    </div>
  `;
}

function renderScheduleTable() {
  if (!DATA.schedule.length) return '<div class="empty"><div class="icon">📅</div><h4>Расписание пустое</h4></div>';
  const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  return `
    <table class="table">
      <thead>
        <tr>
          <th>День</th>
          <th>Время</th>
          <th>Группа</th>
          <th>Тренер</th>
          <th>Категория</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        ${[...DATA.schedule].sort((a, b) => days.indexOf(a.day) - days.indexOf(b.day) || a.time.localeCompare(b.time)).map(s => `
          <tr>
            <td><span class="status" style="background: var(--red); color: var(--white);">${s.day}</span></td>
            <td class="lead-phone">${escapeHtml(s.time)}</td>
            <td><div class="lead-name">${escapeHtml(s.class)}</div></td>
            <td>${escapeHtml(s.coach)}</td>
            <td><div class="lead-meta">${escapeHtml(s.category)}</div></td>
            <td>
              <button class="btn btn-icon" onclick='openScheduleModal(${JSON.stringify(s).replace(/'/g, "&apos;")})' title="Редактировать">✎</button>
              <button class="btn btn-icon" onclick="deleteSchedule(${s.id})" title="Удалить">🗑</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

window.openScheduleModal = function(item = null) {
  const isEdit = !!item;
  showModal(`
    <h3>${isEdit ? 'Редактировать' : 'Новая'} группа</h3>
    <form id="schedule-form">
      <div class="form-row-3">
        <div class="form-group">
          <label>День недели</label>
          <select name="day" required>
            ${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => `<option ${item?.day === d ? 'selected' : ''}>${d}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Время</label>
          <input name="time" required value="${item?.time || ''}" placeholder="19:00 — 20:30">
        </div>
        <div class="form-group">
          <label>Категория</label>
          <input name="category" value="${item?.category || ''}" placeholder="kudo adults">
        </div>
      </div>
      <div class="form-group">
        <label>Группа / название</label>
        <input name="class" required value="${item?.class || ''}" placeholder="Кудо · Взрослые">
      </div>
      <div class="form-group">
        <label>Тренер</label>
        <input name="coach" required value="${item?.coach || ''}" placeholder="Алексей Волков">
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Отмена</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Сохранить' : 'Добавить'}</button>
      </div>
    </form>
  `);

  document.getElementById('schedule-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      day: fd.get('day'),
      time: fd.get('time'),
      class: fd.get('class'),
      coach: fd.get('coach'),
      category: fd.get('category')
    };
    try {
      if (isEdit) {
        const updated = await api.updateSchedule(item.id, data);
        const idx = DATA.schedule.findIndex(s => s.id === item.id);
        DATA.schedule[idx] = updated;
        toast('Группа обновлена', 'success');
      } else {
        const created = await api.addSchedule(data);
        DATA.schedule.push(created);
        toast('Группа добавлена', 'success');
      }
      closeModal();
      renderTab();
    } catch (err) {
      toast('Ошибка сохранения', 'error');
    }
  };
};

window.deleteSchedule = async function(id) {
  if (!confirm('Удалить группу из расписания?')) return;
  try {
    await api.deleteSchedule(id);
    DATA.schedule = DATA.schedule.filter(s => s.id !== id);
    renderTab();
    toast('Группа удалена', 'success');
  } catch (err) {
    toast('Ошибка удаления', 'error');
  }
};

/* ============================================
   PRICING
   ============================================ */
function renderPricing(el) {
  el.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div>
          <h2>Тарифы (${DATA.pricing.length})</h2>
          <p>Абонементы и цены клуба</p>
        </div>
        <div class="card-actions">
          <button class="btn btn-primary" onclick="addPricing()">+ Добавить тариф</button>
        </div>
      </div>
      <div id="pricing-list">
        ${renderPricingCards()}
      </div>
    </div>
  `;
}

function renderPricingCards() {
  return DATA.pricing.map((p, i) => `
    <div class="card" style="background: ${p.featured ? 'rgba(225, 6, 0, 0.04)' : 'var(--black-3)'}; border-color: ${p.featured ? 'var(--red)' : 'var(--glass-border)'};">
      <div class="card-head">
        <div>
          <h2>${escapeHtml(p.name)} ${p.featured ? '⭐' : ''}</h2>
          <p>${escapeHtml(p.description || '')}</p>
        </div>
        <div class="card-actions">
          <button class="btn btn-icon" onclick='editPricing(${i})' title="Редактировать">✎</button>
          <button class="btn btn-icon" onclick="deletePricing(${i})" title="Удалить">🗑</button>
        </div>
      </div>
      <div class="form-row" style="grid-template-columns: 1fr 2fr;">
        <div class="form-group">
          <label>Цена (₽/мес)</label>
          <input type="number" value="${p.price}" onchange="updatePricingField(${i}, 'price', parseInt(this.value))">
        </div>
        <div class="form-group">
          <label>Название</label>
          <input value="${escapeHtml(p.name)}" onchange="updatePricingField(${i}, 'name', this.value)">
        </div>
      </div>
      <div class="form-group">
        <label>Описание</label>
        <input value="${escapeHtml(p.description || '')}" onchange="updatePricingField(${i}, 'description', this.value)">
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" ${p.featured ? 'checked' : ''} onchange="updatePricingField(${i}, 'featured', this.checked)">
          Популярный тариф
        </label>
      </div>
      <div class="form-group">
        <label>Возможности (по строкам, без ✓ — отключено)</label>
        <textarea onchange="updatePricingFeatures(${i}, this.value)" rows="6">${(p.features || []).map(f => (f.enabled === false ? '× ' : '✓ ') + f.text).join('\n')}</textarea>
      </div>
    </div>
  `).join('');
}

window.updatePricingField = function(i, key, value) {
  DATA.pricing[i][key] = value;
  savePricing();
};

window.updatePricingFeatures = function(i, value) {
  DATA.pricing[i].features = value.split('\n').filter(Boolean).map(line => {
    if (line.startsWith('× ')) return { text: line.slice(2), enabled: false };
    if (line.startsWith('✓ ')) return { text: line.slice(2), enabled: true };
    return { text: line, enabled: true };
  });
  savePricing();
};

async function savePricing() {
  try {
    await api.savePricing(DATA.pricing);
    toast('Тариф сохранён', 'success');
  } catch (err) {
    toast('Ошибка сохранения', 'error');
  }
}

window.addPricing = function() {
  DATA.pricing.push({
    name: 'НОВЫЙ',
    description: 'Описание',
    price: 0,
    featured: false,
    features: []
  });
  savePricing();
  renderTab();
};

window.editPricing = function(i) {
  // Already inline-editable
  document.querySelectorAll('.card input, .card textarea').forEach(el => el.focus());
};

window.deletePricing = async function(i) {
  if (!confirm('Удалить тариф?')) return;
  DATA.pricing.splice(i, 1);
  await savePricing();
  renderTab();
  toast('Тариф удалён', 'success');
};

/* ============================================
   BLOG
   ============================================ */
function renderBlog(el) {
  el.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div>
          <h2>Публикации (${DATA.blog.length})</h2>
          <p>Новости, статьи, отчёты</p>
        </div>
        <div class="card-actions">
          <button class="btn btn-primary" onclick="openPostModal()">+ Новая запись</button>
        </div>
      </div>
      <div class="table-wrap">
        ${renderPostsTable()}
      </div>
    </div>
  `;
}

function renderPostsTable() {
  if (!DATA.blog.length) return '<div class="empty"><div class="icon">📰</div><h4>Нет публикаций</h4></div>';
  return `
    <table class="table">
      <thead>
        <tr>
          <th>Заголовок</th>
          <th>Категория</th>
          <th>Дата</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        ${DATA.blog.map(p => `
          <tr>
            <td>
              <div class="lead-name">${p.emoji || '📄'} ${escapeHtml(p.title)}</div>
              <div class="lead-meta">${escapeHtml(p.excerpt || '').slice(0, 80)}</div>
            </td>
            <td><span class="status" style="background: var(--glass); color: var(--gray);">${escapeHtml(p.category)}</span></td>
            <td><div class="lead-meta">${formatDate(p.date)}</div></td>
            <td>
              <button class="btn btn-icon" onclick='openPostModal(${JSON.stringify(p).replace(/'/g, "&apos;")})' title="Редактировать">✎</button>
              <button class="btn btn-icon" onclick="deletePost(${p.id})" title="Удалить">🗑</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

window.openPostModal = function(post = null) {
  const isEdit = !!post;
  const cover = post?.cover || '';
  showModal(`
    <h3>${isEdit ? 'Редактировать' : 'Новая'} публикация</h3>
    <form id="post-form">
      <div class="form-group">
        <label>Обложка (опционально)</label>
        <div class="photo-uploader">
          <div class="preview" id="post-cover-preview">
            ${cover ? `<img src="${cover}" alt="">` : '🖼'}
          </div>
          <div style="flex:1">
            <input type="file" id="post-cover-input" accept="image/*" style="display:none">
            <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('post-cover-input').click()">📤 Загрузить обложку</button>
            ${cover ? '<button type="button" class="btn btn-danger btn-sm" onclick="clearPostCover()">Удалить</button>' : ''}
            <input type="hidden" name="cover" id="post-cover-url" value="${cover}">
            <div class="form-help">JPG/PNG, 16:10, минимум 800×500</div>
          </div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Заголовок</label>
          <input name="title" required value="${post?.title || ''}">
        </div>
        <div class="form-group">
          <label>Категория</label>
          <input name="category" value="${post?.category || 'Новости'}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Дата</label>
          <input type="date" name="date" value="${(post?.date || new Date().toISOString().slice(0, 10))}">
        </div>
        <div class="form-group">
          <label>Эмодзи (если без обложки)</label>
          <input name="emoji" value="${post?.emoji || '🏆'}" maxlength="2">
        </div>
      </div>
      <div class="form-group">
        <label>Краткое описание</label>
        <textarea name="excerpt" rows="4">${post?.excerpt || ''}</textarea>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Отмена</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Сохранить' : 'Опубликовать'}</button>
      </div>
    </form>
  `);

  document.getElementById('post-cover-input').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await api.uploadFile(file, 'photos');
      document.getElementById('post-cover-url').value = data.file.url;
      document.getElementById('post-cover-preview').innerHTML = `<img src="${data.file.url}" alt="">`;
      // Add to media library
      try {
        const created = await api.addMedia({
          url: data.file.url,
          filename: data.file.filename,
          originalName: data.file.originalName,
          size: data.file.size,
          mime: data.file.mime,
          type: data.file.type,
          category: 'gallery',
          title: `Обложка: ${data.file.originalName}`
        });
        DATA.media.unshift(created);
      } catch (e) { /* non-fatal */ }
      toast('Обложка загружена', 'success');
    } catch (err) {
      toast('Ошибка загрузки: ' + err.message, 'error');
    }
  });

  document.getElementById('post-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      title: fd.get('title'),
      category: fd.get('category'),
      date: fd.get('date'),
      emoji: fd.get('emoji'),
      excerpt: fd.get('excerpt'),
      cover: fd.get('cover'),
      published: true
    };
    try {
      if (isEdit) {
        const updated = await api.updatePost(post.id, data);
        const idx = DATA.blog.findIndex(p => p.id === post.id);
        DATA.blog[idx] = updated;
        toast('Публикация обновлена', 'success');
      } else {
        const created = await api.addPost(data);
        DATA.blog.unshift(created);
        toast('Публикация добавлена', 'success');
      }
      closeModal();
      renderTab();
    } catch (err) {
      toast('Ошибка сохранения', 'error');
    }
  };
};

window.clearPostCover = function() {
  document.getElementById('post-cover-url').value = '';
  document.getElementById('post-cover-preview').innerHTML = '🖼';
};

window.deletePost = async function(id) {
  if (!confirm('Удалить публикацию?')) return;
  try {
    await api.deletePost(id);
    DATA.blog = DATA.blog.filter(p => p.id !== id);
    renderTab();
    toast('Публикация удалена', 'success');
  } catch (err) {
    toast('Ошибка удаления', 'error');
  }
};

/* ============================================
   SETTINGS
   ============================================ */
function renderSettings(el) {
  const s = DATA.settings;
  const st = DATA.stats;
  const h = DATA.hero;
  el.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div>
          <h2>Контактная информация</h2>
          <p>Основные данные клуба</p>
        </div>
      </div>
      <form id="settings-form">
        <div class="form-row">
          <div class="form-group">
            <label>Название сайта</label>
            <input name="siteName" value="${escapeHtml(s.siteName)}">
          </div>
          <div class="form-group">
            <label>Слоган</label>
            <input name="tagline" value="${escapeHtml(s.tagline)}">
          </div>
        </div>
        <div class="form-group">
          <label>Адрес</label>
          <input name="address" value="${escapeHtml(s.address)}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Телефон основной</label>
            <input name="phone" value="${escapeHtml(s.phone)}">
          </div>
          <div class="form-group">
            <label>Телефон доп.</label>
            <input name="phone2" value="${escapeHtml(s.phone2)}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Email</label>
            <input name="email" value="${escapeHtml(s.email)}">
          </div>
          <div class="form-group">
            <label>Режим работы</label>
            <input name="workHours" value="${escapeHtml(s.workHours)}">
          </div>
        </div>
        <div class="form-group">
          <label>ВКонтакте (URL)</label>
          <input name="vk" value="${escapeHtml(s.socials.vk)}">
        </div>
        <div class="form-group">
          <label>Telegram (URL)</label>
          <input name="telegram" value="${escapeHtml(s.socials.telegram)}">
        </div>
        <div class="form-group">
          <label>WhatsApp (URL)</label>
          <input name="whatsapp" value="${escapeHtml(s.socials.whatsapp)}">
        </div>
      </form>
    </div>

    <div class="card">
      <div class="card-head">
        <div>
          <h2>Главный экран</h2>
          <p>Заголовок и подзаголовок на главной странице</p>
        </div>
      </div>
      <form id="hero-form">
        <div class="form-group">
          <label>Заголовок</label>
          <input name="title" value="${escapeHtml(h.title)}">
        </div>
        <div class="form-group">
          <label>Подзаголовок</label>
          <textarea name="subtitle" rows="3">${escapeHtml(h.subtitle)}</textarea>
        </div>
        <div class="form-group">
          <label>Метка-тег</label>
          <input name="tag" value="${escapeHtml(h.tag)}">
        </div>
      </form>
    </div>

    <div class="card">
      <div class="card-head">
        <div>
          <h2>Статистика клуба</h2>
          <p>Цифры на главной странице</p>
        </div>
      </div>
      <form id="stats-form">
        <div class="form-row-3">
          <div class="form-group">
            <label>Лет на рынке</label>
            <input type="number" name="years" value="${st.years}">
          </div>
          <div class="form-group">
            <label>Учеников</label>
            <input type="number" name="students" value="${st.students}">
          </div>
          <div class="form-group">
            <label>Наград</label>
            <input type="number" name="awards" value="${st.awards}">
          </div>
        </div>
      </form>
    </div>

    <div class="card" style="display: flex; justify-content: flex-end;">
      <button class="btn btn-primary" onclick="saveAllSettings()">💾 Сохранить все изменения</button>
    </div>
  `;
}

window.saveAllSettings = async function() {
  const sForm = document.getElementById('settings-form');
  const hForm = document.getElementById('hero-form');
  const stForm = document.getElementById('stats-form');
  const sData = Object.fromEntries(new FormData(sForm).entries());
  const hData = Object.fromEntries(new FormData(hForm).entries());
  const stData = Object.fromEntries(new FormData(stForm).entries());

  const payload = {
    settings: {
      siteName: sData.siteName,
      tagline: sData.tagline,
      address: sData.address,
      phone: sData.phone,
      phone2: sData.phone2,
      email: sData.email,
      workHours: sData.workHours,
      socials: {
        vk: sData.vk,
        telegram: sData.telegram,
        whatsapp: sData.whatsapp,
        youtube: DATA.settings.socials.youtube
      }
    },
    hero: hData,
    stats: {
      years: parseInt(stData.years) || 0,
      students: parseInt(stData.students) || 0,
      awards: parseInt(stData.awards) || 0
    }
  };

  try {
    await api.saveSettings(payload);
    DATA.settings = payload.settings;
    DATA.hero = payload.hero;
    DATA.stats = payload.stats;
    toast('Настройки сохранены', 'success');
  } catch (err) {
    toast('Ошибка сохранения', 'error');
  }
};

/* ============================================
   MODAL
   ============================================ */
function showModal(html) {
  const overlay = document.getElementById('modal-overlay');
  document.getElementById('modal-content').innerHTML = html;
  overlay.classList.add('open');
}

window.closeModal = function() {
  document.getElementById('modal-overlay').classList.remove('open');
};

document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'modal-overlay') closeModal();
});

/* ============================================
   MEDIA LIBRARY
   ============================================ */
let MEDIA_FILTER = 'all';

function renderMedia(el) {
  el.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div>
          <h2>Медиа-библиотека (${DATA.media.length})</h2>
          <p>Фото и видео для использования на сайте</p>
        </div>
        <div class="card-actions">
          <select class="media-filter" style="padding: 8px 12px; background: var(--black-3); border: 1px solid var(--glass-border); border-radius: 8px; color: var(--white); font-size: 0.85rem;">
            <option value="all">Все</option>
            <option value="image">Фото</option>
            <option value="video">Видео</option>
            <option value="gallery">Галерея</option>
            <option value="branding">Брендинг</option>
            <option value="trainer">Тренеры</option>
          </select>
        </div>
      </div>

      <label class="upload-zone" id="upload-zone">
        <div class="icon">⬆</div>
        <h4>Загрузить файл</h4>
        <p>Кликните или перетащите фото/видео (до 50 МБ)</p>
        <input type="file" id="media-file-input" accept="image/*,video/*" multiple>
      </label>

      <div class="upload-progress" id="upload-progress">
        <div class="progress-bar"><div id="progress-fill"></div></div>
        <div class="progress-text" id="progress-text">Загрузка…</div>
      </div>

      <div class="media-grid" id="media-grid"></div>
    </div>
  `;

  bindMediaUploader();
  bindMediaFilter();
  drawMediaGrid();
}

function bindMediaUploader() {
  const input = document.getElementById('media-file-input');
  const zone = document.getElementById('upload-zone');

  input.addEventListener('change', (e) => {
    if (e.target.files?.length) uploadFiles(Array.from(e.target.files));
    e.target.value = '';
  });

  ['dragenter', 'dragover'].forEach(ev => {
    zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('dragover'); });
  });
  ['dragleave', 'drop'].forEach(ev => {
    zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove('dragover'); });
  });
  zone.addEventListener('drop', e => {
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) uploadFiles(files);
  });
}

async function uploadFiles(files) {
  const progress = document.getElementById('upload-progress');
  const fill = document.getElementById('progress-fill');
  const text = document.getElementById('progress-text');
  progress.classList.add('show');

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    text.textContent = `Загрузка ${i + 1}/${files.length}: ${f.name}`;
    try {
      const result = await api.uploadFile(f, 'photos');
      const file = result.file;
      // Add to library
      const created = await api.addMedia({
        url: file.url,
        filename: file.filename,
        originalName: file.originalName,
        size: file.size,
        mime: file.mime,
        type: file.type,
        category: 'gallery',
        title: file.originalName
      });
      DATA.media.unshift(created);
      fill.style.width = `${((i + 1) / files.length) * 100}%`;
      toast(`✓ ${file.originalName}`, 'success');
    } catch (err) {
      toast(`Ошибка ${f.name}: ${err.message}`, 'error');
    }
  }
  setTimeout(() => progress.classList.remove('show'), 1500);
  fill.style.width = '0%';
  drawMediaGrid();
  renderTabHeader();
}

function bindMediaFilter() {
  document.querySelector('.media-filter').addEventListener('change', e => {
    MEDIA_FILTER = e.target.value;
    drawMediaGrid();
  });
}

function drawMediaGrid() {
  const grid = document.getElementById('media-grid');
  if (!grid) return;
  const items = DATA.media.filter(m => {
    if (MEDIA_FILTER === 'all') return true;
    if (MEDIA_FILTER === 'image' || MEDIA_FILTER === 'video') return m.type === MEDIA_FILTER;
    return m.category === MEDIA_FILTER;
  });

  if (!items.length) {
    grid.innerHTML = '<div class="empty" style="grid-column: 1/-1;"><div class="icon">🖼</div><h4>Нет медиафайлов</h4><p>Загрузите первые фото</p></div>';
    return;
  }

  grid.innerHTML = items.map(m => `
    <div class="media-item" data-id="${m.id}">
      ${m.type === 'video'
        ? `<video src="${m.url}" muted></video>`
        : (m.url ? `<img src="${m.url}" alt="${escapeHtml(m.title || m.filename)}" loading="lazy">` : `<div class="placeholder">🖼</div>`)}
      <span class="badge-type ${m.type}">${m.type === 'video' ? '▶ ВИДЕО' : '📷 ФОТО'}</span>
      <div class="actions">
        <button onclick="event.stopPropagation(); openLightbox('${m.url}', '${m.type}')" title="Открыть">🔍</button>
        <button onclick="event.stopPropagation(); copyMediaUrl('${m.url}')" title="Копировать URL">🔗</button>
        <button onclick="event.stopPropagation(); deleteMedia(${m.id})" title="Удалить">🗑</button>
      </div>
      <div class="info">
        <span class="name">${escapeHtml(m.originalName || m.filename)}</span>
        <span>${formatSize(m.size)}</span>
      </div>
    </div>
  `).join('');
}

function renderTabHeader() {
  const h = document.querySelector('.card-head h2');
  if (h) h.textContent = `Медиа-библиотека (${DATA.media.length})`;
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' Б';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
  return (bytes / 1024 / 1024).toFixed(1) + ' МБ';
}

window.copyMediaUrl = function(url) {
  navigator.clipboard.writeText(window.location.origin + url);
  toast('URL скопирован', 'success');
};

window.openLightbox = function(url, type) {
  const lb = document.getElementById('lightbox') || (() => {
    const d = document.createElement('div');
    d.id = 'lightbox';
    d.className = 'lightbox';
    d.onclick = () => d.classList.remove('open');
    document.body.appendChild(d);
    return d;
  })();
  lb.innerHTML = type === 'video' ? `<video src="${url}" controls autoplay></video>` : `<img src="${url}" alt="">`;
  lb.classList.add('open');
};

window.deleteMedia = async function(id) {
  if (!confirm('Удалить файл? Это действие необратимо.')) return;
  try {
    await api.deleteMedia(id);
    DATA.media = DATA.media.filter(m => m.id !== id);
    drawMediaGrid();
    renderTabHeader();
    toast('Удалено', 'success');
  } catch (err) {
    toast('Ошибка удаления', 'error');
  }
};

/* ============================================
   BRANDING
   ============================================ */
function renderBranding(el) {
  const b = DATA.branding || {};
  el.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div>
          <h2>Брендинг сайта</h2>
          <p>Логотип, фавикон, изображение главного экрана</p>
        </div>
      </div>

      <div class="brand-block">
        <div class="brand-preview logo-preview" id="preview-logo">
          ${b.logo ? `<img src="${b.logo}" alt="Логотип">` : `<div class="placeholder">Нет логотипа</div>`}
        </div>
        <div class="brand-meta">
          <h4>Логотип</h4>
          <p>Используется в шапке и подвале сайта. PNG / SVG, прозрачный фон.</p>
          <div class="upload-row">
            <input type="file" id="logo-input" accept="image/*">
            <button class="btn btn-primary btn-sm" onclick="document.getElementById('logo-input').click()">📤 Загрузить</button>
            ${b.logo ? '<button class="btn btn-danger btn-sm" onclick="clearBrand(\'logo\')">Удалить</button>' : ''}
          </div>
        </div>
      </div>

      <div class="brand-block">
        <div class="brand-preview" id="preview-heroImage">
          ${b.heroImage ? `<img src="${b.heroImage}" alt="Hero">` : `<div class="placeholder">Нет hero-изображения.<br>Используется градиент.</div>`}
        </div>
        <div class="brand-meta">
          <h4>Hero-изображение</h4>
          <p>Фон главного экрана. JPG / PNG, 16:9 или шире. 1920×1080+ рекомендуется.</p>
          <div class="upload-row">
            <input type="file" id="hero-input" accept="image/*">
            <button class="btn btn-primary btn-sm" onclick="document.getElementById('hero-input').click()">📤 Загрузить</button>
            ${b.heroImage ? '<button class="btn btn-danger btn-sm" onclick="clearBrand(\'heroImage\')">Удалить</button>' : ''}
          </div>
        </div>
      </div>

      <div class="brand-block">
        <div class="brand-preview" id="preview-heroVideo">
          ${b.heroVideo ? `<video src="${b.heroVideo}" autoplay muted loop></video>` : `<div class="placeholder">Нет видео.<br>Используется статичный фон.</div>`}
        </div>
        <div class="brand-meta">
          <h4>Hero-видео (опционально)</h4>
          <p>Зацикленное видео на фоне главного экрана. MP4, до 20 МБ. Автозапуск без звука.</p>
          <div class="upload-row">
            <input type="file" id="heroVideo-input" accept="video/*">
            <button class="btn btn-primary btn-sm" onclick="document.getElementById('heroVideo-input').click()">🎬 Загрузить видео</button>
            ${b.heroVideo ? '<button class="btn btn-danger btn-sm" onclick="clearBrand(\'heroVideo\')">Удалить</button>' : ''}
          </div>
        </div>
      </div>

      <div class="brand-block">
        <div class="brand-preview favicon-preview" id="preview-favicon">
          ${b.favicon ? `<img src="${b.favicon}" alt="Favicon">` : `<div class="placeholder">Нет favicon</div>`}
        </div>
        <div class="brand-meta">
          <h4>Favicon (иконка вкладки)</h4>
          <p>Маленькая иконка 32×32 или 64×64. PNG / ICO / SVG.</p>
          <div class="upload-row">
            <input type="file" id="favicon-input" accept="image/*,.ico">
            <button class="btn btn-primary btn-sm" onclick="document.getElementById('favicon-input').click()">📤 Загрузить</button>
            ${b.favicon ? '<button class="btn btn-danger btn-sm" onclick="clearBrand(\'favicon\')">Удалить</button>' : ''}
          </div>
        </div>
      </div>

      <div class="brand-block">
        <div class="brand-preview" id="preview-ogImage">
          ${b.ogImage ? `<img src="${b.ogImage}" alt="OG">` : `<div class="placeholder">Нет OG-картинки</div>`}
        </div>
        <div class="brand-meta">
          <h4>OG-картинка (для соцсетей)</h4>
          <p>Превью при шеринге в VK, Telegram, WhatsApp. 1200×630, JPG/PNG.</p>
          <div class="upload-row">
            <input type="file" id="ogImage-input" accept="image/*">
            <button class="btn btn-primary btn-sm" onclick="document.getElementById('ogImage-input').click()">📤 Загрузить</button>
            ${b.ogImage ? '<button class="btn btn-danger btn-sm" onclick="clearBrand(\'ogImage\')">Удалить</button>' : ''}
          </div>
        </div>
      </div>
    </div>
  `;

  ['logo', 'heroImage', 'heroVideo', 'favicon', 'ogImage'].forEach(key => {
    const input = document.getElementById(`${key}-input`);
    if (!input) return;
    input.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const folder = key === 'logo' || key === 'favicon' || key === 'ogImage' || key === 'heroImage' || key === 'heroVideo' ? 'branding' : 'photos';
      try {
        const data = await api.uploadFile(file, folder);
        await api.saveBranding({ [key]: data.file.url });
        DATA.branding[key] = data.file.url;
        // Also add to media library for visibility
        try {
          const created = await api.addMedia({
            url: data.file.url,
            filename: data.file.filename,
            originalName: data.file.originalName,
            size: data.file.size,
            mime: data.file.mime,
            type: data.file.type,
            category: 'branding',
            title: `${key}: ${data.file.originalName}`
          });
          DATA.media.unshift(created);
        } catch (e) { /* non-fatal */ }
        renderBranding(el);
        toast(`${key} обновлён`, 'success');
      } catch (err) {
        toast('Ошибка загрузки: ' + err.message, 'error');
      }
    });
  });
}

window.clearBrand = async function(key) {
  if (!confirm('Удалить?')) return;
  try {
    await api.saveBranding({ [key]: '' });
    DATA.branding[key] = '';
    renderBranding(document.getElementById('main-content'));
    toast('Удалено', 'success');
  } catch (err) {
    toast('Ошибка', 'error');
  }
};

/* ============================================
   PAGE TEXTS
   ============================================ */
let CURRENT_TEXT_SECTION = 'home';

function renderTexts(el) {
  const sections = {
    home: 'Главная',
    about: 'О клубе',
    directions: 'Направления',
    contacts: 'Контакты',
    gallery: 'Галерея'
  };

  el.innerHTML = `
    <div class="tabs" id="text-tabs">
      ${Object.entries(sections).map(([k, v]) => `<button class="tab ${k === CURRENT_TEXT_SECTION ? 'active' : ''}" data-section="${k}">${v}</button>`).join('')}
    </div>
    <div class="card" id="text-editor"></div>
  `;

  el.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => {
      CURRENT_TEXT_SECTION = t.dataset.section;
      el.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      drawTextEditor();
    });
  });

  drawTextEditor();
}

function drawTextEditor() {
  const wrap = document.getElementById('text-editor');
  if (!wrap) return;
  const data = (DATA.pageContent || {})[CURRENT_TEXT_SECTION] || {};
  const fields = textFieldDefs[CURRENT_TEXT_SECTION]?.fields || [];

  console.log('drawTextEditor:', CURRENT_TEXT_SECTION, 'fields:', fields.length);

  if (!fields.length) {
    wrap.innerHTML = `<div class="empty"><div class="icon">⚠</div><h4>Раздел «${CURRENT_TEXT_SECTION}» не найден</h4><p>Доступные: ${Object.keys(textFieldDefs).join(', ')}</p></div>`;
    return;
  }

  wrap.innerHTML = `
    <div class="card-head">
      <div>
        <h2>${textFieldDefs[CURRENT_TEXT_SECTION]?.title || 'Тексты'}</h2>
        <p>Изменения сохраняются по кнопке «Сохранить»</p>
      </div>
      <div class="card-actions">
        <button class="btn btn-primary" onclick="saveTextSection()">💾 Сохранить</button>
      </div>
    </div>
    ${fields.map(f => renderTextField(f, data[f.key])).join('')}
  `;
}

function renderTextField(f, value) {
  const v = value || '';
  if (f.type === 'textarea') {
    return `
      <div class="form-group">
        <label>${f.label}</label>
        <textarea name="${f.key}" rows="${f.rows || 3}" ${f.required ? 'required' : ''}>${escapeHtml(v)}</textarea>
        ${f.help ? `<div class="form-help">${f.help}</div>` : ''}
      </div>
    `;
  }
  if (f.type === 'select-coach') {
    const opts = (DATA.coaches || []).map(c =>
      `<option value="${c.id}" ${String(c.id) === String(v) ? 'selected' : ''}>${escapeHtml(c.name)} — ${escapeHtml(c.role)}</option>`
    ).join('');
    return `
      <div class="form-group">
        <label>${f.label}</label>
        <select name="${f.key}">
          <option value="">— по умолчанию (первый с «главн» в роли) —</option>
          ${opts}
        </select>
        ${f.help ? `<div class="form-help">${f.help}</div>` : '<div class="form-help">Выберите тренера для блока на главной странице</div>'}
      </div>
    `;
  }
  return `
    <div class="form-group">
      <label>${f.label}</label>
      <input name="${f.key}" value="${escapeHtml(v)}" ${f.required ? 'required' : ''} ${f.placeholder ? `placeholder="${f.placeholder}"` : ''}>
      ${f.help ? `<div class="form-help">${f.help}</div>` : ''}
    </div>
  `;
}

const textFieldDefs = {
  home: {
    title: 'Тексты главной страницы',
    fields: [
      { key: 'featuredCoachId', label: 'Главный тренер на главной', type: 'select-coach' },
      { key: 'heroEyebrow', label: 'Тег-метка (над заголовком)' },
      { key: 'heroTitle', label: 'Заголовок Hero' },
      { key: 'heroSubtitle', label: 'Подзаголовок Hero', type: 'textarea' },
      { key: 'whyTitle', label: 'Заголовок «Почему ТРИУМФ»' },
      { key: 'whySubtitle', label: 'Подзаголовок «Почему ТРИУМФ»', type: 'textarea' },
      { key: 'trainerEyebrow', label: 'Eyebrow секции тренера' },
      { key: 'trainerTitle', label: 'Заголовок секции тренера' },
      { key: 'trainerSubtitle', label: 'Подзаголовок секции тренера', type: 'textarea' },
      { key: 'ctaTitle', label: 'Заголовок CTA' },
      { key: 'ctaSubtitle', label: 'Подзаголовок CTA', type: 'textarea' }
    ]
  },
  about: {
    title: 'Тексты страницы «О клубе»',
    fields: [
      { key: 'eyebrow', label: 'Eyebrow' },
      { key: 'title', label: 'Заголовок' },
      { key: 'subtitle', label: 'Подзаголовок', type: 'textarea' },
      { key: 'mission', label: 'Миссия (абзац 1)', type: 'textarea', rows: 4 },
      { key: 'mission2', label: 'Миссия (абзац 2)', type: 'textarea', rows: 4 },
      { key: 'value1Title', label: 'Ценность 1 — заголовок' },
      { key: 'value1Text', label: 'Ценность 1 — текст', type: 'textarea' },
      { key: 'value2Title', label: 'Ценность 2 — заголовок' },
      { key: 'value2Text', label: 'Ценность 2 — текст', type: 'textarea' },
      { key: 'value3Title', label: 'Ценность 3 — заголовок' },
      { key: 'value3Text', label: 'Ценность 3 — текст', type: 'textarea' },
      { key: 'value4Title', label: 'Ценность 4 — заголовок' },
      { key: 'value4Text', label: 'Ценность 4 — текст', type: 'textarea' }
    ]
  },
  directions: {
    title: 'Тексты страницы «Направления»',
    fields: [
      { key: 'kudoTitle', label: 'Кудо — заголовок' },
      { key: 'kudoText', label: 'Кудо — текст 1', type: 'textarea', rows: 3 },
      { key: 'kudoText2', label: 'Кудо — текст 2', type: 'textarea', rows: 3 },
      { key: 'pankrationTitle', label: 'Панкратион — заголовок' },
      { key: 'pankrationText', label: 'Панкратион — текст 1', type: 'textarea', rows: 3 },
      { key: 'pankrationText2', label: 'Панкратион — текст 2', type: 'textarea', rows: 3 },
      { key: 'mmaTitle', label: 'ММА — заголовок' },
      { key: 'mmaText', label: 'ММА — текст 1', type: 'textarea', rows: 3 },
      { key: 'mmaText2', label: 'ММА — текст 2', type: 'textarea', rows: 3 },
      { key: 'ofpTitle', label: 'ОФП — заголовок' },
      { key: 'ofpSubtitle', label: 'ОФП — подзаголовок', type: 'textarea' }
    ]
  },
  contacts: {
    title: 'Тексты страницы «Контакты»',
    fields: [
      { key: 'intro', label: 'Вводный текст' },
      { key: 'address', label: 'Адрес', type: 'textarea', rows: 2 },
      { key: 'phone1', label: 'Телефон 1' },
      { key: 'phone2', label: 'Телефон 2' },
      { key: 'email', label: 'Email' },
      { key: 'workHours', label: 'Режим работы', type: 'textarea', rows: 2 },
      { key: 'transport', label: 'Как добраться', type: 'textarea', rows: 2 },
      { key: 'socialsText', label: 'Соцсети (текст)' }
    ]
  },
  gallery: {
    title: 'Тексты галереи (страница «О клубе»)',
    fields: [
      { key: 'title', label: 'Заголовок' },
      { key: 'subtitle', label: 'Подзаголовок', type: 'textarea' }
    ]
  }
};

window.saveTextSection = async function() {
  const form = document.getElementById('text-editor').querySelector('form') || (() => {
    const form = document.createElement('form');
    document.getElementById('text-editor').appendChild(form);
    return form;
  })();
  // Collect from all inputs in editor
  const inputs = document.getElementById('text-editor').querySelectorAll('input, textarea');
  const data = {};
  inputs.forEach(i => { data[i.name] = i.value; });
  try {
    await api.savePageContent(CURRENT_TEXT_SECTION, data);
    DATA.pageContent = DATA.pageContent || {};
    DATA.pageContent[CURRENT_TEXT_SECTION] = { ...(DATA.pageContent[CURRENT_TEXT_SECTION] || {}), ...data };
    toast('Тексты сохранены', 'success');
  } catch (err) {
    toast('Ошибка сохранения', 'error');
  }
};


function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ============================================
   BOOT
   ============================================ */
if (api.token) {
  api.req('/admin/me').then(() => showApp()).catch(() => showLogin());
} else {
  showLogin();
}
