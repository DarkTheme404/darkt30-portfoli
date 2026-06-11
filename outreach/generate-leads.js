// TRIUMPH Outreach — Lead Generator
// Pulls businesses from OpenStreetMap (Overpass API) in any city
// Filters those WITHOUT website → hot leads
// Outputs leads.csv

const fs = require('fs');
const path = require('path');
const https = require('https');

const OUTPUT = path.join(__dirname, 'leads.csv');

// CONFIG — поменяй на свой город
const CITY = process.argv[2] || 'Иваново';
const COUNTRY = 'Россия';

// КАТЕГОРИИ БИЗНЕСОВ (по тегам OSM)
const CATEGORIES = {
  // Спорт / единоборства
  'Спортивные секции': ['dojo', 'fitness_centre', 'sports_centre', 'martial_arts'],
  'Фитнес-клубы': ['fitness_centre', 'sports_centre', 'gym'],
  'Йога / танцы': ['dance_school', 'yoga_studio'],

  // Красота
  'Салоны красоты': ['beauty_salon', 'hairdresser', 'barber_shop', 'spa'],
  'Маникюр / ногтевой сервис': ['beauty_salon', 'nail_salon'],

  // Еда
  'Рестораны / кафе': ['restaurant', 'cafe', 'fast_food', 'bar'],
  'Пекарни / кофейни': ['bakery', 'cafe'],

  // Здоровье
  'Стоматологии': ['dentist'],
  'Медцентры': ['clinic', 'doctors', 'hospital'],
  'Аптеки': ['pharmacy'],

  // Образование
  'Детские сады': ['kindergarten'],
  'Автошколы': ['driving_school'],
  'Языковые школы': ['language_school'],

  // Услуги
  'Автосервисы': ['car_repair', 'car_wash'],
  'Отели': ['hotel', 'hostel', 'guest_house']
};

const ALL_TAGS = [...new Set(Object.values(CATEGORIES).flat())];

function overpassQuery() {
  const tagUnion = ALL_TAGS.map(t => `["amenity"="${t}"]`).join('');
  return `
    [out:csv(::id,::lat,::lon,name,addr:city,addr:street,addr:housenumber,contact:phone,contact:email,website,opening_hours,brand;true;")]
    [timeout:60];
    area["name"="${CITY}"]["admin_level"~"4|6|8"]->.searchArea;
    (
      node${tagUnion}(area.searchArea);
      way${tagUnion}(area.searchArea);
      relation${tagUnion}(area.searchArea);
    );
    out tags;
  `.trim().replace(/\s+/g, ' ');
}

function fetchOverpass(query) {
  return new Promise((resolve, reject) => {
    const data = encodeURIComponent(query);
    const url = `https://overpass-api.de/api/interpreter?data=${data}`;
    const req = https.get(url, { timeout: 60000 }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Overpass timeout')); });
  });
}

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  // First line is "id,lat,lon,name,..." — rest is data
  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = lines[i].split(',');
    // OSM CSV format: id,lat,lon,name,city,street,house,phone,email,website,hours,brand
    const obj = {
      osm_id: fields[0] || '',
      lat: fields[1] || '',
      lon: fields[2] || '',
      name: fields[3] || '',
      city: fields[4] || '',
      address: [fields[5], fields[6]].filter(Boolean).join(', '),
      phone: fields[7] || '',
      email: fields[8] || '',
      website: fields[9] || '',
      hours: fields[10] || '',
      category: ''  // filled below
    };
    result.push(obj);
  }
  return result;
}

function categorize(lead) {
  for (const [cat, tags] of Object.entries(CATEGORIES)) {
    for (const t of tags) {
      if (lead.osm_id && (lead.name || '').length) {
        // heuristic: just assign by index
      }
    }
  }
  return '';
}

async function main() {
  console.log(`\n🔍 Парсим OpenStreetMap: ${CITY}, ${COUNTRY}`);
  console.log(`   Категории: ${ALL_TAGS.length} тегов`);

  const query = overpassQuery();
  let csv;
  try {
    csv = await fetchOverpass(query);
  } catch (e) {
    console.error('❌ Ошибка Overpass:', e.message);
    process.exit(1);
  }

  const all = parseCSV(csv);
  console.log(`   Найдено всего: ${all.length} объектов`);

  // Фильтр — БЕЗ сайта
  const noWebsite = all.filter(l => !l.website || l.website === '');
  console.log(`   Без сайта: ${noWebsite.length} (ГОРЯЧИЕ ЛИДЫ!)`);

  // С контактами (телефон или email)
  const withContacts = noWebsite.filter(l => l.phone || l.email);
  console.log(`   С контактами: ${withContacts.length}`);

  // Assign categories
  const enriched = withContacts.map((l, i) => {
    // Distribute categories round-robin for now
    const catKeys = Object.keys(CATEGORIES);
    l.category = catKeys[i % catKeys.length];
    l.priority = i < 20 ? '🔥 A' : i < 50 ? '⭐ B' : '📋 C';
    return l;
  });

  // CSV header
  const header = 'priority,category,name,address,phone,email,website,hours,lat,lon,osm_id';
  const rows = enriched.map(l => [
    l.priority, l.category, l.name, l.address, l.phone, l.email, l.website,
    l.hours, l.lat, l.lon, l.osm_id
  ].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(','));

  fs.writeFileSync(OUTPUT, [header, ...rows].join('\n'), 'utf-8');
  console.log(`\n✅ Сохранено: ${OUTPUT}`);
  console.log(`   Лидов: ${enriched.length}`);
  console.log(`\n   Первые 5:`);
  enriched.slice(0, 5).forEach(l => {
    console.log(`   ${l.priority} | ${l.category} | ${l.name} | ${l.phone || l.email || 'нет контактов'}`);
  });
  console.log(`\n💡 Следующий шаг: node send-emails.js`);
}

main().catch(e => { console.error(e); process.exit(1); });
