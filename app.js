/* ============================================================
   app.js - v4.3.7 (CONSOLIDATED + IIFE WRAP)
   ============================================================ */

// Version marker — cek di console browser: APP_VERSION
window.APP_VERSION = 'v4.3.7';

;(function () {

/* ============================================================
   PART 1: core.js (Config + Auth + UI Helpers + Firebase)
   ============================================================ */

/* ============================================================
   core.js - v3.0 (SIMPLIFIED)
   Gabungan: config + auth + ui-helper + firebase-helper
   ============================================================ */

// =====================================================
// 1. CONFIG
// =====================================================

const API_URL = "https://script.google.com/macros/s/AKfycbw3lWUjVJTMwN6rToovwtcUx0OXaeWlRtR7RRjPBJfV2Ay5_xXzUyP449FI-7-MCUfx9w/exec";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBY6B_AMQjeWCfzQiVPtQCLTlTz3ShInwo",
  authDomain: "purchase-request-system-47767.firebaseapp.com",
  databaseURL: "https://purchase-request-system-47767-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "purchase-request-system-47767",
  storageBucket: "purchase-request-system-47767.firebasestorage.app",
  messagingSenderId: "197480550971",
  appId: "1:197480550971:web:bae4bcfc99e6dddbb3c21e"
};

const USE_FIREBASE = true;

const ROLE_NAMES = {
  admin: 'Administrator Utama',
  viewer: 'Analyst/Viewer',
  staff_a: 'Office Staff A',
  staff_b: 'Reviewer Staff B',
  staff_c: 'Administrator C'
};

const PERMISSIONS = {
  admin: ['dashboard', 'request', 'approval', 'done', 'rekap', 'rejected', 'miniproject', 'print'],
  viewer: ['dashboard', 'request', 'miniproject', 'print'],
  staff_a: ['dashboard', 'request', 'rekap', 'rejected', 'miniproject', 'print'],
  staff_b: ['dashboard', 'request', 'approval', 'done', 'rekap', 'miniproject', 'print'],
  staff_c: ['dashboard', 'request', 'approval', 'done', 'rekap', 'rejected', 'miniproject', 'print']
};

const APP_CONFIG = {
  name: 'Purchase Request System',
  version: '3.0.0',
  environment: (function () {
    var h = window.location.hostname;
    return (h === 'localhost' || h === '127.0.0.1') ? 'development' : 'production';
  })(),
  features: {
    caching: true,
    debug: (function () {
      try {
        var s = localStorage.getItem('pr_debug');
        if (s !== null) return s === 'true';
        var h = window.location.hostname;
        return h === 'localhost' || h === '127.0.0.1';
      } catch (e) { return false; }
    })(),
    firebase: USE_FIREBASE
  },
  cache: { ttl: 5 * 60 * 1000 },
  auth: { sessionTimeoutHours: 8, crossTabSync: true },
  sync: {
    autoSyncInterval: 5 * 60 * 1000,  // 5 menit
    autoRefreshInterval: 0              // 0 = disabled
  }
};

// Debug loggers
window.debugLog = function () {
  if (!APP_CONFIG.features.debug) return;
  var a = Array.prototype.slice.call(arguments);
  a.unshift('[PR ' + new Date().toLocaleTimeString() + ']');
  console.log.apply(console, a);
};
window.debugWarn = function () {
  if (!APP_CONFIG.features.debug) return;
  var a = Array.prototype.slice.call(arguments);
  a.unshift('[PR WARN]');
  console.warn.apply(console, a);
};
window.debugError = function () {
  var a = Array.prototype.slice.call(arguments);
  a.unshift('[PR ERROR]');
  console.error.apply(console, a);
};

debugLog('🔍 Core loaded. Environment:', APP_CONFIG.environment, '| Debug:', APP_CONFIG.features.debug, '| Firebase:', USE_FIREBASE);


// =====================================================
// 2. AUTH
// =====================================================

var AUTH_CONFIG = {
  sessionTimeout: APP_CONFIG.auth.sessionTimeoutHours,
  crossTabSync: APP_CONFIG.auth.crossTabSync
};

function normalizeRole(role) {
  if (!role) return 'viewer';
  var r = String(role).toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

  // Mapping role dari server ke key PERMISSIONS
  // Server mungkin kirim: 'Administrator C', 'Staff C', 'Office Staff A', dll
  var roleMap = {
    'admin': 'admin',
    'administrator': 'admin',
    'administrator_utama': 'admin',
    'superadmin': 'admin',
    'super_admin': 'admin',
    'viewer': 'viewer',
    'analyst': 'viewer',
    'analyst_viewer': 'viewer',
    'guest': 'viewer',
    'tamu': 'viewer',
    'staff_a': 'staff_a',
    'office_staff_a': 'staff_a',
    'staff_b': 'staff_b',
    'reviewer_staff_b': 'staff_b',
    'reviewer': 'staff_b',
    'staff_c': 'staff_c',
    'administrator_c': 'staff_c',
    'admin_c': 'staff_c',
    'user': 'viewer',
    'pengguna': 'viewer',
    'member': 'viewer'
  };

  return roleMap[r] || r;
}

function checkAuth() {
  var isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
  if (isLoggedIn && !validateSession()) {
    clearUserSession();
    return false;
  }
  return isLoggedIn;
}

function checkPermission(page) {
  if (!checkAuth()) return false;
  var role = normalizeRole(sessionStorage.getItem('userRole') || 'viewer');
  if (typeof PERMISSIONS === 'undefined') return page === 'dashboard';
  return (PERMISSIONS[role] || []).indexOf(page) !== -1;
}

function setUserSession(username, fullName, role) {
  sessionStorage.setItem('username', username);
  sessionStorage.setItem('fullName', fullName);
  sessionStorage.setItem('userRole', role);
  sessionStorage.setItem('isLoggedIn', 'true');
  sessionStorage.setItem('loginTime', new Date().toISOString());
  if (AUTH_CONFIG.crossTabSync && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('pr_auth_event', JSON.stringify({ type: 'login', username: username, role: role, t: Date.now() }));
    } catch (e) {}
  }
}

function clearUserSession() {
  sessionStorage.clear();
  if (AUTH_CONFIG.crossTabSync && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('pr_auth_event', JSON.stringify({ type: 'logout', t: Date.now() }));
    } catch (e) {}
  }
}

function validateSession() {
  var loginTime = sessionStorage.getItem('loginTime');
  if (!loginTime) return false;
  var elapsed = Date.now() - new Date(loginTime).getTime();
  return elapsed <= AUTH_CONFIG.sessionTimeout * 60 * 60 * 1000;
}

function logout() {
  if (confirm('Keluar dari aplikasi?')) {
    clearUserSession();
    window.location.href = 'login.html';
  }
}

function protectPage() {
  if (!checkAuth()) {
    debugLog('Not authenticated, redirecting to login');
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

function setupCrossTabSync() {
  if (!AUTH_CONFIG.crossTabSync || typeof localStorage === 'undefined') return;
  window.addEventListener('storage', function (e) {
    if (e.key !== 'pr_auth_event' || !e.newValue) return;
    try {
      var event = JSON.parse(e.newValue);
      if (event.type === 'logout') {
        sessionStorage.clear();
        alert('Sesi telah berakhir (logout dari tab lain).');
        window.location.href = 'login.html';
      } else if (event.type === 'login' && window.location.pathname.indexOf('login.html') !== -1) {
        window.location.href = 'dashboard.html';
      }
    } catch (err) {}
  });
}

// Init auth (validate session, periodic check, cross-tab sync)
document.addEventListener('DOMContentLoaded', function () {
  if (sessionStorage.getItem('isLoggedIn') === 'true' && !validateSession()) {
    alert('Sesi Anda telah berakhir. Silakan login kembali.');
    clearUserSession();
    window.location.href = 'login.html';
    return;
  }
  setInterval(function () {
    if (sessionStorage.getItem('isLoggedIn') === 'true' && !validateSession()) {
      alert('Sesi Anda telah berakhir. Silakan login kembali.');
      clearUserSession();
      window.location.href = 'login.html';
    }
  }, 5 * 60 * 1000);
  setupCrossTabSync();
});


// =====================================================
// 3. CACHE + UTILS (from ui-helper)
// =====================================================

var dataCache = {};
var CACHE_TIMEOUT = APP_CONFIG.cache.ttl;

function getCachedData(key) {
  var c = dataCache[key];
  if (!c) return null;
  if (Date.now() - c.timestamp > CACHE_TIMEOUT) { delete dataCache[key]; return null; }
  return c.data;
}

function setCachedData(key, data) {
  dataCache[key] = { data: data, timestamp: Date.now() };
}

function clearCache(key) {
  if (key === undefined || key === null) {
    Object.keys(dataCache).forEach(function (k) { delete dataCache[k]; });
  } else {
    delete dataCache[key];
  }
}

function clearCacheForAction() {
  clearCache('main');
  clearCache('done');
  clearCache('rejected');
}

// Formatters
function formatDate(v) {
  if (!v || v === 'Never Buy') return v || '';
  try {
    var d = new Date(v);
    if (isNaN(d.getTime())) return v;
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  } catch (e) { return v; }
}

function formatDateTime(v) {
  if (!v) return '';
  try {
    var d = new Date(v);
    if (isNaN(d.getTime())) return v;
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  } catch (e) { return v; }
}

function formatRupiah(v) {
  if (v === '' || v == null || isNaN(v)) return '';
  try {
    var n = parseFloat(v);
    return 'Rp ' + n.toLocaleString('id-ID', {
      minimumFractionDigits: n % 1 !== 0 ? 2 : 0,
      maximumFractionDigits: 2
    });
  } catch (e) { return v; }
}

function formatNumber(v) {
  if (v === '' || v == null || isNaN(v)) return '';
  try { return parseFloat(v).toLocaleString('id-ID'); } catch (e) { return v; }
}

function _escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// lazyRenderRows dengan anti-race + signature hash
function lazyRenderRows(rowsHtmlArray, tbody, batchSize, token) {
  if (batchSize === undefined) batchSize = 50;
  if (!Array.isArray(rowsHtmlArray) || !tbody) return;
  if (token && token.cancelled) return;
  var sig = rowsHtmlArray.length + '|' + (rowsHtmlArray[0] || '').substring(0, 50);
  if (tbody.dataset.signature === sig && tbody.children.length === rowsHtmlArray.length) return;
  tbody.dataset.signature = sig;
  tbody.innerHTML = '';
  if (rowsHtmlArray.length === 0) return;
  var i = 0;
  function renderBatch() {
    if (token && token.cancelled) return;
    if (i >= rowsHtmlArray.length) return;
    var end = Math.min(i + batchSize, rowsHtmlArray.length);
    tbody.insertAdjacentHTML('beforeend', rowsHtmlArray.slice(i, end).join(''));
    i = end;
    if (i < rowsHtmlArray.length) requestAnimationFrame(renderBatch);
  }
  renderBatch();
}

function debounceSearch(func, wait) {
  var t = null;
  return function () {
    var args = arguments, ctx = this;
    clearTimeout(t);
    t = setTimeout(function () { t = null; func.apply(ctx, args); }, wait);
  };
}

// Toast queue
var _toastQueue = [], _toastActive = false;
function showToast(msg, type, duration) {
  if (type === undefined) type = 'success';
  if (duration === undefined) duration = 3000;
  _toastQueue.push({ msg: msg, type: type, duration: duration });
  if (!_toastActive) _processToastQueue();
}
function _processToastQueue() {
  if (_toastQueue.length === 0) { _toastActive = false; return; }
  _toastActive = true;
  var item = _toastQueue.shift();
  var toast = document.getElementById('toast');
  if (!toast) { toast = document.createElement('div'); toast.id = 'toast'; toast.className = 'toast'; document.body.appendChild(toast); }
  toast.textContent = item.msg;
  toast.className = 'toast show';
  toast.style.cssText = 'background:' + (item.type === 'error' ? '#dc2626' : item.type === 'warning' ? '#f59e0b' : '#16a34a') + ';color:#fff;padding:12px 20px;border-radius:8px;font-weight:600;box-shadow:0 10px 15px rgba(0,0,0,0.2);position:fixed;top:20px;right:20px;z-index:9999;transition:all 0.3s ease;max-width:90vw;word-wrap:break-word;';
  setTimeout(function () { toast.classList.remove('show'); setTimeout(_processToastQueue, 250); }, item.duration);
}

// Loading overlay
document.addEventListener('DOMContentLoaded', function () {
  if (!document.getElementById('globalLoading')) {
    var l = document.createElement('div');
    l.id = 'globalLoading';
    l.style.cssText = 'position:fixed;inset:0;background:rgba(255,255,255,0.8);display:none;justify-content:center;align-items:center;z-index:9999;';
    l.innerHTML = '<div style="background:white;padding:20px;border-radius:12px;box-shadow:0 4px 15px rgba(0,0,0,0.15);display:flex;gap:15px;align-items:center;"><div style="width:24px;height:24px;border:3px solid #e5e7eb;border-top:3px solid #2563eb;border-radius:50%;animation:prspin 1s linear infinite"></div><span style="font-family:sans-serif;color:#374151;">Memuat data...</span></div><style>@keyframes prspin { to { transform: rotate(360deg); } }</style>';
    document.body.appendChild(l);
  }
});
var _loadingCount = 0;
function showLoading(show) {
  if (show === undefined) show = true;
  var l = document.getElementById('globalLoading');
  if (!l) return;
  if (show) { _loadingCount++; l.style.display = 'flex'; }
  else { _loadingCount = Math.max(0, _loadingCount - 1); if (_loadingCount === 0) l.style.display = 'none'; }
}

// Confirm dialog (modal, replaces prompt/confirm)
function confirmDialog(opts) {
  opts = opts || {};
  var title = opts.title || 'Konfirmasi';
  var message = opts.message || 'Apakah Anda yakin?';
  var confirmText = opts.confirmText || 'Ya';
  var cancelText = opts.cancelText || 'Batal';
  var type = opts.type || 'info';
  var onConfirm = opts.onConfirm || function () {};
  var onCancel = opts.onCancel || function () {};
  var inputConfig = opts.input;

  var existing = document.getElementById('confirmModal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'confirmModal';
  modal.className = 'modal show';
  var btnClass = type === 'danger' ? 'btn-danger' : 'btn-primary';
  var inputHtml = '';
  if (inputConfig) {
    inputHtml = '<div style="margin:14px 0;">' +
      (inputConfig.label ? '<label style="display:block;font-size:12px;font-weight:600;color:#6b7280;margin-bottom:6px;">' + _escapeHtml(inputConfig.label) + '</label>' : '') +
      '<input id="confirmInput" type="' + (inputConfig.type || 'text') + '" placeholder="' + _escapeHtml(inputConfig.placeholder || '') + '" style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:6px;font-size:14px;">' +
      '<div id="confirmInputError" style="color:#dc2626;font-size:11px;margin-top:4px;min-height:14px;"></div></div>';
  }
  modal.innerHTML = '<div class="modal-content" style="max-width:480px;"><div class="modal-header"><h3 style="margin:0;font-size:1.2rem;">' + _escapeHtml(title) + '</h3><button class="modal-close" onclick="_cancelConfirm()">×</button></div><div style="padding:8px 0;font-size:14px;color:#374151;line-height:1.6;">' + (/<[a-z/][\s\S]*>/i.test(message) ? message : _escapeHtml(message)) + '</div>' + inputHtml + '<div class="form-actions" style="margin-top:16px;justify-content:flex-end;"><button class="btn-secondary" onclick="_cancelConfirm()">' + _escapeHtml(cancelText) + '</button><button class="' + btnClass + '" id="confirmOkBtn">' + _escapeHtml(confirmText) + '</button></div></div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', function (e) { if (e.target === modal) _cancelConfirm(); });
  function _close() { modal.remove(); }
  window._cancelConfirm = function () { _close(); onCancel(); };
  document.getElementById('confirmOkBtn').addEventListener('click', function () {
    if (inputConfig) {
      var val = document.getElementById('confirmInput').value;
      if (inputConfig.validate) {
        var err = inputConfig.validate(val);
        if (err) { document.getElementById('confirmInputError').textContent = err; return; }
      }
      _close(); onConfirm(val);
    } else { _close(); onConfirm(); }
  });
  if (inputConfig) {
    setTimeout(function () { document.getElementById('confirmInput').focus(); }, 100);
    document.getElementById('confirmInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); document.getElementById('confirmOkBtn').click(); }
    });
  }
}

// User floater
function renderUserStatus() {
  var c = document.getElementById('userFloater');
  if (!c) return;
  var u = sessionStorage.getItem('username') || 'User';
  var r = sessionStorage.getItem('userRole') || 'viewer';
  var role = normalizeRole(r);
  var rn = (typeof ROLE_NAMES !== 'undefined' && ROLE_NAMES[role]) || r;
  c.innerHTML = '<div class="user-avatar">' + (u.charAt(0) || 'U').toUpperCase() + '</div><div class="user-meta"><div class="user-id">' + _escapeHtml(u) + '</div><div class="user-tag">' + _escapeHtml(rn) + '</div></div><button class="nav-logout" onclick="handleLogout()" title="Logout">✕</button>';
}
function handleLogout() { logout(); }


// =====================================================
// 4. FIREBASE
// =====================================================

var firebaseApp = null, firebaseDb = null, firebaseInitialized = false, isSyncing = false;

function initFirebase() {
  if (!USE_FIREBASE) return false;
  try {
    if (typeof firebase === 'undefined') { console.warn('⚠️ Firebase SDK not loaded'); return false; }
    if (!firebase.apps.length) {
      firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
      firebaseDb = firebase.database();
      firebaseInitialized = true;
      debugLog('✅ Firebase initialized');
      firebaseDb.goOnline();
      return true;
    } else {
      firebaseApp = firebase.app();
      firebaseDb = firebase.database();
      firebaseInitialized = true;
      return true;
    }
  } catch (err) { debugError('❌ Firebase init error:', err); return false; }
}

function saveToFirebase(path, data) {
  if (!firebaseInitialized || !USE_FIREBASE) return Promise.resolve(false);
  return new Promise(function (resolve, reject) {
    try {
      firebaseDb.ref(path).set(data, function (error) {
        if (error) reject(error); else { debugLog('✅ Saved to Firebase:', path); resolve(true); }
      });
    } catch (err) { reject(err); }
  });
}

function loadFromFirebase(path) {
  if (!firebaseInitialized || !USE_FIREBASE) return Promise.resolve(null);
  return new Promise(function (resolve, reject) {
    try {
      firebaseDb.ref(path).once('value', function (snap) {
        var d = snap.val();
        if (d) debugLog('✅ Loaded from Firebase:', path, Array.isArray(d) ? d.length + ' records' : '');
        resolve(d);
      }, function (err) { reject(err); });
    } catch (err) { reject(err); }
  });
}

function removeFromFirebase(path) {
  if (!firebaseInitialized || !USE_FIREBASE) return Promise.resolve(false);
  return new Promise(function (resolve, reject) {
    try {
      firebaseDb.ref(path).remove(function (err) { if (err) reject(err); else resolve(true); });
    } catch (err) { reject(err); }
  });
}

// Sync Firebase with Google Sheet
function syncFirebaseWithSheet(sheetName, forceRefresh, silent) {
  if (forceRefresh === undefined) forceRefresh = false;
  if (sheetName === undefined) sheetName = '';
  if (silent === undefined) silent = false;

  if (isSyncing) return Promise.resolve({ success: false, message: 'Sync in progress' });

  isSyncing = true;
  if (!silent) showToast('🔄 Sinkronisasi data...', 'warning', 5000);

  var cacheKey = sheetName || 'main';
  var firebasePath = 'purchase_data/' + cacheKey;

  return new Promise(function (resolve, reject) {
    debugLog('🌐 Syncing from Google Sheet:', sheetName || 'main');
    loadDataFromAPI(function (apiData) {
      if (!apiData || apiData.length === 0) {
        isSyncing = false;
        if (!silent) showToast('⚠️ Tidak ada data dari Google Sheet', 'error');
        resolve({ success: false });
        return;
      }
      saveToFirebase(firebasePath, apiData)
        .then(function () {
          return saveToFirebase('purchase_data/_lastSync_' + cacheKey, { lastSync: new Date().toISOString(), count: apiData.length });
        })
        .then(function () {
          setCachedData(cacheKey, apiData);
          isSyncing = false;
          debugLog('✅ Sync completed:', apiData.length, 'records');
          if (!silent) showToast('✅ Sinkronisasi berhasil! ' + apiData.length + ' data', 'success');
          resolve({ success: true, count: apiData.length });
        })
        .catch(function (err) {
          isSyncing = false;
          debugError('❌ Sync failed:', err);
          if (!silent) showToast('❌ Sinkronisasi gagal: ' + err.message, 'error');
          reject(err);
        });
    }, sheetName);
  });
}

// JSONP loader (Apps Script compatible)
// FIX v4.1: Tambah normalisasi data + fetch fallback
function loadDataFromAPI(callback, sheetName) {
  if (sheetName === undefined) sheetName = '';

  // Coba FETCH dulu (lebih reliable, support error handling)
  _loadDataViaFetch(sheetName)
    .then(function (data) {
      var normalized = _normalizeData(data);
      debugLog('🌐 API (fetch) loaded:', sheetName || 'main', '→', normalized.length, 'records');
      callback(normalized);
    })
    .catch(function (fetchErr) {
      debugWarn('Fetch failed, trying JSONP:', fetchErr.message);
      _loadDataViaJSONP(sheetName, callback);
    });
}

// FIX v4.1: Fetch-based loader (fallback untuk JSONP)
// FIX v4.1.1: GAS SELALU bungkus response dengan callback(...) meski tanpa
// parameter callback. Jadi kita WAJIB parse text + strip wrapper.
function _loadDataViaFetch(sheetName) {
  var url = new URL(API_URL);
  url.searchParams.set('action', 'read');
  if (sheetName) url.searchParams.set('sheet', sheetName);
  url.searchParams.set('_t', Date.now());

  return fetch(url.toString(), { method: 'GET' })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then(function (text) {
      // GAS selalu return: callback([...]) atau callback({...})
      // Strip wrapper callback(...) untuk dapat JSON murni
      var jsonStr = _extractJsonFromResponse(text);
      try {
        return JSON.parse(jsonStr);
      } catch (e) {
        debugError('JSON parse failed. Raw response (first 200 chars):', text.substring(0, 200));
        throw new Error('Invalid JSON response from GAS');
      }
    });
}

// FIX v4.1.1: Extract JSON dari response GAS yang terbungkus callback
// Gas response format:
//   callback([{"ID":"PR-001",...}])      → ambil bagian dalam kurung
//   callback({...})                       → ambil bagian dalam kurung
//   [{"ID":"PR-001",...}]                 → langsung (JSON murni)
//   {...}                                 → langsung (JSON murni)
function _extractJsonFromResponse(text) {
  if (!text || typeof text !== 'string') return '';
  var trimmed = text.trim();

  // Cek apakah ada wrapper callback(...)
  // Pattern: identifier(  ...  )  dengan opsional ; di akhir
  var match = trimmed.match(/^[a-zA-Z_$][\w$]*\s*\(([\s\S]*)\)\s*;?\s*$/);
  if (match) {
    return match[1].trim();
  }

  // Bisa juga format dengan spasi/newline setelah callback
  match = trimmed.match(/^[a-zA-Z_$][\w$]*\s*\(([\s\S]*)\)/);
  if (match) {
    return match[1].trim();
  }

  // JSON murni (tidak ada wrapper)
  return trimmed;
}

// FIX v4.1: JSONP loader (original method, sebagai fallback)
function _loadDataViaJSONP(sheetName, callback) {
  var ts = Date.now(), rnd = Math.random().toString(36).substr(2, 9);
  var cbName = 'cb_sync_' + ts + '_' + rnd;
  var resolved = false, tid = null;

  window[cbName] = function (data) {
    if (resolved) return;
    resolved = true;
    if (tid) clearTimeout(tid);
    try {
      if (!data) { callback([]); return; }
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) { callback([]); return; } }
      var normalized = _normalizeData(data);
      debugLog('🌐 API (JSONP) loaded:', sheetName || 'main', '→', normalized.length, 'records');
      callback(normalized);
    } catch (err) { debugError('API data error:', err); callback([]); }
    finally { _cleanup(cbName); }
  };

  tid = setTimeout(function () {
    if (!resolved) {
      resolved = true; _cleanup(cbName);
      debugWarn('API timeout:', sheetName);
      callback([]);
    }
  }, 15000);

  try {
    var url = new URL(API_URL);
    url.searchParams.set('action', 'read');
    if (sheetName) url.searchParams.set('sheet', sheetName);
    url.searchParams.set('callback', cbName);
    url.searchParams.set('_t', ts);
    var s = document.createElement('script');
    s.id = 'script-' + cbName;
    s.src = url.toString();
    s.async = true;
    s.onerror = function () {
      if (!resolved) {
        resolved = true; _cleanup(cbName);
        debugError('JSONP script error:', sheetName);
        callback([]);
      }
    };
    document.body.appendChild(s);
  } catch (err) { _cleanup(cbName); callback([]); }
}

// FIX v4.1: Normalisasi data dari berbagai format Apps Script
// Format 1: [{ID:'PR-001', Status:'pending', ...}, ...]  → langsung pakai
// Format 2: [['ID','Status',...], ['PR-001','pending',...], ...]  → convert ke objects
// Format 3: {data: [...]} atau {rows: [...]}  → extract array
// Format 4: {success: true, data: [...]}  → extract data
function _normalizeData(data) {
  if (!data) return [];

  // Format 3/4: object dengan property data/rows
  if (!Array.isArray(data) && typeof data === 'object') {
    if (data.data && Array.isArray(data.data)) data = data.data;
    else if (data.rows && Array.isArray(data.rows)) data = data.rows;
    else if (data.values && Array.isArray(data.values)) data = data.values;
    else return [];
  }

  if (!Array.isArray(data) || data.length === 0) return [];

  // Cek apakah data sudah array of objects (Format 1)
  if (typeof data[0] === 'object' && data[0] !== null && !Array.isArray(data[0])) {
    return data;
  }

  // Format 2: array of arrays — konversi ke objects
  if (Array.isArray(data[0])) {
    var headers = data[0];
    var result = [];
    for (var i = 1; i < data.length; i++) {
      if (!data[i] || data[i].length === 0) continue;
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        if (headers[j] != null) {
          obj[headers[j]] = data[i][j] != null ? data[i][j] : '';
        }
      }
      result.push(obj);
    }
    debugLog('🔧 Data normalized from 2D array:', data.length - 1, '→', result.length, 'records');
    return result;
  }

  return data;
}

function _cleanup(cbName) {
  delete window[cbName];
  var s = document.getElementById('script-' + cbName);
  if (s && s.parentNode) s.parentNode.removeChild(s);
}

// Cache-first load: cache → Firebase → API
// FIX v4.1: Jika Firebase return data kosong/stale, LANGSUNG fallback ke API
function loadDataSmart(callback, sheetName, forceRefresh) {
  if (forceRefresh === undefined) forceRefresh = false;
  if (sheetName === undefined) sheetName = '';
  var cacheKey = sheetName || 'main';
  var firebasePath = 'purchase_data/' + cacheKey;
  var called = false;
  function done(data) { if (!called) { called = true; if (callback) callback(data); } }

  if (forceRefresh) {
    // Force refresh: langsung hit API, skip cache/firebase
    loadDataFromAPI(function (data) {
      if (data && data.length > 0) {
        setCachedData(cacheKey, data);
        if (USE_FIREBASE && firebaseInitialized) saveToFirebase(firebasePath, data).catch(function(){});
      }
      done(data || []);
    }, sheetName);
    return;
  }

  // 1. Cache lokal (hanya jika masih fresh < 5 menit)
  var local = getCachedData(cacheKey);
  if (local && local.length > 0) {
    debugLog('📦 From cache:', cacheKey, local.length, 'records');
    setTimeout(function () { done(local); }, 0);
    return;
  }

  // 2. Firebase (tapi hanya sebagai intermediate, bukan sumber utama)
  if (USE_FIREBASE && firebaseInitialized) {
    loadFromFirebase(firebasePath)
      .then(function (d) {
        if (d && d.length > 0) {
          setCachedData(cacheKey, d);
          done(d);
        } else {
          // FIX: Firebase kosong → langsung ke API
          debugLog('🔄 Firebase empty for', cacheKey, '→ fetching API');
          loadDataFromAPI(function (data) {
            if (data && data.length > 0) {
              setCachedData(cacheKey, data);
              saveToFirebase(firebasePath, data).catch(function(){});
            }
            done(data || []);
          }, sheetName);
        }
      })
      .catch(function (err) {
        debugWarn('Firebase error:', err.message, '→ fetching API');
        loadDataFromAPI(function (data) {
          if (data && data.length > 0) setCachedData(cacheKey, data);
          done(data || []);
        }, sheetName);
      });
  } else {
    // 3. Tanpa Firebase → langsung API
    loadDataFromAPI(function (data) {
      if (data && data.length > 0) setCachedData(cacheKey, data);
      done(data || []);
    }, sheetName);
  }
}

// Convenience wrapper
function loadDataOptimized(callback, sheetName) {
  if (typeof USE_FIREBASE !== 'undefined' && USE_FIREBASE && typeof loadDataSmart === 'function') {
    loadDataSmart(callback, sheetName, false);
  } else {
    loadDataFromAPI(callback, sheetName);
  }
}

// FIX v4.2.1: Force refresh wrapper — langsung hit API, skip cache & Firebase.
// Dipakai setelah action (approve/reject/done) supaya data selalu fresh,
// tidak pakai Firebase cache yang bisa stale.
function loadDataOptimizedForce(callback, sheetName) {
  debugLog('🔄 Force refresh (skip cache & Firebase):', sheetName || 'main');
  loadDataFromAPI(function (data) {
    var cacheKey = sheetName || 'main';
    if (data && data.length > 0) {
      setCachedData(cacheKey, data);
      // Update Firebase juga supaya sync
      if (USE_FIREBASE && firebaseInitialized) {
        saveToFirebase('purchase_data/' + cacheKey, data).catch(function(){});
      }
    }
    if (callback) callback(data || []);
  }, sheetName);
}

function loadMultipleSheets(sheets, onAllLoaded) {
  var results = {}, loaded = 0, total = sheets.length;
  if (total === 0) { if (onAllLoaded) onAllLoaded(results); return; }
  sheets.forEach(function (sheet) {
    loadDataOptimized(function (data) {
      results[sheet] = data || [];
      loaded++;
      if (loaded === total && onAllLoaded) { try { onAllLoaded(results); } catch (e) { debugError('loadMultipleSheets callback error:', e); } }
    }, sheet);
  });
}

// Sync all sheets (silent) + dispatch event
function syncAllSheets(silent) {
  if (silent === undefined) silent = false;
  var sheets = ['', 'done', 'rejected'];
  var results = {}, done = 0;
  if (!silent) showToast('🔄 Sinkronisasi semua data...', 'warning', 5000);
  sheets.forEach(function (sheet) {
    syncFirebaseWithSheet(sheet, true, true)
      .then(function (r) { results[sheet || 'main'] = r; done++; if (done === sheets.length) _onSyncAllDone(results, sheets, silent); })
      .catch(function (e) { results[sheet || 'main'] = { success: false, error: e.message }; done++; if (done === sheets.length) _onSyncAllDone(results, sheets, silent); });
  });
}

function _onSyncAllDone(results, sheets, silent) {
  var total = 0;
  sheets.forEach(function (s) { if (results[s || 'main'] && results[s || 'main'].count) total += results[s || 'main'].count; });
  if (!silent) showToast('✅ Sinkronisasi selesai! Total ' + total + ' data', 'success');
  // Dispatch event supaya page JS bisa soft-refresh
  window.dispatchEvent(new CustomEvent('pr:syncComplete', { detail: { results: results } }));
}

// Auto sync (silent, skip kalau tab hidden)
function startAutoSync(intervalMinutes) {
  if (!intervalMinutes) { debugLog('ℹ️ Auto-sync disabled'); return; }
  debugLog('🔄 Auto-sync started:', intervalMinutes, 'min');
  setInterval(function () {
    if (document.hidden) return;
    debugLog('🔄 Auto-sync triggered');
    ['', 'done', 'rejected'].forEach(function (sheet) {
      syncFirebaseWithSheet(sheet, true, true).catch(function (e) { debugWarn('Auto-sync fail:', sheet, e.message); });
    });
  }, intervalMinutes * 60 * 1000);
}

// Add sync button HANYA di dashboard
// FIX v4.2.8: Sync & Migrasi hanya muncul di dashboard, tidak di halaman lain
function addSyncButton() {
  // Cek apakah ini halaman dashboard (body class atau URL)
  var body = document.body;
  var isDashboard = false;
  if (body && body.classList.contains('theme-dashboard')) {
    isDashboard = true;
  } else {
    var path = window.location.pathname.toLowerCase();
    var file = path.substring(path.lastIndexOf('/') + 1);
    if (file === 'dashboard.html' || file === '' || file === 'index.html') {
      isDashboard = true;
    }
  }

  // Kalau bukan dashboard, jangan tambah tombol
  if (!isDashboard) return;

  var ha = document.querySelector('.header');
  if (!ha) { setTimeout(addSyncButton, 1000); return; }
  if (document.getElementById('syncButton')) return;

  // FIX v4.2.9: Pindah ke kanan bawah viewport (lebih estetis)
  var wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex; gap:8px; align-items:center; position:fixed; bottom:20px; right:20px; z-index:9999; background:rgba(255,255,255,0.95); padding:8px 12px; border-radius:8px; box-shadow:0 2px 12px rgba(0,0,0,0.15);';

  // Tombol Sync
  var syncBtn = document.createElement('button');
  syncBtn.id = 'syncButton';
  syncBtn.className = 'btn-secondary';
  syncBtn.style.cssText = 'display:flex;align-items:center;gap:6px;';
  syncBtn.innerHTML = '🔄 Sync';
  syncBtn.onclick = function () {
    confirmDialog({
      title: 'Sinkronisasi Firebase',
      message: 'Sinkronkan semua data dari Google Sheet ke Firebase?<br><br><small>Ini akan meng-copy data terbaru dari spreadsheet ke Firebase cache, supaya loading lebih cepat dan data konsisten.</small>',
      confirmText: 'Ya, Sync',
      onConfirm: function () { syncAllSheets(false); }
    });
  };

  // FIX v4.2.7: Tombol Migrasi — untuk input manual via spreadsheet
  var migrasiBtn = document.createElement('button');
  migrasiBtn.id = 'migrasiButton';
  migrasiBtn.className = 'btn-secondary';
  migrasiBtn.style.cssText = 'display:flex;align-items:center;gap:6px;background:#0f766e;color:#fff;';
  migrasiBtn.innerHTML = '📋 Migrasi';
  migrasiBtn.onclick = function () {
    showMigrasiDialog();
  };

  wrapper.appendChild(syncBtn);
  wrapper.appendChild(migrasiBtn);
  // Append ke body supaya position:fixed benar-benar independen
  document.body.appendChild(wrapper);
}

// FIX v4.2.7: Dialog Migrasi Data
// Pilihan: (1) Spreadsheet → Firebase (copy data sheet ke Firebase)
//          (2) Firebase → Spreadsheet (tidak didukung, read-only)
//          (3) Cek konsistensi (compare jumlah data)
function showMigrasiDialog() {
  confirmDialog({
    title: 'Migrasi & Konsistensi Data',
    message: '<div style="text-align:left;line-height:1.7;">' +
      '<p><b>Pilih aksi:</b></p>' +
      '<p>🔄 <b>Sync Spreadsheet → Firebase</b><br><small>Copy semua data dari Google Sheet ke Firebase cache. Pakai kalau Anda input manual via spreadsheet dan Firebase tidak update.</small></p>' +
      '<p>📊 <b>Cek Konsistensi</b><br><small>Compare jumlah data di Spreadsheet vs Firebase. Tampilkan selisih kalau ada.</small></p>' +
      '<p>🗑️ <b>Clear Firebase Cache</b><br><small>Hapus semua data di Firebase cache. Pakai kalau Firebase ada data korup/stale.</small></p>' +
      '</div>',
    confirmText: '🔄 Sync',
    cancelText: 'Tutup',
    onConfirm: function () {
      // Sync full
      syncAllSheets(false);
    },
    onCancel: function () {
      // Tampilkan opsi lanjutan
      showMigrasiOptions();
    }
  });
}

function showMigrasiOptions() {
  confirmDialog({
    title: 'Opsi Migrasi Lanjutan',
    message: 'Pilih opsi:',
    confirmText: '📊 Cek Konsistensi',
    cancelText: '🗑️ Clear Cache',
    onConfirm: function () { checkDataConsistency(); },
    onCancel: function () { clearFirebaseCache(); }
  });
}

// FIX v4.2.7: Cek konsistensi data Spreadsheet vs Firebase
function checkDataConsistency() {
  if (!firebaseInitialized || !USE_FIREBASE) {
    showToast('⚠️ Firebase belum aktif. Tidak bisa cek konsistensi.', 'error');
    return;
  }
  showToast('📊 Mengecek konsistensi data...', 'warning', 5000);

  var sheets = [
    { name: 'main (Sheet1)', sheet: '', path: 'purchase_data/main' },
    { name: 'done', sheet: 'done', path: 'purchase_data/done' },
    { name: 'rejected', sheet: 'rejected', path: 'purchase_data/rejected' }
  ];
  var results = [], done = 0;

  sheets.forEach(function (s) {
    var sheetCount = 0, firebaseCount = 0;
    // Ambil dari spreadsheet
    loadDataFromAPI(function (apiData) {
      sheetCount = (apiData || []).length;
      // Ambil dari firebase
      loadFromFirebase(s.path).then(function (fbData) {
        firebaseCount = (fbData && fbData.length) ? fbData.length : 0;
        var match = sheetCount === firebaseCount;
        results.push({
          name: s.name,
          sheet: sheetCount,
          firebase: firebaseCount,
          match: match
        });
        done++;
        if (done === sheets.length) showConsistencyResult(results);
      }).catch(function () {
        results.push({ name: s.name, sheet: sheetCount, firebase: 0, match: false });
        done++;
        if (done === sheets.length) showConsistencyResult(results);
      });
    }, s.sheet);
  });
}

function showConsistencyResult(results) {
  var html = '<div style="text-align:left;">' +
    '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
    '<tr style="background:#f3f4f6;"><th style="padding:8px;text-align:left;">Sheet</th><th style="padding:8px;text-align:right;">Spreadsheet</th><th style="padding:8px;text-align:right;">Firebase</th><th style="padding:8px;text-align:center;">Status</th></tr>';
  results.forEach(function (r) {
    var status = r.match ? '✅' : '⚠️';
    var statusColor = r.match ? '#16a34a' : '#dc2626';
    html += '<tr style="border-bottom:1px solid #e5e7eb;">' +
      '<td style="padding:8px;">' + r.name + '</td>' +
      '<td style="padding:8px;text-align:right;">' + r.sheet + '</td>' +
      '<td style="padding:8px;text-align:right;">' + r.firebase + '</td>' +
      '<td style="padding:8px;text-align:center;color:' + statusColor + ';">' + status + '</td>' +
      '</tr>';
  });
  html += '</table>';
  var mismatches = results.filter(function (r) { return !r.match; });
  if (mismatches.length > 0) {
    html += '<p style="margin-top:12px;color:#dc2626;font-size:12px;">⚠️ Ada ' + mismatches.length + ' sheet yang tidak sinkron. Jalankan "Sync Spreadsheet → Firebase" untuk menyamakan.</p>';
  } else {
    html += '<p style="margin-top:12px;color:#16a34a;font-size:12px;">✅ Semua data sinkron!</p>';
  }
  html += '</div>';

  confirmDialog({
    title: '📊 Hasil Cek Konsistensi',
    message: html,
    confirmText: '🔄 Sync Sekarang',
    cancelText: 'Tutup',
    onConfirm: function () { syncAllSheets(false); }
  });
}

// FIX v4.2.7: Clear Firebase cache
function clearFirebaseCache() {
  if (!firebaseInitialized || !USE_FIREBASE) {
    showToast('⚠️ Firebase belum aktif.', 'error');
    return;
  }
  confirmDialog({
    title: 'Clear Firebase Cache',
    message: 'Hapus SEMUA data di Firebase cache?<br><br><small>Setelah clear, data akan re-download dari spreadsheet saat load halaman berikutnya.</small>',
    confirmText: 'Ya, Clear',
    type: 'danger',
    onConfirm: function () {
      var paths = ['purchase_data/main', 'purchase_data/done', 'purchase_data/rejected'];
      var done = 0;
      paths.forEach(function (p) {
        removeFromFirebase(p).then(function () { done++; if (done === paths.length) { clearCacheForAction(); showToast('✅ Firebase cache dibersihkan', 'success'); loadDashboardStats(); } }).catch(function () { done++; if (done === paths.length) { showToast('⚠️ Sebagian gagal di-clear', 'warning'); } });
      });
    }
  });
}


// =====================================================
// 5. EXPORTS (semua ke window) - CSP-friendly, no eval()
// =====================================================

// Auth
window.normalizeRole = normalizeRole;
window.checkAuth = checkAuth;
window.checkPermission = checkPermission;
window.setUserSession = setUserSession;
window.clearUserSession = clearUserSession;
window.validateSession = validateSession;
window.logout = logout;
window.protectPage = protectPage;

// Cache & utils
window.dataCache = dataCache;
window.getCachedData = getCachedData;
window.setCachedData = setCachedData;
window.clearCache = clearCache;
window.clearCacheForAction = clearCacheForAction;
window.formatDate = formatDate;
window.formatDateTime = formatDateTime;
window.formatRupiah = formatRupiah;
window.formatNumber = formatNumber;
window._escapeHtml = _escapeHtml;
window.lazyRenderRows = lazyRenderRows;
window.debounceSearch = debounceSearch;
window.showToast = showToast;
window.showLoading = showLoading;
window.confirmDialog = confirmDialog;
window.renderUserStatus = renderUserStatus;
window.handleLogout = handleLogout;

// Firebase
window.initFirebase = initFirebase;
window.saveToFirebase = saveToFirebase;
window.loadFromFirebase = loadFromFirebase;
window.removeFromFirebase = removeFromFirebase;
window.syncFirebaseWithSheet = syncFirebaseWithSheet;
window.loadDataFromAPI = loadDataFromAPI;
window.loadDataSmart = loadDataSmart;
window.loadDataOptimized = loadDataOptimized;
window.loadMultipleSheets = loadMultipleSheets;
window.syncAllSheets = syncAllSheets;
window.startAutoSync = startAutoSync;
window.addSyncButton = addSyncButton;
window.showMigrasiDialog = showMigrasiDialog;
window.checkDataConsistency = checkDataConsistency;
window.clearFirebaseCache = clearFirebaseCache;

// Config (const need explicit assignment)
window.APP_CONFIG = APP_CONFIG;
window.API_URL = API_URL;
window.USE_FIREBASE = USE_FIREBASE;
window.FIREBASE_CONFIG = FIREBASE_CONFIG;
window.PERMISSIONS = PERMISSIONS;
window.ROLE_NAMES = ROLE_NAMES;


/* ============================================================
   PART 2: app.js (Page Logic - auto-detect via body class)
   ============================================================ */

/* ============================================================
   app.js - v3.0 (SIMPLIFIED)
   Gabungan: dashboard + approval + done + rekap + rejected
   Auto-detect page dari <body> class (.theme-xxx)
   ============================================================ */

(function () {
  'use strict';

  // Detect page dari body class ATAU URL filename
  // FIX v4.1.8: Tambah deteksi via URL supaya tetap jalan walau body class berubah
  function detectPage() {
    var body = document.body;

    // 1. Cek body class dulu (cara lama)
    if (body) {
      if (body.classList.contains('theme-dashboard')) return 'dashboard';
      if (body.classList.contains('theme-approval')) return 'approval';
      if (body.classList.contains('theme-done')) return 'done';
      if (body.classList.contains('theme-rekap')) return 'rekap';
      if (body.classList.contains('theme-rejected')) return 'rejected';
    }

    // 2. Fallback: cek URL filename
    var path = window.location.pathname.toLowerCase();
    var file = path.substring(path.lastIndexOf('/') + 1);
    if (file === '' || file === 'index.html') return 'request';
    if (file === 'dashboard.html') return 'dashboard';
    if (file === 'approval.html') return 'approval';
    if (file === 'done.html') return 'done';
    if (file === 'rekap.html') return 'rekap';
    if (file === 'rejected.html') return 'rejected';
    if (file === 'mini-project.html') return 'miniproject';
    if (file === 'print.html') return 'print';

    return null;
  }

  // =====================================================
  // SHARED STATE
  // =====================================================

  // FIX v4.1: Sesuaikan dengan kolom spreadsheet asli:
  // ID, SubmissionDate, Department, Office, Items, PartOf, Description, Qty, Unit, Price,
  // Nominal, LastBuyingDate, OrderDate, Priority, OrderBy, Requester, Status, CreatedAt,
  // ApprovedBy, ApprovedDate, RejectedBy, RejectedDate, RejectedReason, DoneBy, DoneDate
  var HIDDEN_COLUMNS = {
    approval: ['CreatedAt', 'ApprovedBy', 'ApprovedDate', 'DoneBy', 'DoneDate', 'RejectedBy', 'RejectedDate', 'RejectedReason', 'OrderBy', 'BoughtQty', 'RemainingQty'],
    done: ['CreatedAt', 'ApprovedBy', 'ApprovedDate', 'DoneBy', 'DoneDate', 'RejectedBy', 'RejectedDate', 'RejectedReason', 'OrderBy', 'BoughtQty', 'RemainingQty'],
    rekap: ['CreatedAt', 'ApprovedBy', 'ApprovedDate', 'DoneBy', 'DoneDate', 'RejectedBy', 'RejectedDate', 'RejectedReason', 'Requester', 'OrderBy', 'BoughtQty'],
    rejected: ['DoneBy', 'DoneDate', 'Price', 'Nominal', 'LastBuyingDate', 'CreatedAt', 'ApprovedBy', 'ApprovedDate', 'OrderBy', 'BoughtQty', 'RemainingQty']
  };

  // FIX v4.1.5: Urutan kolom EKSPLISIT mengikuti spreadsheet asli.
  // Ini memastikan tampilan tabel selalu sama urutannya dengan spreadsheet,
  // tidak tergantung urutan Object.keys() yang bisa beda antar browser.
  var COLUMN_ORDER = [
    'ID',
    'SubmissionDate',
    'Department',
    'Office',
    'Items',
    'PartOf',
    'Description',
    'Qty',
    'Unit',
    'Price',
    'Nominal',
    'LastBuyingDate',
    'OrderDate',
    'Priority',
    'OrderBy',
    'Requester',
    'Status',
    'CreatedAt',
    'ApprovedBy',
    'ApprovedDate',
    'RejectedBy',
    'RejectedDate',
    'RejectedReason',
    'DoneBy',
    'DoneDate'
  ];

  // Helper: urutkan array headers sesuai COLUMN_ORDER
  function _sortHeadersByColumnOrder(headers) {
    return headers.slice().sort(function (a, b) {
      var ia = COLUMN_ORDER.indexOf(a);
      var ib = COLUMN_ORDER.indexOf(b);
      // Kolom yang tidak ada di COLUMN_ORDER → di akhir, urut abjad
      if (ia === -1 && ib === -1) return a < b ? -1 : (a > b ? 1 : 0);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }

  var NUMBER_COLUMNS = ['Qty'];
  var CURRENCY_COLUMNS = ['Price', 'Nominal'];
  var DATE_COLUMNS = ['LastBuyingDate', 'OrderDate'];
  var DATETIME_COLUMNS = ['CreatedAt', 'SubmissionDate', 'ApprovedDate', 'DoneDate', 'RejectedDate'];

  // Per-page state
  var state = {
    allData: [],
    filteredData: [],
    headers: [],
    currentPage: 1,
    pageSize: 200,
    renderToken: { cancelled: false }
  };

  // =====================================================
  // MENU DEFINITION (dashboard)
  // =====================================================

  var MENU_DEF = [
    { id: 'request',  page: 'index.html',    icon: '📋', title: 'New Request',  desc: 'Create and submit new purchase requests.' },
    { id: 'approval', page: 'approval.html', icon: '📬', title: 'Approval Hub', desc: 'Central portal to review and approve requests.' },
    { id: 'done',     page: 'done.html',     icon: '📦', title: 'Fulfillment',  desc: 'Track and finalize procurement steps.' },
    { id: 'rekap',    page: 'rekap.html',    icon: '📊', title: 'Report Center',desc: 'Comprehensive analytics and history.' },
    { id: 'rejected',    page: 'rejected.html',    icon: '⛔', title: 'Rejection Log', desc: 'Archive of non-fulfillment decisions.' },
    { id: 'miniproject', page: 'mini-project.html', icon: '🔧', title: 'Mini Project', desc: 'Permintaan khusus perbaikan & maintenance.' },
    { id: 'print',       page: 'print.html',       icon: '📥', title: 'Export & Print', desc: 'Download data purchase request to PDF/Excel.' }
  ];

  // =====================================================
  // SHARED HELPERS
  // =====================================================

  function getPagedData() {
    var start = (state.currentPage - 1) * state.pageSize;
    return state.filteredData.slice(start, start + state.pageSize);
  }

  function onSearch(e) {
    var q = e.target.value.toLowerCase();
    state.currentPage = 1;
    if (!q.trim()) {
      state.filteredData = state.allData.slice();
    } else {
      // FIX v4.2.4: Search di SEMUA kolom (bukan hanya visible headers)
      // Sebelumnya hanya cari di state.headers (kolom visible) → kalau cari
      // "pending" tapi Status di-hide, tidak ketemu.
      state.filteredData = state.allData.filter(function (r) {
        return Object.keys(r).map(function (k) { return r[k]; }).join(' ').toLowerCase().indexOf(q) !== -1;
      });
    }
    renderTable();
    renderPagination();
  }

  function renderPagination() {
    var container = document.getElementById('pagination');
    var info = document.getElementById('infoText');
    if (!container || !info) return;
    var total = state.filteredData.length;
    var totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    container.innerHTML = '';
    var start = total === 0 ? 0 : (state.currentPage - 1) * state.pageSize + 1;
    var end = Math.min(start + state.pageSize - 1, total);
    info.textContent = 'Menampilkan ' + start + '–' + end + ' dari ' + total + ' data';

    // Prev
    if (state.currentPage > 1) {
      var prev = document.createElement('button');
      prev.textContent = '←'; prev.className = 'pagination-btn';
      prev.onclick = function () { state.currentPage--; renderTable(); renderPagination(); };
      container.appendChild(prev);
    }
    // Numbers + ellipsis
    for (var i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= state.currentPage - 2 && i <= state.currentPage + 2)) {
        var b = document.createElement('button');
        b.textContent = i; b.className = 'pagination-btn';
        if (i === state.currentPage) b.classList.add('active');
        b.onclick = (function (p) { return function () { state.currentPage = p; renderTable(); renderPagination(); }; })(i);
        container.appendChild(b);
      } else if (i === state.currentPage - 3 || i === state.currentPage + 3) {
        var ell = document.createElement('span');
        ell.textContent = '...'; ell.style.margin = '0 4px'; ell.style.color = '#6b7280';
        container.appendChild(ell);
      }
    }
    // Next
    if (state.currentPage < totalPages) {
      var next = document.createElement('button');
      next.textContent = '→'; next.className = 'pagination-btn';
      next.onclick = function () { state.currentPage++; renderTable(); renderPagination(); };
      container.appendChild(next);
    }
  }

  function formatCell(h, v) {
    var cls = '';
    if (DATETIME_COLUMNS.indexOf(h) !== -1) { v = formatDateTime(v); cls = 'text-center'; }
    else if (DATE_COLUMNS.indexOf(h) !== -1) { v = formatDate(v); cls = 'text-center'; }
    if (NUMBER_COLUMNS.indexOf(h) !== -1) { v = formatNumber(v); cls = 'text-right'; }
    if (CURRENCY_COLUMNS.indexOf(h) !== -1) { v = formatRupiah(v); cls = 'text-right'; }
    return { v: v, cls: cls };
  }

  function renderTable() {
    var thead = document.querySelector('thead');
    var tbody = document.querySelector('tbody');
    if (!thead || !tbody) return;

    var page = detectPage();
    var hiddenCols = HIDDEN_COLUMNS[page] || [];

    // Header — FIX v4.1: mapping nama kolom spreadsheet ke display name
    var DISPLAY_NAMES = {
      'SubmissionDate': 'Submission Date',
      'LastBuyingDate': 'Last Buying',
      'OrderDate': 'Order Date',
      'Items': 'Item Name',
      'PartOf': 'Part Of',
      'Description': 'Description',
      'ApprovedBy': 'Approved By',
      'ApprovedDate': 'Approved Date',
      'DoneBy': 'Done By',
      'DoneDate': 'Done Date',
      'RejectedBy': 'Rejected By',
      'RejectedDate': 'Rejected Date',
      'RejectedReason': 'Reason'
    };
    // FIX v4.1.7: Hanya tambah kolom "Aksi" untuk halaman yang punya tombol aksi
    // - approval = Approve/Reject
    // - done = Mark Done (untuk item approved)
    // - rekap = Mark Done (untuk item partial yang masih ada sisa)
    // - rejected = tidak ada aksi
    var hasActions = (page === 'approval' || page === 'done' || page === 'rekap');
    var headerHtml = state.headers.map(function (h) {
      var displayName = DISPLAY_NAMES[h] || h;
      var html = '<th>' + _escapeHtml(displayName) + '</th>';
      if (hasActions && h === 'ID') html += '<th>Aksi</th>';
      return html;
    }).join('');
    thead.innerHTML = '<tr>' + headerHtml + '</tr>';

    var pageData = getPagedData();
    if (!pageData.length) {
      var msgs = {
        approval: 'Tidak ada request pending untuk di-approve',
        done: 'Tidak ada request approved untuk di-process',
        rekap: 'Belum ada data rekap (request yang sudah Done)',
        rejected: 'Tidak ada request yang ditolak',
        miniproject: 'Belum ada data Mini Project (perbaikan)'
      };
      tbody.innerHTML = '<tr><td colspan="' + (state.headers.length + (hasActions ? 1 : 0)) + '" class="text-center" style="padding:40px 20px;"><div style="font-size:48px;opacity:0.3;margin-bottom:8px;">📭</div><div style="color:#6b7280;font-weight:600;">' + (msgs[page] || 'Data tidak ditemukan') + '</div></td></tr>';
      return;
    }

    var rowsHtml = pageData.map(function (r) {
      var cellsHtml = state.headers.map(function (h) {
        var f = formatCell(h, r[h] != null ? r[h] : '');
        var safeV = typeof f.v === 'string' ? _escapeHtml(f.v) : f.v;
        // FIX v4.2.9: Tambah title attribute untuk tooltip (text panjang)
        var rawVal = r[h] != null ? String(r[h]) : '';
        var titleAttr = (rawVal.length > 25) ? ' title="' + _escapeHtml(rawVal) + '"' : '';
        var cell = '<td class="' + f.cls + '"' + titleAttr + '>' + safeV + '</td>';

        if (h === 'Status') {
          var status = String(f.v).toLowerCase();
          cell = '<td class="text-center"><span class="status ' + status + '">' + safeV + '</span></td>';
        }

        if (h === 'ID') {
          var safeId = _escapeHtml(r.ID);
          if (page === 'approval') {
            cell += '<td class="text-center" style="white-space:nowrap;">' +
              '<button class="btn-primary" onclick="approve(\'' + safeId + '\')" title="Approve">✅</button>' +
              '<button class="btn-secondary" onclick="reject(\'' + safeId + '\')" title="Reject" style="margin-left:4px;">❌</button>' +
              '</td>';
          } else if (page === 'done') {
            cell += '<td class="text-center"><button class="btn-primary" onclick="markDone(\'' + safeId + '\')" title="Mark Done">📦</button></td>';
          } else if (page === 'rekap') {
            // FIX v4.2.0: Di rekap, tampilkan tombol Mark Done hanya untuk item partial
            // (yang masih ada sisa qty). Item done biasa tidak perlu tombol.
            var status = String(r.Status || '').toLowerCase();
            var remaining = Number(r.RemainingQty) || 0;
            if (status === 'partial' && remaining > 0) {
              cell += '<td class="text-center"><button class="btn-primary" onclick="markDone(\'' + safeId + '\')" title="Selesaikan sisa (' + remaining + ' unit)">📦</button></td>';
            } else {
              cell += '<td class="text-center"><span style="color:#9ca3af;font-size:11px;">—</span></td>';
            }
          }
        }
        return cell;
      }).join('');
      return '<tr data-id="' + _escapeHtml(r.ID || '') + '">' + cellsHtml + '</tr>';
    });

    state.renderToken.cancelled = true;
    state.renderToken = { cancelled: false };
    lazyRenderRows(rowsHtml, tbody, 50, state.renderToken);
  }

  // =====================================================
  // DATA LOADERS
  // =====================================================

  // FIX v4.2.6: Sort data by tanggal terbaru (SubmissionDate / CreatedAt / DoneDate)
  // supaya data paling baru selalu di atas tabel
  function _sortByDateDesc(arr) {
    return arr.slice().sort(function (a, b) {
      var da = new Date(a.SubmissionDate || a.CreatedAt || a.DoneDate || a.RejectedDate || 0).getTime();
      var db = new Date(b.SubmissionDate || b.CreatedAt || b.DoneDate || b.RejectedDate || 0).getTime();
      return db - da; // descending (terbaru di atas)
    });
  }

  function loadApprovalData(forceRefresh) {
    if (forceRefresh) clearCache('main');
    loadDataOptimizedForce(function (data) {
      // FIX v4.3.3: Exclude mini project (Type=project) dari approval biasa
      state.allData = _sortByDateDesc((data || []).filter(function (d) {
        if (d.Status !== 'pending') return false;
        var t = (d.Type || 'request').toString().toLowerCase();
        return t !== 'project' && t !== 'mini-project' && t !== 'miniproject';
      }));
      state.filteredData = state.allData.slice();
      state.headers = state.allData.length > 0
        ? _sortHeadersByColumnOrder(Object.keys(state.allData[0]).filter(function (h) { return HIDDEN_COLUMNS.approval.indexOf(h) === -1; }))
        : [];
      state.currentPage = 1;
      renderTable(); renderPagination();
    });
  }

  function loadDoneData(forceRefresh) {
    if (forceRefresh) clearCache('main');
    loadDataOptimizedForce(function (data) {
      // FIX v4.3.3: Exclude mini project dari done biasa
      state.allData = _sortByDateDesc((data || []).filter(function (d) {
        if (d.Status !== 'approved') return false;
        var t = (d.Type || 'request').toString().toLowerCase();
        return t !== 'project' && t !== 'mini-project' && t !== 'miniproject';
      }));
      state.filteredData = state.allData.slice();
      state.headers = state.allData.length > 0
        ? _sortHeadersByColumnOrder(Object.keys(state.allData[0]).filter(function (h) { return HIDDEN_COLUMNS.done.indexOf(h) === -1; }))
        : [];
      state.currentPage = 1;
      renderTable(); renderPagination();
    });
  }

  function loadRekapData(forceRefresh) {
    if (forceRefresh) clearCache('done');
    loadDataOptimizedForce(function (data) {
      state.allData = _sortByDateDesc(data || []);
      state.filteredData = state.allData.slice();
      state.headers = state.allData.length > 0
        ? _sortHeadersByColumnOrder(Object.keys(state.allData[0]).filter(function (h) { return HIDDEN_COLUMNS.rekap.indexOf(h) === -1; }))
        : [];
      state.currentPage = 1;
      renderTable(); renderPagination();
    }, 'done');
  }

  function loadRejectedData(forceRefresh) {
    if (forceRefresh) clearCache('rejected');
    loadDataOptimizedForce(function (data) {
      state.allData = _sortByDateDesc(data || []);
      state.filteredData = state.allData.slice();
      state.headers = state.allData.length > 0
        ? _sortHeadersByColumnOrder(Object.keys(state.allData[0]).filter(function (h) { return HIDDEN_COLUMNS.rejected.indexOf(h) === -1; }))
        : [];
      state.currentPage = 1;
      renderTable(); renderPagination();
    }, 'rejected');
  }

  // FIX v4.3.3: Loader Mini Project — filter dari Sheet1 dengan Type=project
  // Data tetap di Sheet1 (1 sheet), cuma di-filter berdasarkan kolom Type
  function loadMiniProjectData(forceRefresh) {
    if (forceRefresh) clearCache('main');
    loadDataOptimizedForce(function (data) {
      // Filter: hanya yang Type=project (mini project / perbaikan)
      state.allData = _sortByDateDesc((data || []).filter(function (d) {
        var t = (d.Type || 'request').toString().toLowerCase();
        return t === 'project' || t === 'mini-project' || t === 'miniproject';
      }));
      state.filteredData = state.allData.slice();
      state.headers = state.allData.length > 0
        ? _sortHeadersByColumnOrder(Object.keys(state.allData[0]).filter(function (h) { return HIDDEN_COLUMNS.approval.indexOf(h) === -1; }))
        : [];
      state.currentPage = 1;
      renderTable(); renderPagination();
    });
  }

  // =====================================================
  // ACTIONS (Approval + Done)
  // =====================================================

  // FIX v4.1.4: Helper — buat deskripsi item untuk dialog
  // Tampilkan ID + Nama Barang + Qty + Department
  function _itemDesc(data) {
    if (!data) return '';
    var item = _escapeHtml(data.Items || data.ItemName || '-');
    var qty = _escapeHtml(data.Qty || '');
    var unit = _escapeHtml(data.Unit || '');
    var dept = _escapeHtml(data.Department || '');
    var office = _escapeHtml(data.Office || '');
    var html = '<div style="margin-top:8px;padding:10px 12px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">';
    html += '<div style="font-weight:700;font-size:15px;color:#111827;">' + item + '</div>';
    html += '<div style="font-size:12px;color:#6b7280;margin-top:4px;">';
    html += 'ID: <b>' + _escapeHtml(data.ID || '') + '</b>';
    if (qty) html += ' · Qty: <b>' + qty + '</b>' + (unit ? ' ' + unit : '');
    if (dept) html += ' · ' + dept;
    if (office) html += ' (' + office + ')';
    html += '</div>';
    html += '</div>';
    return html;
  }

  // Approval: Approve
  window.approve = function (id) {
    var name = sessionStorage.getItem('username') || 'User';
    var data = state.allData.find(function (d) { return d.ID === id; });
    confirmDialog({
      title: 'Konfirmasi Approve',
      message: 'Setujui permintaan pembelian ini?' + _itemDesc(data),
      confirmText: '✅ Approve',
      onConfirm: function () {
        var fd = new FormData();
        fd.append('action', 'approve');
        fd.append('ID', id); fd.append('Status', 'approved'); fd.append('ApprovedBy', name);
        submitAction(fd, 'Request berhasil di-approve');
      }
    });
  };

  // Approval: Reject (modal dengan alasan)
  window.reject = function (id) {
    var name = sessionStorage.getItem('username') || 'User';
    var data = state.allData.find(function (d) { return d.ID === id; });
    confirmDialog({
      title: 'Konfirmasi Reject',
      message: 'Tolak permintaan pembelian ini?' + _itemDesc(data),
      confirmText: '❌ Reject',
      type: 'danger',
      input: {
        label: 'Alasan Reject',
        placeholder: 'Tulis alasan penolakan...',
        validate: function (val) {
          if (!val || !val.trim()) return 'Alasan reject wajib diisi';
          if (val.length < 3) return 'Alasan terlalu pendek (min 3 karakter)';
          return null;
        }
      },
      onConfirm: function (reason) {
        var fd = new FormData();
        fd.append('action', 'reject');
        fd.append('ID', id); fd.append('Status', 'rejected');
        fd.append('RejectedBy', name); fd.append('RejectedReason', reason);
        submitAction(fd, 'Request berhasil di-reject');
      }
    });
  };

  // Done: Mark Done (modal pilih Completed/Partial)
  window.markDone = function (id) {
    var data = state.allData.find(function (d) { return d.ID === id; });
    if (!data) { showToast('Data tidak ditemukan', 'error'); return; }

    // FIX v4.2.0: Kalau dari rekap & item partial → langsung completeRemaining
    // (item sudah di sheet Done, tidak perlu pilih Completed/Partial lagi)
    var page = detectPage();
    if (page === 'rekap' && String(data.Status || '').toLowerCase() === 'partial') {
      completeRemaining(id);
      return;
    }

    confirmDialog({
      title: 'Tandai Selesai',
      message: 'Pilih aksi untuk permintaan ini:' + _itemDesc(data),
      confirmText: '✅ Completed',
      cancelText: '📦 Partial',
      onConfirm: function () { completeAll(id); },
      onCancel: function () { partialComplete(id); }
    });
  };

  // Rekap: Complete Remaining (untuk item partial di sheet Done)
  // FIX v4.2.0: Selesaikan sisa qty item partial yang ada di sheet Done
  window.completeRemaining = function (id) {
    var user = sessionStorage.getItem('username') || 'User';
    var data = state.allData.find(function (d) { return d.ID === id; });
    if (!data) { showToast('Data tidak ditemukan', 'error'); return; }
    var remaining = Number(data.RemainingQty) || (Number(data.Qty) || 0);
    confirmDialog({
      title: 'Selesaikan Sisa',
      message: 'Tandai <strong>Completed</strong> untuk sisa <b>' + remaining + '</b> unit?' + _itemDesc(data),
      confirmText: 'Ya, Selesaikan',
      onConfirm: function () {
        var fd = new FormData();
        fd.append('action', 'completeRemaining');
        fd.append('ID', id); fd.append('Status', 'done'); fd.append('DoneBy', user);
        submitAction(fd, 'Sisa request berhasil diselesaikan');
      }
    });
  };

  // Done: Complete All
  window.completeAll = function (id) {
    var user = sessionStorage.getItem('username') || 'User';
    var data = state.allData.find(function (d) { return d.ID === id; });
    confirmDialog({
      title: 'Konfirmasi Completed',
      message: 'Tandai <strong>Completed</strong> (semua qty sudah dibeli)?' + _itemDesc(data),
      confirmText: 'Ya, Completed',
      onConfirm: function () {
        var fd = new FormData();
        fd.append('action', 'done');
        fd.append('ID', id); fd.append('Status', 'done'); fd.append('DoneBy', user);
        submitAction(fd, 'Request selesai (Completed)');
      }
    });
  };

  // Done: Partial Complete (modal input qty + validasi)
  window.partialComplete = function (id) {
    var data = state.allData.find(function (d) { return d.ID === id; });
    if (!data) return;
    confirmDialog({
      title: 'Partial Complete',
      message: 'Masukkan qty yang sudah dibeli:' + _itemDesc(data),
      confirmText: 'Submit Partial',
      input: {
        label: 'Qty Dibeli',
        placeholder: 'Masukkan qty (1 - ' + (data.Qty - 1) + ')',
        type: 'number',
        validate: function (val) {
          var n = Number(val);
          if (!val || isNaN(n)) return 'Harus angka';
          if (n <= 0) return 'Qty harus > 0';
          if (n >= data.Qty) return 'Qty harus < ' + data.Qty + ' (gunakan Completed jika semua dibeli)';
          return null;
        }
      },
      onConfirm: function (boughtQtyStr) {
        var boughtQty = Number(boughtQtyStr);
        var user = sessionStorage.getItem('username') || 'User';
        var fd = new FormData();
        fd.append('action', 'partialDone');
        fd.append('ID', id); fd.append('Status', 'partial');
        fd.append('BoughtQty', boughtQty); fd.append('RemainingQty', data.Qty - boughtQty);
        fd.append('DoneBy', user);
        submitAction(fd, 'Partial request berhasil');
      }
    });
  };

  // Generic submit + optimistic update
  // FIX v4.1.2: GAS return plain text 'Data berhasil disimpan' atau 'Error: ...'
  // Jadi kita cek response TEXT, bukan res.ok (yang selalu true karena HTTP 200)
  async function submitAction(fd, successMsg) {
    try {
      showToast('Memproses...', 'warning');
      var res = await fetch(API_URL, { method: 'POST', body: fd, redirect: 'follow' });
      var responseText = await res.text();
      debugLog('POST response:', responseText);

      // FIX: GAS return 'Error: ...' dengan HTTP 200 — cek text-nya
      if (responseText && responseText.indexOf('Error') === 0) {
        throw new Error(responseText);
      }
      if (!res.ok && !responseText) {
        throw new Error('Gagal update (HTTP ' + res.status + ')');
      }

      showToast(successMsg, 'success');

      // Clear all related caches
      clearCacheForAction();

      // Optimistic update
      var id = fd.get('ID');
      state.allData = state.allData.filter(function (r) { return r.ID !== id; });
      state.filteredData = state.filteredData.filter(function (r) { return r.ID !== id; });
      renderTable(); renderPagination();

      // FIX v4.2.1: Force refresh dari API (skip Firebase cache yang bisa stale)
      setTimeout(function () { reloadPageData(true); }, 500);
    } catch (err) {
      debugError('Action error:', err);
      showToast('Gagal: ' + err.message, 'error');
      // Reload data to revert optimistic update
      setTimeout(function () { reloadPageData(true); }, 500);
    }
  }

  function reloadPageData(forceRefresh) {
    var page = detectPage();
    if (page === 'approval') loadApprovalData(forceRefresh);
    else if (page === 'done') loadDoneData(forceRefresh);
    else if (page === 'rekap') loadRekapData(forceRefresh);
    else if (page === 'rejected') loadRejectedData(forceRefresh);
    else if (page === 'miniproject') loadMiniProjectData(forceRefresh);
  }

  // FIX v4.2.4: Expose refresh functions untuk tombol Refresh di HTML
  // Sebelumnya done.html panggil refreshDoneData() tapi function tidak ada
  window.reloadPageData = reloadPageData;
  window.refreshDoneData = function () {
    showToast('🔄 Refresh data...', 'warning', 2000);
    reloadPageData(true);
  };
  window.refreshApprovalData = function () {
    showToast('🔄 Refresh data...', 'warning', 2000);
    reloadPageData(true);
  };
  window.refreshRekapData = function () {
    showToast('🔄 Refresh data...', 'warning', 2000);
    reloadPageData(true);
  };
  window.refreshRejectedData = function () {
    showToast('🔄 Refresh data...', 'warning', 2000);
    reloadPageData(true);
  };
  window.refreshMiniProjectData = function () {
    showToast('🔄 Refresh data...', 'warning', 2000);
    reloadPageData(true);
  };
  window.refreshDashboard = function () {
    showToast('🔄 Refresh dashboard...', 'warning', 2000);
    loadDashboardStats();
  };

  // =====================================================
  // DASHBOARD (greeting + menu + stats)
  // =====================================================

  function setGreeting() {
    var el = document.getElementById('greetingText');
    if (!el) return;
    var h = new Date().getHours();
    var g = 'Halo';
    if (h < 11) g = 'Selamat Pagi';
    else if (h < 15) g = 'Selamat Siang';
    else if (h < 19) g = 'Selamat Sore';
    else g = 'Selamat Malam';
    var name = sessionStorage.getItem('fullName') || sessionStorage.getItem('username') || 'Rekan';
    el.textContent = g + ', ' + name;
  }

  function renderUserFloater() {
    var c = document.getElementById('userFloater');
    if (!c) return;
    var u = sessionStorage.getItem('username') || 'User';
    var r = sessionStorage.getItem('userRole') || 'viewer';
    var role = normalizeRole(r);
    var rn = (ROLE_NAMES[role] || r || 'Member');
    c.innerHTML = '<div class="user-avatar">' + (u.charAt(0) || 'U').toUpperCase() + '</div><div class="user-meta"><div class="user-id">' + _escapeHtml(u) + '</div><div class="user-tag">' + _escapeHtml(rn) + '</div></div><button class="nav-logout" onclick="logout()" title="Logout">✕</button>';
  }

  function renderMenu() {
    var container = document.getElementById('menuContainer');
    if (!container) return;
    var rawRole = sessionStorage.getItem('userRole') || 'viewer';
    var role = normalizeRole(rawRole);
    debugLog('🎭 Menu render - rawRole:', rawRole, '| normalized:', role);

    var allowedPages = PERMISSIONS[role] || PERMISSIONS[rawRole.toLowerCase().replace(/\s+/g, '_')] || [];
    debugLog('📋 Allowed pages for', role, ':', allowedPages);

    if (allowedPages.length === 0) {
      // Fallback berdasarkan role (pakai ID logis, BUKAN nama file)
      debugWarn('⚠️ No permissions found for role:', role, '- using fallback');
      if (role === 'admin') allowedPages = MENU_DEF.map(function (m) { return m.id; });
      else if (role === 'staff_a') allowedPages = ['request', 'rekap', 'rejected', 'print'];
      else if (role === 'staff_b') allowedPages = ['request', 'approval', 'done', 'rekap', 'print'];
      else if (role === 'staff_c') allowedPages = ['request', 'approval', 'done', 'rekap', 'rejected', 'print'];
      else allowedPages = ['rekap', 'print'];
    }

    // FIX v4.1: filter pakai m.id (logis: 'request','approval',...)
    // BUKAN m.page (nama file: 'index.html','approval.html',...)
    // agar cocok dengan PERMISSIONS yang juga pakai ID logis.
    var html = MENU_DEF
      .filter(function (m) { return allowedPages.indexOf(m.id) !== -1; })
      .map(function (m) {
        return '<a href="' + m.page + '" class="menu-item" data-page="' + m.page + '">' +
          '<div class="menu-item-icon">' + m.icon + '</div>' +
          '<div class="menu-item-info"><h3>' + _escapeHtml(m.title) + '</h3><p>' + _escapeHtml(m.desc) + '</p></div>' +
          '<div class="menu-item-arrow">→</div></a>';
      }).join('');
    container.innerHTML = html || '<p class="text-muted">Tidak ada menu tersedia untuk role: ' + _escapeHtml(rawRole) + '</p>';
  }

  var statsData = { pending: 0, approved: 0, done: 0, rejected: 0 };
  var seenIds = {};

  function loadDashboardStats() {
    statsData = { pending: 0, approved: 0, done: 0, rejected: 0 };
    seenIds = {};
    debugLog('📊 Loading dashboard stats...');
    loadMultipleSheets(['', 'done', 'rejected'], function (results) {
      debugLog('📊 Stats data received:', {
        main: (results[''] || []).length,
        done: (results['done'] || []).length,
        rejected: (results['rejected'] || []).length
      });
      (results[''] || []).forEach(function (item) {
        if (item && item.ID && !seenIds[item.ID]) {
          var s = (item.Status || '').toString().toLowerCase().trim();
          if (statsData.hasOwnProperty(s)) { statsData[s]++; seenIds[item.ID] = true; }
        }
      });
      (results['done'] || []).forEach(function (item) { if (item && item.ID) statsData.done++; });
      (results['rejected'] || []).forEach(function (item) { if (item && item.ID) statsData.rejected++; });
      debugLog('📊 Final stats:', statsData);
      _setText('statPending', statsData.pending);
      _setText('statApproved', statsData.approved);
      _setText('statDone', statsData.done);
      _setText('statRejected', statsData.rejected);
    });
  }

  function _setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // =====================================================
  // INIT (auto-detect page)
  // =====================================================

  document.addEventListener('DOMContentLoaded', function () {
    var page = detectPage();
    if (!page) { debugLog('Unknown page, app.js skipping init'); return; }

    // Protect page (redirect ke login kalau belum auth)
    if (!protectPage()) return;

    debugLog('🚀 Page init:', page);

    // Init Firebase + auto-sync (untuk semua page)
    if (USE_FIREBASE && typeof initFirebase === 'function') {
      var ok = initFirebase();
      if (ok) {
        debugLog('✅ Firebase ready');
        // Tambah sync button kalau ada .head-actions
        setTimeout(function () { if (typeof addSyncButton === 'function') addSyncButton(); }, 1500);
        // Auto-sync
        var interval = APP_CONFIG.sync.autoSyncInterval;
        if (interval > 0) startAutoSync(Math.round(interval / 60000));
      }
    }

    if (page === 'dashboard') {
      setGreeting();
      renderMenu();
      renderUserFloater();
      loadDashboardStats();
    } else {
      // Tabel pages: approval, done, rekap, rejected
      var searchInput = document.getElementById('search');
      var pageSizeSelect = document.getElementById('pageSize');
      if (searchInput && typeof debounceSearch === 'function') {
        searchInput.addEventListener('input', debounceSearch(onSearch, 300));
      }
      if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', function (e) {
          state.pageSize = Number(e.target.value);
          state.currentPage = 1;
          renderTable(); renderPagination();
        });
      }
      // Initial load
      reloadPageData();
    }
    // FIX v4.3.2: Init untuk halaman mini-project
    if (page === 'miniproject') {
      var searchInput = document.getElementById('search');
      var pageSizeSelect = document.getElementById('pageSize');
      if (searchInput && typeof debounceSearch === 'function') {
        searchInput.addEventListener('input', debounceSearch(onSearch, 300));
      }
      if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', function (e) {
          state.pageSize = Number(e.target.value);
          state.currentPage = 1;
          renderTable(); renderPagination();
        });
      }
      reloadPageData();
    }

    // Listen sync complete → soft refresh
    window.addEventListener('pr:syncComplete', function () {
      debugLog('🔄 Sync complete, refreshing page data');
      if (page === 'dashboard') loadDashboardStats();
      else reloadPageData();
    });
  });

})();   /* ← End of PART 2 inner IIFE */

})();   /* ← End of outer IIFE wrapper (v4.1 fix) */

/* ============================================================
   AUTO CACHE-BUSTING (v4.1.9)
   Cek apakah app.js yang di-load adalah versi terbaru.
   Jika tidak, force reload dengan cache-busting query string.
   Ini mengatasi masalah browser cache yang masih pakai versi lama.
   ============================================================ */
(function () {
  var EXPECTED_VERSION = 'v4.3.7';
  if (window.APP_VERSION !== EXPECTED_VERSION) {
    console.warn('⚠️ app.js outdated! Loaded:', window.APP_VERSION, 'Expected:', EXPECTED_VERSION);
    // Force reload dengan cache-busting
    var url = window.location.href;
    var sep = url.indexOf('?') === -1 ? '?' : '&';
    if (url.indexOf('_cb=') === -1) {
      window.location.href = url + sep + '_cb=' + Date.now();
    }
    return;
  }
  console.log('✅ app.js', window.APP_VERSION, 'loaded');
})();

/* Semua deklarasi kini function-scoped, aman dari collision
   dengan file JS lama (auth.js/core.js) yang tersisa di server. */
