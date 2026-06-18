/* ============================
   GLOBAL UI HELPERS - REFACTORED v2.0
   - lazyRenderRows: anti-race-condition via token
   - Toast queue: gak saling timpa
   - Cache helper: explicit clearCache() function
   - Loading overlay hanya untuk initial load
============================ */

// =========================================
// 1. CACHE SYSTEM
// =========================================

var dataCache = {};
var CACHE_TIMEOUT = 5 * 60 * 1000;

function getCachedData(key) {
  var cached = dataCache[key];
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TIMEOUT) {
    delete dataCache[key];
    return null;
  }
  return cached.data;
}

function setCachedData(key, data) {
  dataCache[key] = { data: data, timestamp: Date.now() };
}

// ✅ NEW: explicit cache clearer (replaces ad-hoc `delete window.dataCache['main']`)
function clearCache(key) {
  if (key === undefined || key === null) {
    // Clear all
    Object.keys(dataCache).forEach(function (k) { delete dataCache[k]; });
    if (typeof debugLog === 'function') debugLog('🧹 All cache cleared');
  } else {
    delete dataCache[key];
    if (typeof debugLog === 'function') debugLog('🧹 Cache cleared:', key);
  }
}

// ✅ NEW: clear cache for related sheets after action
function clearCacheForAction(actionType) {
  // Semua page pada dasarnya baca sheet '', 'done', 'rejected'
  // Setelah approve/reject/done/create/update, semua cache harus di-clear
  // untuk consistency
  clearCache('main');
  clearCache('done');
  clearCache('rejected');
}

// =========================================
// 2. GLOBAL LOADING - Hanya untuk initial load
// =========================================

document.addEventListener('DOMContentLoaded', function () {
  if (!document.getElementById('globalLoading')) {
    var loader = document.createElement('div');
    loader.id = 'globalLoading';
    loader.style.cssText = 'position:fixed;inset:0;background:rgba(255,255,255,0.8);display:none;justify-content:center;align-items:center;z-index:9999;';
    loader.innerHTML =
      '<div style="background:white;padding:20px;border-radius:12px;box-shadow:0 4px 15px rgba(0,0,0,0.15);display:flex;gap:15px;align-items:center;">' +
      '<div style="width:24px;height:24px;border:3px solid #e5e7eb;border-top:3px solid #2563eb;border-radius:50%;animation:spin 1s linear infinite"></div>' +
      '<span style="font-family:sans-serif;color:#374151;">Memuat data...</span>' +
      '</div>' +
      '<style>@keyframes spin { to { transform: rotate(360deg); } }</style>';
    document.body.appendChild(loader);
  }
});

var _loadingCount = 0;
function showLoading(show) {
  if (show === undefined) show = true;
  var loader = document.getElementById('globalLoading');
  if (!loader) return;

  if (show) {
    _loadingCount++;
    loader.style.display = 'flex';
  } else {
    _loadingCount = Math.max(0, _loadingCount - 1);
    if (_loadingCount === 0) loader.style.display = 'none';
  }
}

// =========================================
// 3. LOAD DATA - Delegate ke firebase-helper
// =========================================

function loadDataOptimized(callback, sheetName) {
  if (sheetName === undefined) sheetName = '';

  // Gunakan loadDataSmart dari firebase-helper.js (handles Firebase + cache + fallback)
  if (typeof loadDataSmart === 'function' && USE_FIREBASE) {
    loadDataSmart(callback, sheetName, false);
    return;
  }

  // Fallback ke legacy JSONP
  loadDataLegacy(callback, sheetName);
}

function loadDataLegacy(callback, sheetName) {
  if (sheetName === undefined) sheetName = '';
  var cacheKey = sheetName || 'main';

  var cached = getCachedData(cacheKey);
  if (cached) {
    if (callback) setTimeout(function () { callback(cached); }, 0);
    return;
  }

  showLoading(true);

  var timestamp = Date.now();
  var random = Math.random().toString(36).substr(2, 9);
  var cbName = 'cb_legacy_' + timestamp + '_' + random;

  var isResolved = false;
  var timeoutId = null;

  window[cbName] = function (data) {
    if (isResolved) return;
    isResolved = true;
    if (timeoutId) clearTimeout(timeoutId);

    try {
      if (!data || typeof data === 'string') {
        if (callback) callback([]);
        return;
      }
      setCachedData(cacheKey, data);
      if (callback) callback(data);
    } catch (err) {
      if (typeof debugError === 'function') debugError('loadDataLegacy error:', err);
      if (callback) callback([]);
    } finally {
      cleanupLegacy(cbName);
      showLoading(false);
    }
  };

  timeoutId = setTimeout(function () {
    if (!isResolved) {
      isResolved = true;
      cleanupLegacy(cbName);
      showLoading(false);
      if (callback) callback([]);
      if (typeof debugWarn === 'function') debugWarn('loadDataLegacy timeout:', sheetName);
    }
  }, 15000);

  try {
    var url = new URL(API_URL);
    url.searchParams.set('action', 'read');
    if (sheetName) url.searchParams.set('sheet', sheetName);
    url.searchParams.set('callback', cbName);
    url.searchParams.set('_t', timestamp);

    var script = document.createElement('script');
    script.id = 'script-' + cbName;
    script.src = url.toString();
    script.async = true;
    script.onerror = function () {
      if (!isResolved) {
        isResolved = true;
        cleanupLegacy(cbName);
        showLoading(false);
        if (callback) callback([]);
        if (typeof debugError === 'function') debugError('loadDataLegacy network error:', sheetName);
      }
    };
    document.body.appendChild(script);
  } catch (err) {
    if (typeof debugError === 'function') debugError('API_URL Error:', err);
    cleanupLegacy(cbName);
    showLoading(false);
    if (callback) callback([]);
  }
}

function cleanupLegacy(cbName) {
  delete window[cbName];
  var scriptEl = document.getElementById('script-' + cbName);
  if (scriptEl && scriptEl.parentNode) {
    scriptEl.parentNode.removeChild(scriptEl);
  }
}

function loadMultipleSheets(sheets, onAllLoaded) {
  var results = {};
  var loadedCount = 0;
  var totalSheets = sheets.length;

  if (totalSheets === 0) {
    if (onAllLoaded) onAllLoaded(results);
    return;
  }

  sheets.forEach(function (sheet) {
    loadDataOptimized(function (data) {
      results[sheet] = data || [];
      loadedCount++;
      if (loadedCount === totalSheets && onAllLoaded) {
        try { onAllLoaded(results); } catch (err) {
          if (typeof debugError === 'function') debugError('Error in loadMultipleSheets callback:', err);
        }
      }
    }, sheet);
  });
}

// =========================================
// 4. FORMATTERS
// =========================================

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
    var num = parseFloat(v);
    var hasDecimal = num % 1 !== 0;
    return 'Rp ' + num.toLocaleString('id-ID', {
      minimumFractionDigits: hasDecimal ? 2 : 0,
      maximumFractionDigits: 2
    });
  } catch (e) { return v; }
}

function formatNumber(v) {
  if (v === '' || v == null || isNaN(v)) return '';
  try {
    return parseFloat(v).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  } catch (e) { return v; }
}

// =========================================
// 5. UI UTILS - Anti-race-condition lazyRender
// =========================================

/**
 * ✅ FIXED: lazyRenderRows dengan token cancellation
 * Mencegah race condition saat user search cepat
 */
function lazyRenderRows(rowsHtmlArray, tbody, batchSize, token) {
  if (batchSize === undefined) batchSize = 50;
  if (!Array.isArray(rowsHtmlArray) || !tbody) return;

  // ✅ Cek token: kalau ada render lebih baru, abort
  if (token && token.cancelled) {
    if (typeof debugLog === 'function') debugLog('lazyRender cancelled by newer render');
    return;
  }

  // ✅ Hash check: kalau isi sama, skip rebuild (anti kedap-kedip)
  var newSignature = rowsHtmlArray.length + '|' + (rowsHtmlArray[0] || '').substring(0, 50);
  if (tbody.dataset.signature === newSignature && tbody.children.length === rowsHtmlArray.length) {
    return; // Skip, data unchanged
  }
  tbody.dataset.signature = newSignature;

  tbody.innerHTML = '';
  if (rowsHtmlArray.length === 0) return;

  var index = 0;
  function renderBatch() {
    if (token && token.cancelled) return;
    if (index >= rowsHtmlArray.length) return;
    var end = Math.min(index + batchSize, rowsHtmlArray.length);
    tbody.insertAdjacentHTML('beforeend', rowsHtmlArray.slice(index, end).join(''));
    index = end;
    if (index < rowsHtmlArray.length) {
      requestAnimationFrame(renderBatch);
    }
  }
  renderBatch();
}

function debounceSearch(func, wait) {
  var timeout = null;
  return function executedFunction() {
    var args = arguments;
    var context = this;
    clearTimeout(timeout);
    timeout = setTimeout(function () {
      timeout = null;
      func.apply(context, args);
    }, wait);
  };
}

// =========================================
// 6. TOAST - Queue system, gak saling timpa
// =========================================

var _toastQueue = [];
var _toastActive = false;

function showToast(msg, type, duration) {
  if (type === undefined) type = 'success';
  if (duration === undefined) duration = 3000;

  _toastQueue.push({ msg: msg, type: type, duration: duration });
  if (!_toastActive) _processToastQueue();
}

function _processToastQueue() {
  if (_toastQueue.length === 0) {
    _toastActive = false;
    return;
  }
  _toastActive = true;

  var item = _toastQueue.shift();
  var toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }

  toast.textContent = item.msg;
  toast.className = 'toast show';
  toast.style.background = item.type === 'error' ? '#dc2626' : item.type === 'warning' ? '#f59e0b' : '#16a34a';
  toast.style.color = '#fff';
  toast.style.padding = '12px 20px';
  toast.style.borderRadius = '8px';
  toast.style.fontWeight = '600';
  toast.style.boxShadow = '0 10px 15px rgba(0,0,0,0.2)';
  toast.style.position = 'fixed';
  toast.style.top = '20px';
  toast.style.right = '20px';
  toast.style.zIndex = '9999';
  toast.style.transition = 'all 0.3s ease';
  toast.style.maxWidth = '90vw';
  toast.style.wordWrap = 'break-word';

  setTimeout(function () {
    toast.classList.remove('show');
    setTimeout(_processToastQueue, 250); // tunggu animasi selesai
  }, item.duration);
}

// =========================================
// 7. USER STATUS
// =========================================

function renderUserStatus() {
  var container = document.getElementById('userFloater');
  if (!container) return;

  var user = sessionStorage.getItem('username') || 'User';
  var rawRole = sessionStorage.getItem('userRole') || 'viewer';
  var role = normalizeRole(rawRole);
  var roleName = rawRole;
  if (typeof ROLE_NAMES !== 'undefined' && ROLE_NAMES[role]) {
    roleName = ROLE_NAMES[role];
  }
  var initial = (user || 'U').charAt(0).toUpperCase();

  container.innerHTML =
    '<div class="user-avatar">' + initial + '</div>' +
    '<div class="user-meta">' +
    '<div class="user-id">' + _escapeHtml(user) + '</div>' +
    '<div class="user-tag">' + _escapeHtml(roleName) + '</div>' +
    '</div>' +
    '<button class="nav-logout" onclick="handleLogout()" title="Logout">✕</button>';
}

function _escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function handleLogout() {
  if (confirm('Keluar dari aplikasi?')) {
    clearUserSession();
    window.location.href = 'login.html';
  }
}

// =========================================
// 8. CONFIRMATION DIALOG (replaces prompt/confirm for actions)
// =========================================

/**
 * Generic confirmation modal.
 * Usage: confirmDialog({ title, message, confirmText, cancelText, onConfirm, onCancel, type })
 * type: 'danger' | 'warning' | 'info'
 */
function confirmDialog(opts) {
  opts = opts || {};
  var title = opts.title || 'Konfirmasi';
  var message = opts.message || 'Apakah Anda yakin?';
  var confirmText = opts.confirmText || 'Ya';
  var cancelText = opts.cancelText || 'Batal';
  var type = opts.type || 'info';
  var onConfirm = opts.onConfirm || function () {};
  var onCancel = opts.onCancel || function () {};
  var inputConfig = opts.input; // { label, placeholder, type, validate }

  // Remove existing
  var existing = document.getElementById('confirmModal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'confirmModal';
  modal.className = 'modal show';

  var confirmBtnClass = 'btn-primary';
  if (type === 'danger') confirmBtnClass = 'btn-danger';

  var inputHtml = '';
  if (inputConfig) {
    inputHtml =
      '<div style="margin:14px 0;">' +
      (inputConfig.label ? '<label style="display:block;font-size:12px;font-weight:600;color:#6b7280;margin-bottom:6px;">' + _escapeHtml(inputConfig.label) + '</label>' : '') +
      '<input id="confirmInput" type="' + (inputConfig.type || 'text') + '" placeholder="' + _escapeHtml(inputConfig.placeholder || '') + '" style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:6px;font-size:14px;">' +
      '<div id="confirmInputError" style="color:#dc2626;font-size:11px;margin-top:4px;min-height:14px;"></div>' +
      '</div>';
  }

  modal.innerHTML =
    '<div class="modal-content" style="max-width:480px;">' +
    '<div class="modal-header">' +
    '<h3 style="margin:0;font-size:1.2rem;">' + _escapeHtml(title) + '</h3>' +
    '<button class="modal-close" onclick="_cancelConfirm()">×</button>' +
    '</div>' +
    '<div style="padding:8px 0;font-size:14px;color:#374151;line-height:1.6;">' +
    (message.indexOf('<') === 0 ? message : _escapeHtml(message)) +
    '</div>' +
    inputHtml +
    '<div class="form-actions" style="margin-top:16px;justify-content:flex-end;">' +
    '<button class="btn-secondary" onclick="_cancelConfirm()">' + _escapeHtml(cancelText) + '</button>' +
    '<button class="' + confirmBtnClass + '" id="confirmOkBtn">' + _escapeHtml(confirmText) + '</button>' +
    '</div>' +
    '</div>';

  document.body.appendChild(modal);

  // Click outside to cancel
  modal.addEventListener('click', function (e) {
    if (e.target === modal) _cancelConfirm();
  });

  function _closeConfirm() {
    modal.remove();
  }

  window._cancelConfirm = function () {
    _closeConfirm();
    onCancel();
  };

  document.getElementById('confirmOkBtn').addEventListener('click', function () {
    if (inputConfig) {
      var val = document.getElementById('confirmInput').value;
      if (inputConfig.validate) {
        var err = inputConfig.validate(val);
        if (err) {
          document.getElementById('confirmInputError').textContent = err;
          return;
        }
      }
      _closeConfirm();
      onConfirm(val);
    } else {
      _closeConfirm();
      onConfirm();
    }
  });

  if (inputConfig && document.getElementById('confirmInput')) {
    setTimeout(function () {
      document.getElementById('confirmInput').focus();
    }, 100);

    document.getElementById('confirmInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('confirmOkBtn').click();
      }
    });
  }
}

// =========================================
// 9. EXPORT
// =========================================

window.showToast = showToast;
window.formatDate = formatDate;
window.formatDateTime = formatDateTime;
window.formatRupiah = formatRupiah;
window.formatNumber = formatNumber;
window.loadDataOptimized = loadDataOptimized;
window.loadMultipleSheets = loadMultipleSheets;
window.lazyRenderRows = lazyRenderRows;
window.debounceSearch = debounceSearch;
window.renderUserStatus = renderUserStatus;
window.showLoading = showLoading;
window.getCachedData = getCachedData;
window.setCachedData = setCachedData;
window.clearCache = clearCache;
window.clearCacheForAction = clearCacheForAction;
window.handleLogout = handleLogout;
window.confirmDialog = confirmDialog;
window._escapeHtml = _escapeHtml;
// Expose dataCache untuk backward compat
window.dataCache = dataCache;
