/**
 * Alumni DB backend — Google Apps Script web app bound to the spreadsheet.
 *
 * The sheet stays private; this script runs as the owner. Callers prove identity with a
 * Google ID token, which is verified here, mapped to a role from the `_Users` tab, and every
 * action is authorised server-side (mirrors frontend/src/lib/auth/permissions.ts).
 *
 * Script properties (Project Settings → Script properties):
 *   GOOGLE_CLIENT_ID  OAuth web client id the frontend signs in with
 *   BOOTSTRAP_ADMIN   email auto-created as admin when `_Users` is empty
 */

var ALUMNI = 'Alumni', CONFIG = '_Config', USERS = '_Users', ID_HEADER = '_id';
var CACHE_TTL = 600; // seconds; correctness comes from versioned keys, TTL only bounds memory

// ---------------------------------------------------------------- entry points

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    var user = authenticate(req.token);
    return json({ ok: true, data: route(req.action, req.payload || {}, user) });
  } catch (err) {
    var code = err.code || 'SERVER';
    if (code === 'SERVER') console.error(err && err.stack || err);
    return json({ ok: false, error: { code: code, message: err.message || String(err) } });
  }
}

function doGet() { return json({ ok: true, data: 'alumni-db backend up' }); }

/** Simple trigger: manual edits in the sheet bump the data version so caches are dropped. */
function onEdit(e) {
  var name = e && e.range && e.range.getSheet().getName();
  if (name === ALUMNI) bumpData_();
}

/** Run once from the editor: creates tabs and a starter column map inferred from your headers. */
function setup() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(ALUMNI) || ss.insertSheet(ALUMNI);
  if (sh.getLastColumn() === 0) sh.getRange(1, 1, 1, 3).setValues([['Full Name', 'Email', 'Graduation Year']]);
  if (!ss.getSheetByName(USERS)) {
    var u = ss.insertSheet(USERS);
    u.getRange(1, 1, 1, 4).setValues([['email', 'name', 'role', 'active']]);
  }
  if (!ss.getSheetByName(CONFIG)) ss.insertSheet(CONFIG);
  if (!readConfig_()) {
    var cols = [];
    headers_(sh).forEach(function (h) { cols.push(inferColumn_(h, sampleFor_(sh, h), cols)); });
    writeConfig_({ version: 1, columns: cols });
  }
  var admin = PropertiesService.getScriptProperties().getProperty('BOOTSTRAP_ADMIN');
  if (admin && readUsers_().length === 0) upsertUser_({ email: admin, name: 'Admin', role: 'admin', active: true });
  ss.getSheetByName(CONFIG).hideSheet();
}

// ---------------------------------------------------------------- auth

function fail_(code, msg) { var e = new Error(msg); e.code = code; throw e; }

function authenticate(token) {
  if (!token) fail_('UNAUTHENTICATED', 'Missing token');
  var cache = CacheService.getScriptCache();
  var ck = 'tok:' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token));
  var info = cache.get(ck);
  if (info) { info = JSON.parse(info); }
  else {
    var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) fail_('UNAUTHENTICATED', 'Invalid or expired token');
    info = JSON.parse(res.getContentText());
    var clientId = PropertiesService.getScriptProperties().getProperty('GOOGLE_CLIENT_ID');
    if (info.aud !== clientId) fail_('UNAUTHENTICATED', 'Token audience mismatch');
    if (String(info.email_verified) !== 'true') fail_('UNAUTHENTICATED', 'Email not verified');
    var ttl = Math.max(1, Math.min(300, Number(info.exp) - Math.floor(Date.now() / 1000)));
    cache.put(ck, JSON.stringify({ email: info.email, name: info.name, picture: info.picture, exp: info.exp }), ttl);
  }
  if (Number(info.exp) * 1000 < Date.now()) fail_('UNAUTHENTICATED', 'Token expired');
  var users = readUsers_();
  if (!users.length) {
    var boot = PropertiesService.getScriptProperties().getProperty('BOOTSTRAP_ADMIN');
    if (boot && boot.toLowerCase() === info.email.toLowerCase()) users = upsertUser_({ email: info.email, name: info.name || 'Admin', role: 'admin', active: true });
  }
  var u = users.filter(function (x) { return x.email.toLowerCase() === info.email.toLowerCase(); })[0];
  if (!u || !u.active) fail_('FORBIDDEN', info.email + ' is not authorised for this app');
  return { email: u.email, name: u.name || info.name, role: u.role, picture: info.picture };
}

// ---------------------------------------------------------------- permissions (mirror of permissions.ts)

function canWrite_(role) { return role === 'editor' || role === 'admin'; }
function canView_(col, role) { return role === 'admin' || col.viewRoles.indexOf(role) >= 0; }
function canEdit_(col, role) { return role === 'admin' || (canWrite_(role) && col.editRoles.indexOf(role) >= 0); }
function requireRole_(ok, msg) { if (!ok) fail_('FORBIDDEN', msg || 'Not allowed'); }

// ---------------------------------------------------------------- router

function route(action, p, user) {
  var role = user.role;
  switch (action) {
    case 'whoAmI': return user;
    case 'getVersion': return versions_();
    case 'getSchema':
      var cfg = readConfig_() || { version: 0, columns: [] };
      return { version: cfg.version, columns: role === 'admin' ? cfg.columns : cfg.columns.filter(function (c) { return canView_(c, role); }) };
    case 'listAlumni': return listAlumni_(role);
    case 'createAlumni': requireRole_(canWrite_(role), 'Read-only access'); return withLock_(function () { return create_(p.values, role); });
    case 'updateAlumni': requireRole_(canWrite_(role), 'Read-only access'); return withLock_(function () { return update_(p.id, p.patch, role); });
    case 'deleteAlumni': requireRole_(canWrite_(role), 'Read-only access'); return withLock_(function () { return remove_(p.id); });
    case 'getSheetHeaders': requireRole_(role === 'admin', 'Admin only'); var sh = sheet_(ALUMNI); var hs = headers_(sh), s = {};
      hs.forEach(function (h) { s[h] = sampleFor_(sh, h); }); return { headers: hs, samples: s };
    case 'saveSchema': requireRole_(role === 'admin', 'Admin only'); return withLock_(function () { return saveSchema_(p.columns); });
    case 'listUsers': requireRole_(role === 'admin', 'Admin only'); return readUsers_();
    case 'upsertUser': requireRole_(role === 'admin', 'Admin only'); return withLock_(function () { return upsertUser_(p.user); });
    case 'removeUser': requireRole_(role === 'admin', 'Admin only'); return withLock_(function () { return removeUser_(p.email); });
    case 'clearCache': requireRole_(role === 'admin', 'Admin only'); bumpData_(); return null;
  }
  fail_('INVALID', 'Unknown action ' + action);
}

// ---------------------------------------------------------------- sheet helpers

function sheet_(name) { var s = SpreadsheetApp.getActive().getSheetByName(name); if (!s) fail_('SERVER', 'Missing tab ' + name + ' — run setup()'); return s; }
function withLock_(fn) { var l = LockService.getScriptLock(); l.waitLock(20000); try { return fn(); } finally { l.releaseLock(); } }
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/** Headers of the Alumni tab excluding the hidden _id column; ensures _id exists. */
function headers_(sh) {
  var n = Math.max(1, sh.getLastColumn());
  var row = sh.getRange(1, 1, 1, n).getValues()[0].map(String);
  return row.filter(function (h) { return h && h !== ID_HEADER; });
}
function idCol_(sh) {
  var n = Math.max(1, sh.getLastColumn());
  var row = sh.getRange(1, 1, 1, n).getValues()[0];
  var i = row.indexOf(ID_HEADER);
  if (i >= 0) return i + 1;
  var c = (row[0] === '' && n === 1) ? 1 : n + 1;
  sh.getRange(1, c).setValue(ID_HEADER);
  sh.hideColumns(c);
  return c;
}
function sampleFor_(sh, header) {
  var hs = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0];
  var c = hs.indexOf(header) + 1; var last = sh.getLastRow();
  if (!c || last < 2) return [];
  return sh.getRange(2, c, Math.min(20, last - 1), 1).getValues().map(function (r) { return cell_(r[0]); });
}
function cell_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return v === undefined ? null : v;
}

/** All rows as {id, row:{header:cell}}; assigns ids to rows missing one. Cached per data version. */
function readRows_() {
  var ver = versions_().data, ck = 'rows:' + ver;
  var hit = getChunked_(ck); if (hit) return hit;
  var sh = sheet_(ALUMNI), ic = idCol_(sh), last = sh.getLastRow(), lastCol = sh.getLastColumn();
  var out = [];
  if (last >= 2) {
    var head = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
    var vals = sh.getRange(2, 1, last - 1, lastCol).getValues();
    vals.forEach(function (r, i) {
      var empty = r.every(function (v, j) { return j === ic - 1 || v === ''; });
      if (empty) return;
      var id = String(r[ic - 1] || '');
      if (!id) { id = Utilities.getUuid().slice(0, 8); sh.getRange(i + 2, ic).setValue(id); }
      var row = {}; head.forEach(function (h, j) { if (h && h !== ID_HEADER) row[h] = cell_(r[j]); });
      out.push({ id: id, row: row });
    });
  }
  putChunked_(ck, out);
  return out;
}

function findRowIndex_(sh, id) {
  var ic = idCol_(sh), last = sh.getLastRow();
  if (last < 2) return 0;
  var ids = sh.getRange(2, ic, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return 0;
}

// ---------------------------------------------------------------- mapping (mirror of mapping.ts)

function fromCell_(raw, type) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (type === 'number') { var n = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, '')); return isFinite(n) ? n : null; }
  if (type === 'boolean') return raw === true || /^(true|yes|y|1)$/i.test(String(raw).trim());
  if (type === 'multiselect') return String(raw).split(/\s*[;,]\s*/).filter(Boolean);
  var s = String(raw).trim(); return s || null;
}
function toCell_(v) { if (v === null || v === undefined) return ''; return Array.isArray(v) ? v.join('; ') : v; }

function toRecord_(item, cols, role) {
  var rec = { _id: item.id };
  cols.forEach(function (c) { if (canView_(c, role)) rec[c.key] = fromCell_(item.row[c.header], c.type); });
  return rec;
}

function listAlumni_(role) {
  var cols = (readConfig_() || { columns: [] }).columns;
  return readRows_().map(function (it) { return toRecord_(it, cols, role); });
}

function safeValues_(values, cols, role, partial) {
  var out = {};
  cols.forEach(function (c) {
    if (!(c.key in values) || !canEdit_(c, role)) return;
    var v = values[c.key];
    var bad = checkValue_(c, v); if (bad) fail_('INVALID', bad);
    out[c.key] = v;
  });
  cols.forEach(function (c) {
    var needs = c.required && canEdit_(c, role) && (!partial || c.key in out);
    var v = out[c.key];
    if (needs && (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length))) fail_('INVALID', c.label + ' is required');
  });
  return out;
}

function checkValue_(c, v) {
  if (v === null || v === undefined || v === '') return null;
  var s = String(v);
  switch (c.type) {
    case 'email': return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) ? null : c.label + ' must be a valid email';
    case 'url': return /^https?:\/\/\S+$/i.test(s) ? null : c.label + ' must be a http(s) URL';
    case 'number': return isFinite(Number(v)) ? null : c.label + ' must be a number';
    case 'select': return !(c.options && c.options.length) || c.options.indexOf(s) >= 0 ? null : c.label + ': "' + s + '" is not an allowed option';
    case 'multiselect': return Array.isArray(v) && (!(c.options && c.options.length) || v.every(function (x) { return c.options.indexOf(String(x)) >= 0; })) ? null : c.label + ' has an invalid option';
  }
  return null;
}

function writeCells_(sh, rowIdx, values, cols) {
  var hs = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  cols.forEach(function (c) {
    if (!(c.key in values)) return;
    var ci = hs.indexOf(c.header) + 1; if (!ci) return;
    var rng = sh.getRange(rowIdx, ci);
    if (c.type === 'phone' || c.type === 'text' || c.type === 'longtext') rng.setNumberFormat('@'); // stop "+91…" becoming a formula
    rng.setValue(toCell_(values[c.key]));
  });
}

function create_(values, role) {
  var cols = readConfig_().columns, sh = sheet_(ALUMNI), ic = idCol_(sh);
  var safe = safeValues_(values || {}, cols, role, false);
  var id = Utilities.getUuid().slice(0, 8), r = sh.getLastRow() + 1;
  sh.getRange(r, ic).setValue(id);
  writeCells_(sh, r, safe, cols);
  var v = bumpData_();
  return { value: toRecord_({ id: id, row: rowObj_(sh, r) }, cols, role), version: v };
}
function update_(id, patch, role) {
  var cols = readConfig_().columns, sh = sheet_(ALUMNI), r = findRowIndex_(sh, id);
  if (!r) fail_('NOT_FOUND', 'Record not found');
  writeCells_(sh, r, safeValues_(patch || {}, cols, role, true), cols);
  var v = bumpData_();
  return { value: toRecord_({ id: id, row: rowObj_(sh, r) }, cols, role), version: v };
}
function remove_(id) {
  var sh = sheet_(ALUMNI), r = findRowIndex_(sh, id);
  if (!r) fail_('NOT_FOUND', 'Record not found');
  sh.deleteRow(r);
  return { value: null, version: bumpData_() };
}
function rowObj_(sh, r) {
  var hs = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0], vals = sh.getRange(r, 1, 1, hs.length).getValues()[0], o = {};
  hs.forEach(function (h, j) { if (h && h !== ID_HEADER) o[h] = cell_(vals[j]); });
  return o;
}

// ---------------------------------------------------------------- config / versions / users

function readConfig_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(CONFIG); if (!sh) return null;
  var raw = sh.getRange('A1').getValue(); return raw ? JSON.parse(raw) : null;
}
function writeConfig_(cfg) { sheet_(CONFIG).getRange('A1').setValue(JSON.stringify(cfg)); }
function saveSchema_(columns) {
  if (!Array.isArray(columns) || !columns.length) fail_('INVALID', 'Schema needs at least one column');
  var keys = {}, heads = {};
  columns.forEach(function (c) {
    if (!c.key || !c.header) fail_('INVALID', 'Every column needs a key and a header');
    if (keys[c.key]) fail_('INVALID', 'Duplicate key ' + c.key); keys[c.key] = 1;
    if (heads[c.header.toLowerCase()]) fail_('INVALID', 'Two columns map to header "' + c.header + '"'); heads[c.header.toLowerCase()] = 1;
  });
  var cur = readConfig_() || { version: 0 }, next = { version: cur.version + 1, columns: columns };
  writeConfig_(next); bumpData_(); return next;
}
function versions_() {
  var sh = sheet_(CONFIG), cfg = readConfig_();
  return { schema: cfg ? cfg.version : 0, data: Number(sh.getRange('B1').getValue()) || 1 };
}
function bumpData_() {
  var sh = sheet_(CONFIG), n = (Number(sh.getRange('B1').getValue()) || 1) + 1;
  sh.getRange('B1').setValue(n); return { schema: (readConfig_() || { version: 0 }).version, data: n };
}

function readUsers_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(USERS); if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues().filter(function (r) { return r[0]; }).map(function (r) {
    return { email: String(r[0]).trim(), name: String(r[1] || ''), role: String(r[2] || 'viewer'), active: r[3] === true || /^(true|yes|1)$/i.test(String(r[3])) };
  });
}
function writeUsers_(users) {
  var sh = sheet_(USERS); sh.getRange(2, 1, Math.max(1, sh.getMaxRows() - 1), 4).clearContent();
  if (users.length) sh.getRange(2, 1, users.length, 4).setValues(users.map(function (u) { return [u.email, u.name, u.role, u.active]; }));
  return users;
}
function upsertUser_(user) {
  if (['viewer', 'editor', 'admin'].indexOf(user.role) < 0) fail_('INVALID', 'Bad role');
  var users = readUsers_(), i = -1;
  users.forEach(function (u, j) { if (u.email.toLowerCase() === user.email.toLowerCase()) i = j; });
  if (i >= 0) users[i] = user; else users.push(user);
  if (!users.some(function (u) { return u.role === 'admin' && u.active; })) fail_('INVALID', 'At least one active admin is required');
  return writeUsers_(users);
}
function removeUser_(email) {
  var users = readUsers_().filter(function (u) { return u.email.toLowerCase() !== email.toLowerCase(); });
  if (!users.some(function (u) { return u.role === 'admin' && u.active; })) fail_('INVALID', 'At least one active admin is required');
  return writeUsers_(users);
}

// ---------------------------------------------------------------- chunked CacheService (100KB/value limit)

function putChunked_(key, obj) {
  try {
    var s = JSON.stringify(obj), size = 90000, parts = Math.ceil(s.length / size) || 1, c = CacheService.getScriptCache(), m = {};
    for (var i = 0; i < parts; i++) m[key + ':' + i] = s.substr(i * size, size);
    m[key + ':n'] = String(parts); c.putAll(m, CACHE_TTL);
  } catch (e) { /* cache is best-effort */ }
}
function getChunked_(key) {
  var c = CacheService.getScriptCache(), n = Number(c.get(key + ':n')); if (!n) return null;
  var ks = []; for (var i = 0; i < n; i++) ks.push(key + ':' + i);
  var m = c.getAll(ks), s = ''; for (var j = 0; j < n; j++) { if (m[key + ':' + j] == null) return null; s += m[key + ':' + j]; }
  try { return JSON.parse(s); } catch (e) { return null; }
}

// ---------------------------------------------------------------- column inference (mirror of inferColumnDef)

function inferColumn_(header, samples, existing) {
  var h = header.toLowerCase(), vals = samples.filter(function (s) { return s !== '' && s != null; }).map(String);
  var all = function (re) { return vals.length > 0 && vals.every(function (v) { return re.test(v); }); };
  var type = 'text';
  if (/e-?mail/.test(h) || all(/^[^@\s]+@[^@\s]+\.[^@\s]+$/)) type = 'email';
  else if (/phone|mobile|contact no/.test(h)) type = 'phone';
  else if (/url|link|website|linkedin/.test(h) || all(/^https?:\/\//)) type = 'url';
  else if (all(/^\d{4}-\d{2}-\d{2}/)) type = 'date';
  else if (all(/^-?\d+(\.\d+)?$/)) type = 'number';
  else if (all(/^(true|false|yes|no)$/i)) type = 'boolean';
  else if (/notes?|comment|about|bio|description/.test(h)) type = 'longtext';
  var used = {}; existing.forEach(function (c) { used[c.key] = 1; });
  var base = header.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'col', key = /^[0-9]/.test(base) ? 'c_' + base : base;
  for (var i = 2; used[key]; i++) key = base + '_' + i;
  return { key: key, header: header, label: header.trim(), type: type, order: existing.length + 1,
    showInTable: existing.length < 8, filterable: type === 'boolean', searchable: ['text', 'email', 'longtext', 'phone'].indexOf(type) >= 0,
    sortable: type !== 'longtext', viewRoles: ['viewer', 'editor'], editRoles: ['editor'], required: false };
}
