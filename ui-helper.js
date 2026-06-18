/* ============================
   GLOBAL UI HELPERS
============================ */

// =========================================
// 1. CACHE & OPTIMIZED LOADING SYSTEM
// =========================================
let dataCache = {};
const CACHE_TIMEOUT = 5 * 60 * 1000; // 5 menit
let pendingRequests = {};

function getCachedData(key) {
  const cached = dataCache[key];
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

// Global Loading Indicator
document.addEventListener('DOMContentLoaded', function () {
  if (!document.getElementById('globalLoading')) {
    const loader = document.createElement('div');
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
  const loader = document.getElementById('globalLoading');
  if (loader) loader.style.display = show ? 'flex' : 'none';
}

// =========================================
// 2. MAIN LOAD FUNCTION
// =========================================

function loadDataOptimized(callback, sheetName) {
  if (sheetName === undefined) sheetName = '';
  const cacheKey = sheetName || 'main';

  const cached = getCachedData(cacheKey);
  if (cached) {
    if (callback) setTimeout(function () { callback(cached); }, 0);
    return;
  }

  if (pendingRequests[cacheKey]) {
    pendingRequests[cacheKey].push(callback);
    return;
  }

  pendingRequests[cacheKey] = [callback];
  showLoading(true);

  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  const cbName = 'cb_' + cacheKey.replace(/[^a-zA-Z0-9]/g, '_') + '_' + timestamp + '_' + random;

  let isResolved = false;
  let timeoutId = null;
  let retryCount = 0;
  const MAX_RETRIES = 3;

  window[cbName] = function (data) {
    if (isResolved) return;
    isResolved = true;
    if (timeoutId) clearTimeout(timeoutId);

    try {
      if (!data) throw new Error('Empty response from API');
      if (typeof data === 'string') throw new Error('Invalid data format');

      setCachedData(cacheKey, data);
      const callbacks = pendingRequests[cacheKey] || [];
      delete pendingRequests[cacheKey];

      callbacks.forEach(function (cb) {
        if (cb && typeof cb === 'function') {
          try { cb(data); } catch (err) { console.error('Error in callback:', err); }
        }
      });
    } catch (err) {
      console.error('[' + cbName + '] Error:', err);
      showToast('Error: ' + err.message, 'error');
    } finally {
      cleanup(cbName);
      showLoading(false);
    }
  };

  function handleError(reason) {
    if (isResolved) return;
    isResolved = true;
    if (timeoutId) clearTimeout(timeoutId);

    const callbacks = pendingRequests[cacheKey] || [];
    delete pendingRequests[cacheKey];

    if (retryCount < MAX_RETRIES) {
      retryCount++;
      const delayMs = 1000 * retryCount;
      cleanup(cbName);
      showLoading(false);
      setTimeout(function () {
        loadDataOptimized(callback, sheetName);
      }, delayMs);
    } else {
      showToast('Gagal memuat data dari ' + (sheetName || 'main'), 'error');
      cleanup(cbName);
      showLoading(false);
    }
  }

  timeoutId = setTimeout(function () {
    if (!isResolved) handleError('JSONP Timeout (15s)');
  }, 15000);

  const script = document.createElement('script');
  script.id = 'script-' + cbName;
  script.async = true;

  try {
    const url = new URL(API_URL);
    url.searchParams.set('action', 'read');
    url.searchParams.set('sheet', sheetName);
    url.searchParams.set('callback', cbName);
    url.searchParams.set('_t', timestamp);
    script.src = url.toString();
  } catch (err) {
    console.error('API_URL Error:', err);
    handleError('Invalid API_URL');
    return;
  }

  script.onerror = function () {
    if (!isResolved) handleError('Script load failed');
  };

  document.body.appendChild(script);
}

function loadMultipleSheets(sheets, onAllLoaded) {
  const results = {};
  let loadedCount = 0;
  const totalSheets = sheets.length;

  if (totalSheets === 0) {
    if (onAllLoaded) onAllLoaded(results);
    return;
  }

  sheets.forEach(function (sheet) {
    loadDataOptimized(function (data) {
      results[sheet] = data;
      loadedCount++;
      if (loadedCount === totalSheets && onAllLoaded) {
        try { onAllLoaded(results); } catch (err) { console.error('Error in callback:', err); }
      }
    }, sheet);
  });
}

function cleanup(cbName) {
  delete window[cbName];
  const scriptEl = document.getElementById('script-' + cbName);
  if (scriptEl && scriptEl.parentNode) {
    scriptEl.parentNode.removeChild(scriptEl);
  }
}

// =========================================
// 3. FORMATTERS
// =========================================

function formatDate(v) {
  if (!v || v === 'Never Buy') return v || '';
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return v;
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  } catch (e) { return v; }
}

function formatDateTime(v) {
  if (!v) return '';
  try {
    const d = new Date(v);
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
// 4. UI UTILS
// =========================================

function lazyRenderRows(rowsHtmlArray, tbody, batchSize) {
  if (batchSize === undefined) batchSize = 50;
  if (!Array.isArray(rowsHtmlArray) || !tbody) return;
  tbody.innerHTML = '';
  if (rowsHtmlArray.length === 0) return;

  let index = 0;
  function renderBatch() {
    if (index >= rowsHtmlArray.length) return;
    const end = Math.min(index + batchSize, rowsHtmlArray.length);
    tbody.insertAdjacentHTML('beforeend', rowsHtmlArray.slice(index, end).join(''));
    index = end;
    if (index < rowsHtmlArray.length) requestAnimationFrame(renderBatch);
  }
  renderBatch();
}

function debounceSearch(func, wait) {
  let timeout = null;
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
// 5. TOAST NOTIFICATION
// =========================================

function showToast(msg, type, duration) {
  if (type === undefined) type = 'success';
  if (duration === undefined) duration = 3000;

  let toast = document.getElementById('toast');
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
// 6. USER SESSION MANAGEMENT
// =========================================

function renderUserStatus() {
  const container = document.getElementById('userFloater');
  if (!container) return;

  const user = sessionStorage.getItem('username') || 'User';
  const rawRole = sessionStorage.getItem('userRole') || 'viewer';
  const role = rawRole.toLowerCase().trim().replace(/ /g, '_');
  let roleName = rawRole;
  if (typeof ROLE_NAMES !== 'undefined' && ROLE_NAMES[role]) {
    roleName = ROLE_NAMES[role];
  }
  const initial = user.charAt(0).toUpperCase();

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

// Export untuk digunakan di global
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