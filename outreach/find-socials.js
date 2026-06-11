// TRIUMPH Outreach — 2GIS Social Parser
// Ищет бизнесы через 2ГИС Catalog API и достаёт соцсети
// Использование: node find-socials.js "Иваново" "Фитнес-клубы"

const fs = require('fs');
const path = require('path');
const https = require('https');

// 2ГИС Catalog API (открытый, нужен только ключ, бесплатно)
const API_KEY = process.env.TWO_GIS_API_KEY || ''; // можно без ключа через HTML-парсинг
const CITY = process.argv[2] || 'Иваново';
const CATEGORY = process.argv[3] || '';

// Категории 2ГИС
const CATEGORIES = {
  'Фитнес-клубы': 'Фитнес',
  'Спортивные секции': 'Спортивная секция',
  'Салоны красоты': 'Салон красоты',
  'Стоматологии': 'Стоматология',
  'Рестораны': 'Ресторан',
  'Кафе': 'Кафе',
  'Автосервисы': 'Автосервис',
  'Отели': 'Гостиница',
  'Детские сады': 'Детский сад',
  'Медцентры': 'Медицинский центр',
  'Языковые школы': 'Языковая школа',
  'Барбершопы': 'Барбершоп',
  'Пекарни': 'Пекарня',
  'Кофейни': 'Кофейня',
  'Стоматологии': 'Стоматология'
};

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 30000 }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('Bad JSON: ' + body.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 30000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// Extract social links from 2GIS HTML page
function extractSocials(html) {
  const result = { vk: '', telegram: '', instagram: '', whatsapp: '', youtube: '', facebook: '' };
  const patterns = {
    vk: /vk\.com\/[a-zA-Z0-9_.-]+/i,
    telegram: /t\.me\/[a-zA-Z0-9_]+/i,
    instagram: /instagram\.com\/[a-zA-Z0-9_.-]+/i,
    whatsapp: /wa\.me\/[\d]+/i,
    youtube: /youtube\.com\/[a-zA-Z0-9_/-]+/i,
    facebook: /facebook\.com\/[a-zA-Z0-9_.-]+/i
  };
  for (const [key, pattern] of Object.entries(patterns)) {
    const match = html.match(pattern);
    if (match) result[key] = match[0];
  }
  return result;
}

// Search businesses via 2GIS Catalog API
async function searchBusinesses(city, query) {
  if (!API_KEY) {
    console.log('⚠️  2GIS_API_KEY не задан. Использую OSM.');
    return searchOSM(city, query);
  }

  const url = `https://catalog.api.2gis.ru/3.0/items?q=${encodeURIComponent(query)}&city_id=${encodeURIComponent(city)}&key=${API_KEY}&fields=items.point,items.contact_groups,items.schedule,items.reviews&page_size=50`;
  const data = await fetchJson(url);
  return (data.result?.items || []).map(item => ({
    name: item.name_ex?.primary || item.name || '',
    address: item.address_name || '',
    phone: (item.contact_groups?.find(g => g.type === 'phone')?.contacts?.[0]?.value) || '',
    email: (item.contact_groups?.find(g => g.type === 'email')?.contacts?.[0]?.value) || '',
    website: (item.contact_groups?.find(g => g.type === 'website')?.contacts?.[0]?.value) || '',
    lat: item.point?.lat,
    lon: item.point?.lon,
    id_2gis: item.id
  }));
}

// Fallback — OSM nominatim
async function searchOSM(city, query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ' ' + city)}&format=json&limit=30&addressdetails=1`;
  const data = await fetchJson(url);
  return (data || []).map(item => ({
    name: item.display_name.split(',')[0],
    address: item.display_name,
    lat: item.lat,
    lon: item.lon,
    osm_id: item.osm_id
  }));
}

// Fetch firm page from 2GIS to extract social links
async function fetch2GISSocials(firmId) {
  if (!API_KEY) return {};
  const url = `https://public.api.2gis.ru/3.0/items/${firmId}?key=${API_KEY}&fields=items.contact_groups,items.links`;
  try {
    const data = await fetchJson(url);
    const item = data.result;
    if (!item) return {};

    const result = { vk: '', telegram: '', instagram: '', whatsapp: '', youtube: '', facebook: '' };

    // Extract from contact_groups (type=social)
    const socials = (item.contact_groups || []).find(g => g.type === 'social');
    if (socials && socials.contacts) {
      socials.contacts.forEach(c => {
        const url = (c.value || '').toLowerCase();
        if (url.includes('vk.com')) result.vk = c.value;
        else if (url.includes('t.me') || url.includes('telegram')) result.telegram = c.value;
        else if (url.includes('instagram')) result.instagram = c.value;
        else if (url.includes('wa.me') || url.includes('whatsapp')) result.whatsapp = c.value;
        else if (url.includes('youtube')) result.youtube = c.value;
        else if (url.includes('facebook')) result.facebook = c.value;
      });
    }

    // Fallback — from contact_groups (type=website) extract social from URL
    const websites = (item.contact_groups || []).find(g => g.type === 'website');
    if (websites && websites.contacts) {
      websites.contacts.forEach(c => {
        const url = (c.value || '').toLowerCase();
        if (url.includes('vk.com') && !result.vk) result.vk = c.value;
        if ((url.includes('t.me') || url.includes('telegram')) && !result.telegram) result.telegram = c.value;
        if (url.includes('instagram') && !result.instagram) result.instagram = c.value;
      });
    }
    return result;
  } catch (e) {
    return {};
  }
}

async function main() {
  console.log(`\n🔍 Поиск: ${CATEGORY || 'все'} в ${CITY}`);

  let businesses = [];
  if (CATEGORY && CATEGORIES[CATEGORY]) {
    businesses = await searchBusinesses(CITY, CATEGORIES[CATEGORY]);
  } else {
    // Search multiple
    for (const [name, q] of Object.entries(CATEGORIES)) {
      console.log(`   → ${name}...`);
      const items = await searchBusinesses(CITY, q);
      businesses.push(...items);
    }
  }
  console.log(`   Найдено: ${businesses.length} бизнесов`);

  // Fetch socials for each
  const enriched = [];
  for (let i = 0; i < businesses.length; i++) {
    const b = businesses[i];
    if (b.id_2gis) {
      const socials = await fetch2GISSocials(b.id_2gis);
      enriched.push({ ...b, ...socials });
      process.stdout.write(`  [${i + 1}/${businesses.length}]\r`);
      await new Promise(r => setTimeout(r, 200)); // rate limit
    } else {
      enriched.push(b);
    }
  }

  // Filter — without website
  const noSite = enriched.filter(b => !b.website);
  console.log(`\n   Без сайта: ${noSite.length}`);

  // Save to CSV (append to leads.csv)
  const LEADS_FILE = path.join(__dirname, 'leads.csv');
  const header = 'priority,category,name,address,phone,email,website,vk,telegram,instagram,whatsapp,youtube,description,hours,lat,lon,osm_id';

  const newRows = noSite.map((b, i) => {
    const cat = CATEGORY || 'Найдено';
    const phone = b.phone ? b.phone.replace(/[^\d+]/g, '').slice(0, 12) : '';
    return [
      '⭐ B',  // default priority
      cat,
      b.name,
      b.address,
      phone,
      b.email,
      b.website,
      b.vk,
      b.telegram,
      b.instagram,
      b.whatsapp,
      b.youtube,
      b.description || '',
      b.hours || '',
      b.lat || '',
      b.lon || '',
      b.osm_id || b.id_2gis || '-'
    ].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',');
  });

  // Append
  fs.appendFileSync(LEADS_FILE, '\n' + newRows.join('\n'), 'utf-8');
  console.log(`\n✅ Добавлено ${newRows.length} лидов в ${LEADS_FILE}`);

  // Sample
  console.log('\n📋 Примеры найденных:');
  noSite.slice(0, 5).forEach(b => {
    const socials = [b.vk, b.telegram, b.instagram].filter(Boolean);
    console.log(`   ${b.name}`);
    console.log(`     ${b.phone || 'нет телефона'}`);
    if (socials.length) console.log(`     Соцсети: ${socials.join(', ')}`);
  });
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
