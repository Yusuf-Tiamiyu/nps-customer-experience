#!/usr/bin/env node
/* ============================================================================
   build.js: the ETL.

   EXTRACT   newest .xlsx in Raw_Data/
   TRANSFORM clean + standardise + derive (transform.js)
   LOAD      dist/index.html  (dashboard with data baked in)
             dist/data.json   (same data, for anything else that wants it)
             private/service-recovery.csv  (full contact details, NOT deployed)
             etl/.state.json  (fingerprint, so an unchanged file is a no-op)

   Usage:  node etl/build.js [--force] [--quiet]
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const XLSX = require('xlsx');
const T = require('./transform');
const { buildIco } = require('./favicon');
const { TOUCHPOINTS, THEMES, THRESHOLDS, PUBLISH_CONTACT_DETAILS } = require('./config');

const ROOT = path.resolve(__dirname, '..');
const RAW_DIR = path.join(ROOT, 'Raw_Data');
const SRC = path.join(ROOT, 'src', 'template.html');
const DIST = path.join(ROOT, 'dist');
const PRIVATE = path.join(ROOT, 'private');
const STATE = path.join(__dirname, '.state.json');
const LOG = path.join(__dirname, 'etl.log');

const FORCE = process.argv.includes('--force');
const QUIET = process.argv.includes('--quiet');

const lines = [];
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  lines.push(line);
  if (!QUIET) console.log(msg);
}
function flushLog() {
  try { fs.appendFileSync(LOG, lines.join('\n') + '\n'); } catch (_) {}
}

/* ---------------------------------------------------------------- EXTRACT */
function newestWorkbook() {
  if (!fs.existsSync(RAW_DIR)) throw new Error(`Raw_Data folder not found at ${RAW_DIR}`);
  const files = fs.readdirSync(RAW_DIR)
    .filter(f => /\.xlsx?$/i.test(f) && !f.startsWith('~$'))
    .map(f => {
      const p = path.join(RAW_DIR, f);
      return { file: f, full: p, mtime: fs.statSync(p).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  if (!files.length) throw new Error(`No .xlsx found in ${RAW_DIR}`);
  return files[0];
}

function fingerprint(fullPath) {
  const buf = fs.readFileSync(fullPath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/* -------------------------------------------------------------- TRANSFORM */
function transformAll(fullPath) {
  const wb = XLSX.readFile(fullPath, { cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false, dateNF: 'yyyy-mm-dd hh:mm:ss' });

  const unmapped = new Set();
  const issues = { noDate: 0, noNps: 0, noSite: 0, testRows: 0, dupIds: 0 };
  const seenIds = new Set();
  const records = [];

  for (const raw of rows) {
    const m = T.mapRow(raw);

    // Drop obvious test submissions.
    const orgTxt = (T.clean(m.orgRaw) || '').toLowerCase();
    const nameTxt = (T.clean(m.respondentName) || '').toLowerCase();
    if (/\btest\b/.test(orgTxt) && orgTxt.length <= 12 || nameTxt === 'test') { issues.testRows++; continue; }

    const rec = T.buildRecord(m, unmapped);
    if (!rec) { issues.noDate++; continue; }
    if (rec.nps === null) issues.noNps++;
    if (rec.site === 'Unspecified') issues.noSite++;
    if (rec.id !== null) {
      if (seenIds.has(rec.id)) { issues.dupIds++; continue; }
      seenIds.add(rec.id);
    }
    records.push(rec);
  }

  records.sort((a, b) => a.ts - b.ts);

  // Repeat respondents: same email/phone across submissions.
  const keyCount = {};
  records.forEach(r => { if (r.respondentKey) keyCount[r.respondentKey] = (keyCount[r.respondentKey] || 0) + 1; });
  records.forEach(r => {
    r.isRepeatRespondent = !!(r.respondentKey && keyCount[r.respondentKey] > 1);
  });

  const todayTs = Date.now();
  records.forEach(r => { r.recoveryScore = T.recoveryScore(r, todayTs); });

  return { records, unmapped: [...unmapped].sort(), issues, sourceRows: rows.length };
}

/* Split the PII off.
   Full contact details go to the local CSV only. What reaches dist/ depends on
   PUBLISH_CONTACT_DETAILS in config.js: by default, nothing does. */
function splitPii(records) {
  const pii = [];
  const publicRecords = records.map(r => {
    // respondentKey is the raw email/phone used to spot repeat respondents :
    // it never leaves this function. isRepeatRespondent carries the signal.
    const { _email, _phone, _name, respondentKey, ...rest } = r;
    if (_email || _phone || _name) {
      pii.push({ id: r.id, date: r.date, site: r.site, nps: r.nps, band: r.band,
                 name: _name, email: _email, phone: _phone,
                 contactRequested: r.contactRequested,
                 complaintsAddressed: r.complaintsAddressed,
                 recoveryScore: r.recoveryScore,
                 complaint: r.complaint, suggestion: r.suggestion });
    }
    // Whether the person left any way of being reached is itself useful on the
    // dashboard ("this case is actionable"), and carries no personal data.
    const base = { ...rest, hasContact: !!(_email || _phone || _name) };
    if (PUBLISH_CONTACT_DETAILS === 'mask') {
      base.contactName  = T.maskName(_name);
      base.contactEmail = T.maskEmail(_email);
      base.contactPhone = T.maskPhone(_phone);
    }
    return base;
  });
  return { publicRecords, pii };
}

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeRecoveryCsv(pii) {
  const queue = pii
    .filter(r => r.band === 'Detractor' || r.contactRequested === 'Yes' || r.complaintsAddressed === 'No')
    .sort((a, b) => b.recoveryScore - a.recoveryScore);
  const cols = ['recoveryScore','date','site','nps','band','name','email','phone',
                'contactRequested','complaintsAddressed','complaint','suggestion'];
  const csv = [cols.join(',')]
    .concat(queue.map(r => cols.map(c => csvEscape(r[c])).join(',')))
    .join('\n');
  fs.mkdirSync(PRIVATE, { recursive: true });
  fs.writeFileSync(path.join(PRIVATE, 'service-recovery.csv'), '﻿' + csv, 'utf8');
  return queue.length;
}

/* Last line of defence before anything is written to dist/.
   Structured contact fields are stripped in splitPii; this catches anything
   that slipped through, including addresses customers typed into a comment box.
   Comment text is allowed to contain them (customers write what they write) :
   the check reports those but only *fails* on structured leaks. */
function auditPayload(payload) {
  const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]{2,}/g;
  // Nigerian numbers: 0 + 10 digits (0803 123 4567) or +234 + 10 digits.
  const PHONE = /(?:\+?234|0)[\s-]?[789][01]\d[\s-]?\d{3}[\s-]?\d{4}\b/g;
  const FREE_TEXT = new Set(['complaint', 'suggestion', 'org', 'siteRaw']);
  const structural = [], inText = [];

  for (const r of payload.records) {
    for (const [k, v] of Object.entries(r)) {
      if (typeof v !== 'string') continue;
      const hits = (v.match(EMAIL) || []).concat(v.match(PHONE) || []);
      if (!hits.length) continue;
      (FREE_TEXT.has(k) ? inText : structural).push(`${k} (id ${r.id}): ${hits[0]}`);
    }
  }
  if (structural.length) {
    throw new Error(`Refusing to build: personal contact data found in structured fields of the ` +
      `public payload: ${structural.slice(0, 5).join('; ')}${structural.length > 5 ? ` (+${structural.length - 5} more)` : ''}`);
  }
  return inText;
}

/* ------------------------------------------------------------------- LOAD */
function render(payload) {
  const tpl = fs.readFileSync(SRC, 'utf8');
  if (!tpl.includes('/*__PAYLOAD__*/')) throw new Error('template.html is missing the /*__PAYLOAD__*/ marker');
  const json = JSON.stringify(payload).replace(/<\//g, '<\\/');

  // Logo lives outside the template so the template stays readable.
  let logo = '';
  const logoPath = path.join(ROOT, 'src', 'logo.txt');
  if (fs.existsSync(logoPath)) {
    logo = fs.readFileSync(logoPath, 'utf8').trim()
      .replace(/^data:image\/png;base64,\/9j\//, 'data:image/jpeg;base64,/9j/'); // it is actually a JPEG
  }

  const html = tpl
    .replace('/*__PAYLOAD__*/null', json)
    .replace('__LOGO__', logo);

  fs.mkdirSync(DIST, { recursive: true });
  fs.writeFileSync(path.join(DIST, 'index.html'), html, 'utf8');

  // Chart.js is vendored rather than pulled from a CDN: no third-party
  // dependency at view time, and the page still works offline.
  fs.copyFileSync(path.join(ROOT, 'src', 'vendor', 'chart.umd.min.js'),
                  path.join(DIST, 'chart.umd.min.js'));

  fs.copyFileSync(path.join(ROOT, 'src', 'favicon.svg'), path.join(DIST, 'favicon.svg'));
  fs.writeFileSync(path.join(DIST, 'favicon.ico'), buildIco());
  fs.writeFileSync(path.join(DIST, 'data.json'), JSON.stringify(payload, null, 0), 'utf8');
  // Netlify reads _headers on a direct file upload (netlify.toml is only read
  // by the build system), so the security headers live here.
  fs.writeFileSync(path.join(DIST, '_headers'),
    '/*\n' +
    '  X-Frame-Options: SAMEORIGIN\n' +
    '  X-Content-Type-Options: nosniff\n' +
    '  Referrer-Policy: no-referrer\n' +
    '  X-Robots-Tag: noindex, nofollow\n', 'utf8');
  return path.join(DIST, 'index.html');
}

/* ------------------------------------------------------------------- MAIN */
function main() {
  const wbInfo = newestWorkbook();
  const fp = fingerprint(wbInfo.full);

  let prev = null;
  try { prev = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch (_) {}

  if (!FORCE && prev && prev.fingerprint === fp && fs.existsSync(path.join(DIST, 'index.html'))) {
    log(`No change in "${wbInfo.file}" since ${prev.builtAt}. Nothing to do.`);
    flushLog();
    process.exitCode = 0;
    return { changed: false };
  }

  log(`Source: ${wbInfo.file}`);
  const { records, unmapped, issues, sourceRows } = transformAll(wbInfo.full);
  const { publicRecords, pii } = splitPii(records);
  const queueSize = writeRecoveryCsv(pii);

  const scored = records.filter(r => r.nps !== null);
  const prom = scored.filter(r => r.band === 'Promoter').length;
  const det = scored.filter(r => r.band === 'Detractor').length;
  const nps = scored.length ? Math.round((prom - det) / scored.length * 100) : null;

  const payload = {
    meta: {
      sourceFile: wbInfo.file,
      sourceModified: new Date(wbInfo.mtime).toISOString(),
      builtAt: new Date().toISOString(),
      sourceRows,
      loadedRows: records.length,
      newSince: prev ? records.length - (prev.loadedRows || 0) : null,
      previousLoadedRows: prev ? (prev.loadedRows || null) : null,
      previousBuiltAt: prev ? prev.builtAt : null,
      dateFrom: records.length ? records[0].date : null,
      dateTo: records.length ? records[records.length - 1].date : null,
      unmappedSites: unmapped,
      issues,
      recoveryQueueSize: queueSize,
      contactDetailsPublished: PUBLISH_CONTACT_DETAILS
    },
    config: { touchpoints: TOUCHPOINTS, themes: THEMES, thresholds: THRESHOLDS },
    records: publicRecords
  };

  const textLeaks = auditPayload(payload);
  const outPath = render(payload);

  log(`Rows in file: ${sourceRows} · loaded: ${records.length} · dropped: ${sourceRows - records.length} ` +
      `(test=${issues.testRows}, no-date=${issues.noDate}, dup-id=${issues.dupIds})`);
  log(`Period: ${payload.meta.dateFrom} to ${payload.meta.dateTo} · Overall NPS: ${nps}`);
  if (prev && prev.loadedRows) {
    const diff = records.length - prev.loadedRows;
    if (diff > 0)       log(`New responses since last build: ${diff}`);
    else if (diff === 0) log('No new responses since last build (something else in the file changed).');
    // Fewer responses than last time almost always means the wrong export was
    // downloaded, e.g. a filtered view. Worth saying out loud rather than
    // printing a negative number and moving on.
    else log(`WARNING this export has ${-diff} FEWER responses than the last one ` +
             `(${records.length} against ${prev.loadedRows}). Check you downloaded the full ` +
             `Microsoft Forms export and not a filtered view. Published anyway.`);
  }
  if (unmapped.length) log(`WARNING unmapped branch labels (add to etl/config.js SITE_CANON): ${unmapped.join(' | ')}`);
  if (issues.noNps) log(`NOTE ${issues.noNps} response(s) had no usable NPS score and are excluded from NPS maths.`);
  log(`Service-recovery queue: ${queueSize} rows -> private/service-recovery.csv (contains PII, do not deploy)`);
  log(`Contact details in published build: ${PUBLISH_CONTACT_DETAILS === false ? 'none (stripped)' : PUBLISH_CONTACT_DETAILS}`);
  if (textLeaks.length) {
    log(`NOTE ${textLeaks.length} comment(s) contain an email or phone number the customer typed themselves. ` +
        `These are published as written: ${textLeaks.slice(0, 3).join('; ')}`);
  }
  log(`Built ${outPath}`);

  fs.writeFileSync(STATE, JSON.stringify({
    fingerprint: fp, sourceFile: wbInfo.file, builtAt: payload.meta.builtAt,
    loadedRows: records.length, nps
  }, null, 2));

  flushLog();
  return { changed: true, records: records.length, nps };
}

if (require.main === module) {
  try { main(); }
  catch (err) { log('ERROR ' + err.message); flushLog(); process.exit(1); }
}
module.exports = { main };
