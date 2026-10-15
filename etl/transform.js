/* ============================================================================
   transform.js: cleaning + standardisation + derivation.
   Pure functions; no file I/O. Called by build.js.
   ========================================================================== */
const {
  SITE_CANON, SITE_REGION, HEADER_MAP, TOUCHPOINTS, THEMES,
  NULL_TEXT, THRESHOLDS, OWN_FACILITY_PATTERNS, OWN_FACILITY_LABEL
} = require('./config');

/* ---------- primitive cleaners ---------- */

// Non-breaking spaces are everywhere in the Forms export (4,600+ of them).
function clean(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date || typeof v === 'number') return v;
  const s = String(v)
    .replace(/ /g, ' ')      // NBSP -> space
    .replace(/[​-‍﻿]/g, '') // zero-width junk
    .replace(/\s+/g, ' ')
    .trim();
  return s.length ? s : null;
}

function normHeader(h) {
  return String(h)
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// True when free text is a real answer rather than "Nil"/"N/A"/an email address.
function isRealText(v) {
  const s = clean(v);
  if (!s) return false;
  const t = s.toLowerCase().replace(/[.!?\s]+$/, '').trim();
  if (NULL_TEXT.has(t)) return false;
  if (t.length < 5) return false;
  if (/^[\w.+-]+@[\w.-]+\.\w+$/.test(t)) return false;   // bare email
  if (/^[\d\s()+-]{7,}$/.test(t)) return false;          // bare phone number
  return true;
}

function toDate(v) {
  if (v instanceof Date && !isNaN(v)) return v;
  if (typeof v === 'number') {                     // Excel serial
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return isNaN(d) ? null : d;
  }
  const s = clean(v);
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

const pad = n => String(n).padStart(2, '0');
const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/* ---------- domain standardisation ---------- */

function canonSite(raw, unmapped) {
  const s = clean(raw);
  if (!s) return { site: 'Unspecified', region: 'Unspecified' };
  const key = s.toLowerCase().replace(/[.]/g, '').replace(/\s*,\s*/g, ', ').trim();
  let site = SITE_CANON[key] || SITE_CANON[key.replace(/,/g, '')];
  if (!site) {
    // Unknown label: keep it visible rather than silently dropping it,
    // and record it so the Data Quality panel can prompt a config update.
    site = s;
    if (unmapped) unmapped.add(s);
  }
  return { site, region: SITE_REGION[site] || 'Other / Unmapped' };
}

function canonOrg(raw) {
  const s = clean(raw);
  if (!s || !isRealText(s)) return null;
  if (OWN_FACILITY_PATTERNS.some(re => re.test(s))) return OWN_FACILITY_LABEL;
  let t = s.replace(/\b(hospital|clinic|laboratory|labs?|medical centre|medical center|ltd|limited|plc)\b/gi,
                    m => m.toUpperCase() === m ? m : m)
           .replace(/\s+/g, ' ').trim();
  // Title-case ALL-CAPS entries so "MARIGOLD HOSPITAL" and "Marigold Hospital" merge.
  if (t === t.toUpperCase() && t.length > 3) {
    t = t.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }
  // Spelling variants of the same referring account (fictional names in the demo)
  const ALIAS = {
    'greenfield hosp': 'Greenfield Hospital',
    'mercy clinic': 'Mercy Specialist Clinic',
    'st annes clinic': "St. Anne's Clinic",
    'harbour medical center': 'Harbour Medical Centre',
    'crestview hospital ltd': 'Crestview Hospital',
    'bluewave energy plc': 'Bluewave Energy (staff clinic)',
    'bluewave energy': 'Bluewave Energy (staff clinic)'
  };
  return ALIAS[t.toLowerCase()] || t;
}

const SAT = 'Satisfied', UNSAT = 'Not satisfied', NAPP = 'Not applicable';
function canonRating(v) {
  const s = clean(v);
  if (!s) return null;
  const t = s.toLowerCase();
  if (t.startsWith('not satisf') || t === 'unsatisfied' || t === 'dissatisfied') return UNSAT;
  if (t.startsWith('not applic') || t === 'n/a' || t === 'na') return NAPP;
  if (t.startsWith('satisf')) return SAT;
  return s;
}

function canonYesNo(v) {
  const s = clean(v);
  if (!s) return null;
  const t = s.toLowerCase();
  if (t.startsWith('y')) return 'Yes';
  if (t.startsWith('n')) return 'No';
  return null;
}

function canonNps(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  return (i >= 0 && i <= 10) ? i : null;
}

function npsBand(n) {
  if (n === null) return null;
  if (n >= 9) return 'Promoter';
  if (n >= 7) return 'Passive';
  return 'Detractor';
}

function normPhone(v) {
  const s = clean(v);
  if (!s) return null;
  const d = s.replace(/\D/g, '');
  if (d.length < 10) return null;
  return d.replace(/^234/, '0').replace(/^0?(\d{10})$/, '0$1');
}

function normEmail(v) {
  const s = clean(v);
  if (!s || !/^[\w.+-]+@[\w.-]+\.\w{2,}$/.test(s)) return null;
  return s.toLowerCase();
}

/* Masking for the publicly-hosted build. Full values stay in the local CSV. */
function maskEmail(e) {
  if (!e) return null;
  const [u, d] = e.split('@');
  return `${u.slice(0, 2)}${'•'.repeat(Math.max(3, u.length - 2))}@${d}`;
}
function maskPhone(p) {
  if (!p) return null;
  return `${p.slice(0, 4)}${'•'.repeat(Math.max(3, p.length - 6))}${p.slice(-2)}`;
}
function maskName(n) {
  if (!n) return null;
  return n.split(/\s+/).map((w, i) => i === 0 ? w : (w[0] || '').toUpperCase() + '.').join(' ');
}

/* ---------- theme tagging ---------- */

function tagThemes(text) {
  if (!text) return { primary: null, all: [] };
  const t = ' ' + text.toLowerCase() + ' ';
  const hits = THEMES
    .map(th => ({ name: th.name, n: th.kws.reduce((a, k) => a + (t.includes(k) ? 1 : 0), 0) }))
    .filter(h => h.n > 0);
  if (!hits.length) return { primary: 'Other / Uncategorised', all: ['Other / Uncategorised'] };
  hits.sort((a, b) => b.n - a.n);
  return { primary: hits[0].name, all: hits.map(h => h.name) };
}

/* ---------- main record builder ---------- */

function mapRow(rawRow) {
  const out = {};
  for (const [k, v] of Object.entries(rawRow)) {
    const field = HEADER_MAP[normHeader(k)];
    if (field) out[field] = v;
  }
  return out;
}

function buildRecord(m, unmapped) {
  const started = toDate(m.startTime);
  const completed = toDate(m.completionTime);
  const d = completed || started;
  if (!d) return null;

  const { site, region } = canonSite(m.branchRaw, unmapped);
  const nps = canonNps(m.nps);

  const rec = {
    id: clean(m.sourceId),
    date: isoDate(d),
    ts: d.getTime(),
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    quarter: Math.floor(d.getMonth() / 3) + 1,
    ym: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`,
    minutesToComplete: (started && completed)
      ? Math.max(0, Math.round((completed - started) / 60000)) : null,

    site, region,
    siteRaw: clean(m.branchRaw),
    clientCategory: clean(m.clientCategory) || 'Unspecified',
    gender: clean(m.gender) || 'Unspecified',
    ageRange: clean(m.ageRange) || 'Unspecified',
    org: canonOrg(m.orgRaw),

    nps,
    band: npsBand(nps),

    complaintsAddressed: canonYesNo(m.complaintsAddressed),
    contactRequested: canonYesNo(m.contactRequested)
  };

  TOUCHPOINTS.forEach(t => { rec[t.key] = canonRating(m[t.key]); });

  rec.dissatisfied = TOUCHPOINTS.filter(t => rec[t.key] === UNSAT).map(t => t.label);
  rec.dissatCount = rec.dissatisfied.length;
  rec.notApplicableCount = TOUCHPOINTS.filter(t => rec[t.key] === NAPP).length;

  const complaint = isRealText(m.complaintDetail) ? clean(m.complaintDetail) : null;
  const suggestion = isRealText(m.suggestion) ? clean(m.suggestion) : null;
  rec.complaint = complaint;
  rec.suggestion = suggestion;
  rec.hasVerbatim = !!(complaint || suggestion);

  const voice = [complaint, suggestion].filter(Boolean).join(': ');
  const tags = tagThemes(voice);
  rec.themePrimary = voice ? tags.primary : null;
  rec.themes = tags.all;

  // Contact / service-recovery details
  const email = normEmail(m.emailA) || normEmail(m.emailB);
  const phone = normPhone(m.phoneA) || normPhone(m.phoneB);
  const name = isRealText(m.respondentName) ? clean(m.respondentName) : null;
  rec._email = email; rec._phone = phone; rec._name = name;
  rec.respondentKey = email || phone || null;
  rec.hasContact = !!(email || phone);

  return rec;
}

/* Priority score for the service-recovery queue.
   Deliberately simple and explainable: anyone can audit why a row ranks high. */
function recoveryScore(r, todayTs) {
  let s = 0;
  if (r.band === 'Detractor') s += 40;
  else if (r.band === 'Passive') s += 10;
  if (r.nps !== null) s += (6 - Math.min(r.nps, 6)) * 3;      // 0 -> +18, 6 -> 0
  if (r.complaintsAddressed === 'No') s += 25;
  if (r.contactRequested === 'Yes') s += 20;
  s += Math.min(r.dissatCount, 6) * 4;
  if (r.complaint) s += 10;
  if (r.clientCategory && /external/i.test(r.clientCategory)) s += 8;  // a referring account, so more revenue at stake
  const ageDays = Math.floor((todayTs - r.ts) / 86400000);
  if (ageDays <= 30) s += 10;                                  // still recoverable
  return Math.round(s);
}

module.exports = {
  clean, normHeader, isRealText, toDate, isoDate,
  canonSite, canonOrg, canonRating, canonYesNo, canonNps, npsBand,
  normPhone, normEmail, maskEmail, maskPhone, maskName,
  tagThemes, mapRow, buildRecord, recoveryScore,
  SAT, UNSAT, NAPP, TOUCHPOINTS, THEMES, THRESHOLDS
};
