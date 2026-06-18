/**
 * firebase-helper.js - Firebase Integration with Sync
 * REFACTORED v2.0:
 * - syncFirebaseWithSheet: silent param (no toast spam on auto-sync)
 * - syncAllSheets: no full renderPage, only refresh active table
 * - startAutoSync: silent by default
 * - Async/await untuk mengurangi callback hell
 * - Hapus duplikasi dengan ui-helper.loadDataLegacy
 */

// ============================================
// 1. FIREBASE INITIALIZATION
// ============================================

let firebaseApp = null;
let firebaseDb = null;
let firebaseInitialized = false;
let isSyncing = false;
// Track active Firebase listeners for cleanup
var _firebaseListeners = {};

function initFirebase() {
  if (!USE_FIREBASE) {
    if (typeof debugLog === 'function') debugLog('ℹ️ Firebase disabled');
    return false;
  }

  try {
    if (typeof firebase === 'undefined') {
      console.warn('⚠️ Firebase SDK not loaded');
      return false;
    }

    if (!firebase.apps.length) {
      firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
      firebaseDb = firebase.database();
      firebaseInitialized = true;
      if (typeof debugLog === 'function') debugLog('✅ Firebase initialized successfully');
      firebaseDb.goOnline();
      return true;
    } else {
      firebaseApp = firebase.app();
      firebaseDb = firebase.database();
      firebaseInitialized = true;
      if (typeof debugLog === 'function') debugLog('✅ Firebase already initialized');
      return true;
    }
  } catch (err) {
    if (typeof debugError === 'function') debugError('❌ Firebase init error:', err);
    return false;
  }
}

// ============================================
// 2. FIREBASE CRUD OPERATIONS
// ============================================

function saveToFirebase(path, data) {
  if (!firebaseInitialized || !USE_FIREBASE) return Promise.resolve(false);

  return new Promise(function (resolve, reject) {
    try {
      var ref = firebaseDb.ref(path);
      ref.set(data, function (error) {
        if (error) {
          if (typeof debugError === 'function') debugError('❌ Firebase save error:', error);
          reject(error);
        } else {
          if (typeof debugLog === 'function') debugLog('✅ Saved to Firebase:', path);
          resolve(true);
        }
      });
    } catch (err) {
      if (typeof debugError === 'function') debugError('❌ Firebase save error:', err);
      reject(err);
    }
  });
}

function loadFromFirebase(path) {
  if (!firebaseInitialized || !USE_FIREBASE) return Promise.resolve(null);

  return new Promise(function (resolve, reject) {
    try {
      var ref = firebaseDb.ref(path);
      ref.once('value', function (snapshot) {
        var data = snapshot.val();
        if (data) {
          if (typeof debugLog === 'function') debugLog('✅ Loaded from Firebase:', path, Array.isArray(data) ? data.length + ' records' : '');
          resolve(data);
        } else {
          resolve(null);
        }
      }, function (error) {
        if (typeof debugError === 'function') debugError('❌ Firebase load error:', error);
        reject(error);
      });
    } catch (err) {
      if (typeof debugError === 'function') debugError('❌ Firebase load error:', err);
      reject(err);
    }
  });
}

function removeFromFirebase(path) {
  if (!firebaseInitialized || !USE_FIREBASE) return Promise.resolve(false);

  return new Promise(function (resolve, reject) {
    try {
      var ref = firebaseDb.ref(path);
      ref.remove(function (error) {
        if (error) {
          if (typeof debugError === 'function') debugError('❌ Firebase remove error:', error);
          reject(error);
        } else {
          if (typeof debugLog === 'function') debugLog('✅ Removed from Firebase:', path);
          resolve(true);
        }
      });
    } catch (err) {
      if (typeof debugError === 'function') debugError('❌ Firebase remove error:', err);
      reject(err);
    }
  });
}

/**
 * ✅ NEW: Subscribe to realtime updates from Firebase.
 * Returns an unsubscribe function.
 */
function subscribeToFirebase(path, callback) {
  if (!firebaseInitialized || !USE_FIREBASE) {
    callback(null);
    return function () {};
  }

  try {
    var ref = firebaseDb.ref(path);
    var handler = ref.on('value', function (snapshot) {
      var data = snapshot.val();
      callback(data);
    }, function (err) {
      if (typeof debugError === 'function') debugError('Firebase subscribe error:', err);
      callback(null);
    });

    // Track for cleanup
    _firebaseListeners[path] = { ref: ref, handler: handler };

    return function unsubscribe() {
      try {
        ref.off('value', handler);
      } catch (e) {}
      delete _firebaseListeners[path];
    };
  } catch (err) {
    if (typeof debugError === 'function') debugError('Firebase subscribe init error:', err);
    callback(null);
    return function () {};
  }
}

// ============================================
// 3. SYNC - Firebase & Google Sheet
// ============================================

/**
 * Sync Firebase with Google Sheet.
 * @param {string} sheetName
 * @param {boolean} forceRefresh
 * @param {boolean} silent - if true, don't show toast (for auto-sync)
 */
function syncFirebaseWithSheet(sheetName, forceRefresh, silent) {
  if (forceRefresh === undefined) forceRefresh = false;
  if (sheetName === undefined) sheetName = '';
  if (silent === undefined) silent = false;

  if (isSyncing) {
    if (typeof debugLog === 'function') debugLog('⏳ Sync already in progress...');
    return Promise.resolve({ success: false, message: 'Sync already in progress' });
  }

  isSyncing = true;
  if (!silent && typeof showToast === 'function') {
    showToast('🔄 Sinkronisasi data...', 'warning', 5000);
  }

  var cacheKey = sheetName || 'main';
  var firebasePath = 'purchase_data/' + cacheKey;
  var timestampPath = 'purchase_data/_lastSync_' + cacheKey;

  return new Promise(function (resolve, reject) {
    if (typeof debugLog === 'function') debugLog('🌐 Fetching from Google Sheet:', sheetName || 'main');

    loadDataFromAPI(function (apiData) {
      if (!apiData || apiData.length === 0) {
        isSyncing = false;
        if (!silent && typeof showToast === 'function') {
          showToast('⚠️ Tidak ada data dari Google Sheet', 'error');
        }
        resolve({ success: false, message: 'No data from API' });
        return;
      }

      if (typeof debugLog === 'function') debugLog('📊 Data from API:', apiData.length, 'records');

      saveToFirebase(firebasePath, apiData)
        .then(function () {
          var now = new Date().toISOString();
          return saveToFirebase(timestampPath, { lastSync: now, count: apiData.length });
        })
        .then(function () {
          setCachedData(cacheKey, apiData);

          isSyncing = false;
          if (typeof debugLog === 'function') debugLog('✅ Sync completed:', apiData.length, 'records');
          if (!silent && typeof showToast === 'function') {
            showToast('✅ Sinkronisasi berhasil! ' + apiData.length + ' data', 'success');
          }
          resolve({ success: true, count: apiData.length });
        })
        .catch(function (err) {
          isSyncing = false;
          if (typeof debugError === 'function') debugError('❌ Sync failed:', err);
          if (!silent && typeof showToast === 'function') {
            showToast('❌ Sinkronisasi gagal: ' + err.message, 'error');
          }
          reject(err);
        });
    }, sheetName);
  });
}

function loadDataFromAPI(callback, sheetName) {
  if (sheetName === undefined) sheetName = '';

  var timestamp = Date.now();
  var random = Math.random().toString(36).substr(2, 9);
  var cbName = 'cb_sync_' + timestamp + '_' + random;

  var isResolved = false;
  var timeoutId = null;

  window[cbName] = function (data) {
    if (isResolved) return;
    isResolved = true;
    if (timeoutId) clearTimeout(timeoutId);

    try {
      if (!data) {
        callback([]);
        return;
      }
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch (e) {
          callback([]);
          return;
        }
      }
      callback(data);
    } catch (err) {
      if (typeof debugError === 'function') debugError('Error processing API data:', err);
      callback([]);
    } finally {
      cleanup(cbName);
    }
  };

  timeoutId = setTimeout(function () {
    if (!isResolved) {
      isResolved = true;
      cleanup(cbName);
      callback([]);
      if (typeof debugWarn === 'function') debugWarn('loadDataFromAPI timeout:', sheetName);
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
        cleanup(cbName);
        callback([]);
        if (typeof debugError === 'function') debugError('loadDataFromAPI network error:', sheetName);
      }
    };
    document.body.appendChild(script);
  } catch (err) {
    if (typeof debugError === 'function') debugError('Error loading from API:', err);
    cleanup(cbName);
    callback([]);
  }
}

function cleanup(cbName) {
  delete window[cbName];
  var scriptEl = document.getElementById('script-' + cbName);
  if (scriptEl && scriptEl.parentNode) {
    scriptEl.parentNode.removeChild(scriptEl);
  }
}

// ============================================
// 4. LOAD DATA - Dengan Sync Check (cache-first)
// ============================================

function loadDataSmart(callback, sheetName, forceRefresh) {
  if (forceRefresh === undefined) forceRefresh = false;
  if (sheetName === undefined) sheetName = '';

  var cacheKey = sheetName || 'main';
  var firebasePath = 'purchase_data/' + cacheKey;

  // Force refresh: sync with API dulu, baru ambil dari Firebase
  if (forceRefresh) {
    if (typeof debugLog === 'function') debugLog('🔄 Force refresh, syncing with API...');

    syncFirebaseWithSheet(sheetName, true, true) // silent
      .then(function (result) {
        if (result.success) {
          return loadFromFirebase(firebasePath);
        }
        return null;
      })
      .then(function (data) {
        if (data) {
          setCachedData(cacheKey, data);
          if (callback) callback(data);
        } else {
          // Fallback to cache
          var cached = getCachedData(cacheKey);
          if (callback) callback(cached || []);
        }
      })
      .catch(function () {
        var cached = getCachedData(cacheKey);
        if (callback) callback(cached || []);
      });
    return;
  }

  // 1. Cek cache lokal dulu (anti reload berulang)
  var localData = getCachedData(cacheKey);
  if (localData) {
    if (typeof debugLog === 'function') debugLog('📦 Data from cache:', cacheKey, localData.length, 'records');
    if (callback) setTimeout(function () { callback(localData); }, 0);
    return;
  }

  // 2. Cek Firebase
  if (USE_FIREBASE && firebaseInitialized) {
    loadFromFirebase(firebasePath)
      .then(function (data) {
        if (data && data.length > 0) {
          if (typeof debugLog === 'function') debugLog('☁️ Data from Firebase:', cacheKey, data.length, 'records');
          setCachedData(cacheKey, data);
          if (callback) callback(data);
          return;
        }
        // Firebase kosong, sync dari API
        if (typeof debugLog === 'function') debugLog('🌐 Firebase empty, syncing from API...');
        return syncFirebaseWithSheet(sheetName, false, true)
          .then(function (result) {
            if (result.success) {
              return loadFromFirebase(firebasePath);
            }
            return null;
          })
          .then(function (data) {
            if (data) {
              setCachedData(cacheKey, data);
              if (callback) callback(data);
            } else {
              if (callback) callback([]);
            }
          });
      })
      .catch(function () {
        // Firebase error, fallback ke API langsung
        if (typeof debugLog === 'function') debugLog('🌐 Firebase error, fallback to API...');
        syncFirebaseWithSheet(sheetName, false, true)
          .then(function (result) {
            if (result.success) {
              return loadFromFirebase(firebasePath);
            }
            return null;
          })
          .then(function (data) {
            if (data) {
              setCachedData(cacheKey, data);
              if (callback) callback(data);
            } else {
              if (callback) callback([]);
            }
          })
          .catch(function () {
            if (callback) callback([]);
          });
      });
  } else {
    // Firebase tidak aktif, langsung dari API
    if (typeof debugLog === 'function') debugLog('🌐 Loading from API:', sheetName || 'main');
    loadDataFromAPI(function (data) {
      if (data && data.length > 0) {
        setCachedData(cacheKey, data);
        if (USE_FIREBASE && firebaseInitialized) {
          saveToFirebase(firebasePath, data);
        }
      }
      if (callback) callback(data || []);
    }, sheetName);
  }
}

// ============================================
// 5. SYNC ALL SHEETS
// ============================================

/**
 * ✅ FIXED: Tidak manggil renderPage() (yang reset search & pagination)
 * Hanya refresh tabel aktif, dan tidak re-build HTML page
 */
function syncAllSheets(silent) {
  if (silent === undefined) silent = false;
  var sheets = ['', 'done', 'rejected'];
  var results = {};
  var completed = 0;

  if (!silent && typeof showToast === 'function') {
    showToast('🔄 Sinkronisasi semua data...', 'warning', 5000);
  }

  sheets.forEach(function (sheet) {
    syncFirebaseWithSheet(sheet, true, true) // silent per-sheet
      .then(function (result) {
        results[sheet || 'main'] = result;
        completed++;
        if (completed === sheets.length) {
          _onSyncAllComplete(results, sheets, silent);
        }
      })
      .catch(function (err) {
        results[sheet || 'main'] = { success: false, error: err.message };
        completed++;
        if (completed === sheets.length) {
          _onSyncAllComplete(results, sheets, silent);
        }
      });
  });
}

function _onSyncAllComplete(results, sheets, silent) {
  var total = 0;
  sheets.forEach(function (s) {
    if (results[s || 'main'] && results[s || 'main'].count) {
      total += results[s || 'main'].count;
    }
  });

  if (typeof debugLog === 'function') debugLog('✅ All sheets synced:', results);

  if (!silent) {
    if (typeof showToast === 'function') {
      showToast('✅ Sinkronisasi selesai! Total ' + total + ' data', 'success');
    }
  }

  // ✅ Refresh tabel aktif saja (bukan renderPage)
  var currentPage = (sessionStorage.getItem('currentPage') || 'dashboard');
  if (typeof refreshActiveTable === 'function') {
    refreshActiveTable(currentPage, true); // silentRefresh=true
  }
}

// ============================================
// 6. TOMBOL SYNC - UI
// ============================================

function addSyncButton() {
  var headActions = document.querySelector('.head-actions');
  if (!headActions) {
    setTimeout(addSyncButton, 1000);
    return;
  }

  if (document.getElementById('syncButton')) return;

  var syncBtn = document.createElement('button');
  syncBtn.id = 'syncButton';
  syncBtn.className = 'btn-secondary';
  syncBtn.style.cssText = 'display:flex;align-items:center;gap:6px;';
  syncBtn.innerHTML = '🔄 Sync';
  syncBtn.onclick = function () {
    confirmDialog({
      title: 'Sinkronisasi',
      message: 'Sinkronkan semua data dari Google Sheet ke Firebase?',
      confirmText: 'Ya, Sync',
      onConfirm: function () {
        syncAllSheets(false); // not silent
      }
    });
  };

  headActions.appendChild(syncBtn);
  if (typeof debugLog === 'function') debugLog('✅ Sync button added');
}

// ============================================
// 7. AUTO SYNC - Silent by default
// ============================================

function startAutoSync(intervalMinutes) {
  if (intervalMinutes === undefined || intervalMinutes === 0) {
    if (typeof debugLog === 'function') debugLog('ℹ️ Auto-sync disabled');
    return;
  }

  if (typeof debugLog === 'function') debugLog('🔄 Auto-sync started, interval:', intervalMinutes, 'min');

  setInterval(function () {
    // ✅ Skip kalau tab tidak visible (hemat bandwidth)
    if (document.hidden) {
      if (typeof debugLog === 'function') debugLog('⏸️ Auto-sync skipped (tab hidden)');
      return;
    }

    if (typeof debugLog === 'function') debugLog('🔄 Auto-sync triggered...');
    var sheets = ['', 'done', 'rejected'];
    sheets.forEach(function (sheet) {
      syncFirebaseWithSheet(sheet, true, true) // silent
        .then(function (result) {
          if (result.success) {
            if (typeof debugLog === 'function') debugLog('✅ Auto-sync success:', sheet || 'main', result.count);
          }
        })
        .catch(function (err) {
          if (typeof debugWarn === 'function') debugWarn('⚠️ Auto-sync failed:', sheet || 'main', err.message);
        });
    });
  }, intervalMinutes * 60 * 1000);
}

// ============================================
// 8. EXPORT FUNCTIONS
// ============================================

window.initFirebase = initFirebase;
window.saveToFirebase = saveToFirebase;
window.loadFromFirebase = loadFromFirebase;
window.removeFromFirebase = removeFromFirebase;
window.subscribeToFirebase = subscribeToFirebase;
window.loadDataSmart = loadDataSmart;
window.syncFirebaseWithSheet = syncFirebaseWithSheet;
window.syncAllSheets = syncAllSheets;
window.addSyncButton = addSyncButton;
window.startAutoSync = startAutoSync;
window.loadDataFromAPI = loadDataFromAPI;
