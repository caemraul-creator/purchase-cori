/* ============================
   GLOBAL UI HELPERS - CLOUDFLARE OPTIMIZED & FIXED
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
document.addEventListener('DOMContentLoaded', () => {
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
  
  // Init User Floater otomatis
  renderUserStatus();
});

function showLoading(show = true) {
  const loader = document.getElementById('globalLoading');
  if (loader) loader.style.display = show ? 'flex' : 'none';
}

// =========================================
// 2. MAIN LOAD FUNCTION - CLOUDFLARE OPTIMIZED
// =========================================

/**
 * Load data dengan JSONP, cache, deduplication, & retry logic
 * Optimized untuk Cloudflare Pages, Vercel, dan environment lain
 */
function loadDataOptimized(callback, sheetName = '') {
  const cacheKey = sheetName || 'main';

  // 1. Cek Cache terlebih dahulu
  const cached = getCachedData(cacheKey);
  if (cached) {
    if (callback) setTimeout(() => callback(cached), 0);
    return;
  }

  // 2. Cek jika ada request pending untuk sheet yang sama
  if (pendingRequests[cacheKey]) {
    pendingRequests[cacheKey].push(callback);
    return;
  }

  // 3. Tandai request sedang pending
  pendingRequests[cacheKey] = [callback];
  showLoading(true);

  // 4. Generate unique callback name
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  const cbName = `cb_${cacheKey.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}_${random}`;
  
  let isResolved = false;
  let timeoutId = null;
  let retryCount = 0;
  const MAX_RETRIES = 3;

  // 5. Define callback function
  window[cbName] = function(data) {
    if (isResolved) {
      console.warn(`[${cbName}] Callback called multiple times, ignoring`);
      return;
    }

    isResolved = true;
    if (timeoutId) clearTimeout(timeoutId);

    try {
      // Validasi data
      if (!data) {
        throw new Error('Empty response from API');
      }

      if (typeof data === 'string') {
        console.error(`[${cbName}] Received string instead of object:`, data);
        throw new Error('Invalid data format');
      }

      // Cache & execute callbacks
      setCachedData(cacheKey, data);
      const callbacks = pendingRequests[cacheKey] || [];
      delete pendingRequests[cacheKey];

      callbacks.forEach(cb => {
        if (cb && typeof cb === 'function') {
          try {
            cb(data);
          } catch (err) {
            console.error(`Error in callback:`, err);
          }
        }
      });

      console.log(`[${cbName}] Data loaded successfully from ${sheetName || 'main'} sheet`);
    } catch (err) {
      console.error(`[${cbName}] Error processing data:`, err);
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      // Cleanup
      cleanup(cbName);
      showLoading(false);
    }
  };

  // 6. Error handler
  function handleError(reason) {
    if (isResolved) return;

    isResolved = true;
    if (timeoutId) clearTimeout(timeoutId);

    console.error(`[${cbName}] ${reason}`);

    const callbacks = pendingRequests[cacheKey] || [];
    delete pendingRequests[cacheKey];

    // Retry logic
    if (retryCount < MAX_RETRIES) {
      retryCount++;
      const delayMs = 1000 * retryCount; // 1s, 2s, 3s
      console.warn(`[${cbName}] Retrying... (${retryCount}/${MAX_RETRIES}) in ${delayMs}ms`);
      
      cleanup(cbName);
      showLoading(false);

      setTimeout(() => {
        loadDataOptimized(callback, sheetName);
      }, delayMs);
    } else {
      console.error(`[${cbName}] All retries failed`);
      showToast(`Gagal memuat data dari ${sheetName || 'main'} setelah ${MAX_RETRIES} percobaan`, 'error');
      cleanup(cbName);
      showLoading(false);
    }
  }

  // 7. Timeout handler (15 detik)
  timeoutId = setTimeout(() => {
    if (!isResolved) {
      handleError('JSONP Timeout (15s)');
    }
  }, 15000);

  // 8. Build script element
  const script = document.createElement('script');
  script.id = `script-${cbName}`;
  script.async = true;

  try {
    const url = new URL(API_URL);
    url.searchParams.set('action', 'read');
    url.searchParams.set('sheet', sheetName);
    url.searchParams.set('callback', cbName);
    url.searchParams.set('_t', timestamp); // Cache buster

    console.log(`[${cbName}] Fetching from: ${url.origin}${url.pathname}?...`);
    script.src = url.toString();
  } catch (err) {
    console.error('API_URL Error - pastikan config.js sudah dimuat:', err);
    handleError('Invalid API_URL: ' + err.message);
    return;
  }

  // 9. Error event
  script.onerror = () => {
    if (!isResolved) {
      handleError('Script load failed (network error)');
    }
  };

  // 10. Inject script
  document.body.appendChild(script);
}

/**
 * Load multiple sheets secara parallel
 * Gunakan untuk dashboard yang perlu data dari berbagai sheet
 */
function loadMultipleSheets(sheets, onAllLoaded) {
  const results = {};
  let loadedCount = 0;
  const totalSheets = sheets.length;

  if (totalSheets === 0) {
    if (onAllLoaded) onAllLoaded(results);
    return;
  }

  sheets.forEach(sheet => {
    loadDataOptimized((data) => {
      results[sheet] = data;
      loadedCount++;

      console.log(`[loadMultipleSheets] Loaded ${loadedCount}/${totalSheets} sheets`);

      if (loadedCount === totalSheets && onAllLoaded) {
        try {
          onAllLoaded(results);
        } catch (err) {
          console.error('Error in onAllLoaded callback:', err);
        }
      }
    }, sheet);
  });
}

// =========================================
// 3. CLEANUP HELPER
// =========================================
function cleanup(cbName) {
  delete window[cbName];
  const scriptEl = document.getElementById(`script-${cbName}`);
  if (scriptEl && scriptEl.parentNode) {
    scriptEl.parentNode.removeChild(scriptEl);
  }
}

// =========================================
// 4. FORMATTERS
// =========================================

function formatDate(v) {
  if (!v || v === 'Never Buy') return v || '';
  
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return v;
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (err) {
    return v;
  }
}

function formatDateTime(v) {
  if (!v) return '';
  
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return v;
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    
    return `${day}/${month}/${year} ${hour}:${minute}`;
  } catch (err) {
    return v;
  }
}

function formatRupiah(v) {
  if (v === '' || v == null || isNaN(v)) return '';
  
  try {
    const num = parseFloat(v);
    return 'Rp ' + num.toLocaleString('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  } catch (err) {
    return v;
  }
}

function formatNumber(v) {
  if (v === '' || v == null || isNaN(v)) return '';
  
  try {
    const num = parseFloat(v);
    return num.toLocaleString('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  } catch (err) {
    return v;
  }
}

// Format Object untuk konsistensi
const Format = {
  date: formatDate,
  dateTime: formatDateTime,
  rupiah: formatRupiah,
  number: formatNumber
};

// =========================================
// 5. UI UTILS
// =========================================

/**
 * Lazy render rows untuk performa table besar
 * @param {Array<string>} rowsHtmlArray - Array HTML strings (one per row)
 * @param {HTMLElement} tbody - Target tbody element
 * @param {number} batchSize - Rows per batch (default 50)
 */
function lazyRenderRows(rowsHtmlArray, tbody, batchSize = 50) {
  if (!Array.isArray(rowsHtmlArray)) {
    console.error('lazyRenderRows: rowsHtmlArray must be array');
    return;
  }

  if (!tbody) {
    console.error('lazyRenderRows: tbody element not found');
    return;
  }

  // Kosongkan tbody
  tbody.innerHTML = '';

  if (rowsHtmlArray.length === 0) {
    return;
  }

  let index = 0;

  function renderBatch() {
    if (index >= rowsHtmlArray.length) return;

    const end = Math.min(index + batchSize, rowsHtmlArray.length);
    const batch = rowsHtmlArray.slice(index, end);
    const batchHtml = batch.join('');

    tbody.insertAdjacentHTML('beforeend', batchHtml);
    index = end;

    if (index < rowsHtmlArray.length) {
      requestAnimationFrame(renderBatch);
    }
  }

  renderBatch();
}

/**
 * Debounce function untuk search
 */
function debounceSearch(func, wait) {
  let timeout = null;
  
  return function executedFunction(...args) {
    const later = () => {
      timeout = null;
      func.apply(this, args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// =========================================
// 6. TOAST NOTIFICATION
// =========================================

function showToast(msg, type = 'success', duration = 3000) {
  let toast = document.getElementById('toast');
  
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }

  toast.textContent = msg;
  toast.className = 'toast show';

  // Set color based on type
  if (type === 'error') {
    toast.style.background = '#dc2626';
  } else if (type === 'warning') {
    toast.style.background = '#f59e0b';
  } else {
    toast.style.background = '#16a34a';
  }

  // Auto hide
  setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

// =========================================
// 7. USER SESSION MANAGEMENT
// =========================================

const userStatusCache = {};

function renderUserStatus() {
  const container = document.getElementById('userFloater');
  if (!container) return;

  const user = sessionStorage.getItem('username') || 'User';

  // Use cache untuk performa
  if (!userStatusCache[user]) {
    const rawRole = sessionStorage.getItem('userRole') || 'viewer';
    const role = rawRole.toLowerCase().trim().replace(/ /g, '_');
    
    let roleName = rawRole;
    if (typeof ROLE_NAMES !== 'undefined' && ROLE_NAMES[role]) {
      roleName = ROLE_NAMES[role];
    }

    userStatusCache[user] = {
      user,
      roleName,
      initial: user.charAt(0).toUpperCase()
    };
  }

  const { initial, roleName } = userStatusCache[user];

  container.innerHTML = `
    <div class="user-avatar">${initial}</div>
    <div class="user-meta">
      <div class="user-id">${user}</div>
      <div class="user-tag">${roleName}</div>
    </div>
    <button class="nav-logout" onclick="performLogout()" title="Logout">⊙</button>
  `;
}

function performLogout() {
  if (confirm('Keluar dari aplikasi?')) {
    sessionStorage.clear();
    // Gunakan relative path
    window.location.href = 'login.html';
  }
}