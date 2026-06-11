// Lead storage (JSON file)
const fs = require('fs');
const path = require('path');

const LEADS_FILE = path.join(__dirname, 'leads.json');

function readLeads() {
  if (!fs.existsSync(LEADS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
  } catch (e) {
    return [];
  }
}

function writeLeads(leads) {
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
}

function addLead(data) {
  const leads = readLeads();
  const lead = {
    id: Date.now(),
    ...data,
    createdAt: new Date().toISOString()
  };
  leads.unshift(lead);
  // Keep last 1000
  if (leads.length > 1000) leads.length = 1000;
  writeLeads(leads);
  return lead;
}

module.exports = { addLead, readLeads };
