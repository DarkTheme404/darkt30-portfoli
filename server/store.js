const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'content.json');

function read() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch (e) {
    console.error('Failed to read data file:', e);
    return null;
  }
}

function write(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  return data;
}

function get() { return read(); }

function update(patch) {
  const data = read();
  if (!data) return null;
  const merged = { ...data, ...patch };
  return write(merged);
}

function pushLead(lead) {
  const data = read();
  if (!data) return null;
  const id = (data.leads.length ? Math.max(...data.leads.map(l => l.id || 0)) : 0) + 1;
  const newLead = {
    id,
    ...lead,
    createdAt: new Date().toISOString(),
    status: 'new'
  };
  data.leads.unshift(newLead);
  write(data);
  return newLead;
}

function updateLead(id, patch) {
  const data = read();
  if (!data) return null;
  const idx = data.leads.findIndex(l => l.id === id);
  if (idx === -1) return null;
  data.leads[idx] = { ...data.leads[idx], ...patch };
  write(data);
  return data.leads[idx];
}

function deleteLead(id) {
  const data = read();
  if (!data) return null;
  data.leads = data.leads.filter(l => l.id !== id);
  write(data);
  return true;
}

function nextId(arr) {
  return arr.length ? Math.max(...arr.map(i => i.id || 0)) + 1 : 1;
}

function addCoach(coach) {
  const data = read();
  if (!data) return null;
  const id = nextId(data.coaches);
  data.coaches.push({ id, ...coach });
  write(data);
  return data.coaches[data.coaches.length - 1];
}

function updateCoach(id, patch) {
  const data = read();
  if (!data) return null;
  const idx = data.coaches.findIndex(c => c.id === id);
  if (idx === -1) return null;
  data.coaches[idx] = { ...data.coaches[idx], ...patch };
  write(data);
  return data.coaches[idx];
}

function deleteCoach(id) {
  const data = read();
  if (!data) return null;
  data.coaches = data.coaches.filter(c => c.id !== id);
  write(data);
  return true;
}

function addScheduleItem(item) {
  const data = read();
  if (!data) return null;
  const id = nextId(data.schedule);
  data.schedule.push({ id, ...item });
  write(data);
  return data.schedule[data.schedule.length - 1];
}

function updateScheduleItem(id, patch) {
  const data = read();
  if (!data) return null;
  const idx = data.schedule.findIndex(s => s.id === id);
  if (idx === -1) return null;
  data.schedule[idx] = { ...data.schedule[idx], ...patch };
  write(data);
  return data.schedule[idx];
}

function deleteScheduleItem(id) {
  const data = read();
  if (!data) return null;
  data.schedule = data.schedule.filter(s => s.id !== id);
  write(data);
  return true;
}

function addPost(post) {
  const data = read();
  if (!data) return null;
  const id = nextId(data.blog);
  data.blog.unshift({ id, ...post });
  write(data);
  return data.blog[0];
}

function updatePost(id, patch) {
  const data = read();
  if (!data) return null;
  const idx = data.blog.findIndex(p => p.id === id);
  if (idx === -1) return null;
  data.blog[idx] = { ...data.blog[idx], ...patch };
  write(data);
  return data.blog[idx];
}

function deletePost(id) {
  const data = read();
  if (!data) return null;
  data.blog = data.blog.filter(p => p.id !== id);
  write(data);
  return true;
}

function updatePricing(items) {
  const data = read();
  if (!data) return null;
  data.pricing = items;
  write(data);
  return data.pricing;
}

/* ---------- MEDIA LIBRARY ---------- */
function addMedia(item) {
  const data = read();
  if (!data) return null;
  const id = nextId(data.media);
  const newItem = {
    id,
    ...item,
    createdAt: new Date().toISOString()
  };
  data.media.unshift(newItem);
  write(data);
  return newItem;
}

function updateMedia(id, patch) {
  const data = read();
  if (!data) return null;
  const idx = data.media.findIndex(m => m.id === id);
  if (idx === -1) return null;
  data.media[idx] = { ...data.media[idx], ...patch };
  write(data);
  return data.media[idx];
}

function deleteMedia(id) {
  const data = read();
  if (!data) return null;
  const item = data.media.find(m => m.id === id);
  data.media = data.media.filter(m => m.id !== id);
  write(data);
  return item; // returns removed item (for fs cleanup)
}

/* ---------- BRANDING ---------- */
function updateBranding(patch) {
  const data = read();
  if (!data) return null;
  data.branding = { ...(data.branding || {}), ...patch };
  write(data);
  return data.branding;
}

/* ---------- PAGE CONTENT ---------- */
function updatePageContent(section, patch) {
  const data = read();
  if (!data) return null;
  if (!data.pageContent) data.pageContent = {};
  data.pageContent[section] = { ...(data.pageContent[section] || {}), ...patch };
  write(data);
  return data.pageContent[section];
}

module.exports = {
  get, update, pushLead, updateLead, deleteLead,
  addCoach, updateCoach, deleteCoach,
  addScheduleItem, updateScheduleItem, deleteScheduleItem,
  addPost, updatePost, deletePost,
  updatePricing,
  addMedia, updateMedia, deleteMedia,
  updateBranding, updatePageContent
};
