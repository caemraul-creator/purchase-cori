/* ============================
   GLOBAL UI HELPERS
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

// =========================================
// 2. GLOBAL LOADING
// =========================================

document.addEventListener('DOMContentLoaded', function () {
  if (!document.getElementById('globalLoading')) {
    var loader = document.createElement('div');
    loader.id = 'globalLoading';
    loader.style.cssText = 'position:fixed;inset:0;background:rgba(255,255,255,0.8);display:none;justify-content:center;align-items:center;z-index:9999;';
    loader.innerHTML = `
      <div style="background:white;padding:20px;border-radius:12px;box-shadow:0 4px 15px rgba(0,0,0,0.15);display:flex;gap:15px;align-items:center;">
        <div style="width:24px;height:24px;border:3px solid #e5e7eb;border-top:3px solid #2563eb;border-radius:50%;animation:spin 1s linear infinite"></div>
        <span style="font-family:sans-serif;color:#374151;">Memuat data...</span>
      </div>
      <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    `;
    document.body.appendChild(loader);
  }
});

function showLoading(show) {
  if (show === undefined) show = true;
  var loader = document.getElementById('globalLoading');
  if (loader) loader.style.display = show ? 'flex' : 'none';
}

// =========================================
// 3. LOAD DATA - GUNakan loadDataSmart
// =========================================

function loadDataOptimized(callback, sheetName) {
  if (sheetName === undefined) sheetName = '';

  // Gunakan loadDataSmart dari firebase-helper.js
  if (typeof loadDataSmart === 'function' && USE_FIREBASE) {
    loadDataSmart(callback, sheetName, false);
    return;
  }

  // Fallback
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
      console.error('Error:', err);
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
      }
    };
    document.body.appendChild(script);
  } catch (err) {
    console.error('API_URL Error:', err);
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
  if (typeof loadMultipleSheetsSmart === 'function' && USE_FIREBASE) {
    loadMultipleSheetsSmart(sheets, onAllLoaded, false);
    return;
  }

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
        try { onAllLoaded(results); } catch (err) { console.error('Error in callback:', err); }
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
    return 'Rp ' + parseFloat(v).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  } catch (e) { return v; }
}

function formatNumber(v) {
  if (v === '' || v == null || isNaN(v)) return '';
  try {
    return parseFloat(v).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  } catch (e) { return v; }
}

// =========================================
// 5. UI UTILS
// =========================================

function lazyRenderRows(rowsHtmlArray, tbody, batchSize) {
  if (batchSize === undefined) batchSize = 50;
  if (!Array.isArray(rowsHtmlArray) || !tbody) return;
  tbody.innerHTML = '';
  if (rowsHtmlArray.length === 0) return;

  var index = 0;
  function renderBatch() {
    if (index >= rowsHtmlArray.length) return;
    var end = Math.min(index + batchSize, rowsHtmlArray.length);
    tbody.insertAdjacentHTML('beforeend', rowsHtmlArray.slice(index, end).join(''));
    index = end;
    if (index < rowsHtmlArray.length) requestAnimationFrame(renderBatch);
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
// 6. TOAST
// =========================================

function showToast(msg, type, duration) {
  if (type === undefined) type = 'success';
  if (duration === undefined) duration = 3000;

  var toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = 'toast show';
  toast.style.background = type === 'error' ? '#dc2626' : type === 'warning' ? '#f59e0b' : '#16a34a';
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

  setTimeout(function () {
    toast.classList.remove('show');
  }, duration);
}

// =========================================
// 7. USER STATUS
// =========================================

function renderUserStatus() {
  var container = document.getElementById('userFloater');
  if (!container) return;

  var user = sessionStorage.getItem('username') || 'User';
  var rawRole = sessionStorage.getItem('userRole') || 'viewer';
  var role = rawRole.toLowerCase().trim().replace(/ /g, '_');
  var roleName = rawRole;
  if (typeof ROLE_NAMES !== 'undefined' && ROLE_NAMES[role]) {
    roleName = ROLE_NAMES[role];
  }
  var initial = user.charAt(0).toUpperCase();

  container.innerHTML = `
    <div class="user-avatar">${initial}</div>
    <div class="user-meta">
      <div class="user-id">${user}</div>
      <div class="user-tag">${roleName}</div>
    </div>
    <button class="nav-logout" onclick="handleLogout()" title="Logout">✕</button>
  `;
}

function handleLogout() {
  if (confirm('Keluar dari aplikasi?')) {
    sessionStorage.clear();
    window.location.href = 'login.html';
  }
}

// =========================================
// 8. EXPORT
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
window.handleLogout = handleLogout;