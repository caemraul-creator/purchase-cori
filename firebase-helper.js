/**
 * firebase-helper.js - Firebase Integration with Sync
 */

// ============================================
// 1. FIREBASE INITIALIZATION
// ============================================

let firebaseApp = null;
let firebaseDb = null;
let firebaseInitialized = false;
let isSyncing = false;

function initFirebase() {
    if (!USE_FIREBASE) {
        console.log('ℹ️ Firebase disabled');
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
            console.log('✅ Firebase initialized successfully');

            // Set offline persistence
            firebaseDb.goOnline();
            return true;
        } else {
            firebaseApp = firebase.app();
            firebaseDb = firebase.database();
            firebaseInitialized = true;
            console.log('✅ Firebase already initialized');
            return true;
        }
    } catch (err) {
        console.error('❌ Firebase initialization error:', err);
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
                    console.error('❌ Firebase save error:', error);
                    reject(error);
                } else {
                    console.log('✅ Data saved to Firebase:', path);
                    resolve(true);
                }
            });
        } catch (err) {
            console.error('❌ Firebase save error:', err);
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
                    console.log('✅ Data loaded from Firebase:', path);
                    resolve(data);
                } else {
                    resolve(null);
                }
            }, function (error) {
                console.error('❌ Firebase load error:', error);
                reject(error);
            });
        } catch (err) {
            console.error('❌ Firebase load error:', err);
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
                    console.error('❌ Firebase remove error:', error);
                    reject(error);
                } else {
                    console.log('✅ Data removed from Firebase:', path);
                    resolve(true);
                }
            });
        } catch (err) {
            console.error('❌ Firebase remove error:', err);
            reject(err);
        }
    });
}

// ============================================
// 3. SYNC - Sinkronisasi Firebase & Google Sheet
// ============================================

function syncFirebaseWithSheet(sheetName, forceRefresh) {
    if (forceRefresh === undefined) forceRefresh = false;
    if (sheetName === undefined) sheetName = '';

    if (isSyncing) {
        console.log('⏳ Sync already in progress...');
        return Promise.resolve({ success: false, message: 'Sync already in progress' });
    }

    isSyncing = true;
    showToast('🔄 Sinkronisasi data...', 'warning', 5000);

    var cacheKey = sheetName || 'main';
    var firebasePath = 'purchase_data/' + cacheKey;
    var timestampPath = 'purchase_data/_lastSync_' + cacheKey;

    return new Promise(function (resolve, reject) {
        // 1. Ambil data dari Google Sheet
        console.log('🌐 Fetching from Google Sheet:', sheetName || 'main');

        loadDataFromAPI(function (apiData) {
            if (!apiData || apiData.length === 0) {
                isSyncing = false;
                showToast('⚠️ Tidak ada data dari Google Sheet', 'error');
                resolve({ success: false, message: 'No data from API' });
                return;
            }

            console.log('📊 Data from API:', apiData.length, 'records');

            // 2. Simpan ke Firebase
            saveToFirebase(firebasePath, apiData)
                .then(function () {
                    // 3. Simpan timestamp sync
                    var now = new Date().toISOString();
                    return saveToFirebase(timestampPath, { lastSync: now, count: apiData.length });
                })
                .then(function () {
                    // 4. Update cache lokal
                    setCachedData(cacheKey, apiData);

                    isSyncing = false;
                    console.log('✅ Sync completed:', apiData.length, 'records');
                    showToast('✅ Sinkronisasi berhasil! ' + apiData.length + ' data', 'success');
                    resolve({ success: true, count: apiData.length });
                })
                .catch(function (err) {
                    isSyncing = false;
                    console.error('❌ Sync failed:', err);
                    showToast('❌ Sinkronisasi gagal: ' + err.message, 'error');
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
            console.error('Error processing API data:', err);
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
            }
        };
        document.body.appendChild(script);
    } catch (err) {
        console.error('Error loading from API:', err);
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
// 4. LOAD DATA - Dengan Sync Check
// ============================================

function loadDataSmart(callback, sheetName, forceRefresh) {
    if (forceRefresh === undefined) forceRefresh = false;
    if (sheetName === undefined) sheetName = '';

    var cacheKey = sheetName || 'main';
    var firebasePath = 'purchase_data/' + cacheKey;

    // Jika force refresh, sync dulu
    if (forceRefresh) {
        console.log('🔄 Force refresh, syncing with Firebase...');
        syncFirebaseWithSheet(sheetName, true)
            .then(function (result) {
                if (result.success) {
                    // Ambil dari Firebase setelah sync
                    loadFromFirebase(firebasePath)
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
                } else {
                    // Sync gagal, coba cache
                    var cached = getCachedData(cacheKey);
                    if (cached) {
                        if (callback) callback(cached);
                    } else {
                        if (callback) callback([]);
                    }
                }
            });
        return;
    }

    // 1. Cek localStorage dulu
    var localData = getCachedData(cacheKey);
    if (localData) {
        console.log('📦 Data from localStorage:', cacheKey);
        if (callback) setTimeout(function () { callback(localData); }, 0);
        return;
    }

    // 2. Cek Firebase
    if (USE_FIREBASE && firebaseInitialized) {
        loadFromFirebase(firebasePath)
            .then(function (data) {
                if (data && data.length > 0) {
                    console.log('☁️ Data from Firebase:', cacheKey, data.length, 'records');
                    setCachedData(cacheKey, data);
                    if (callback) callback(data);
                    return;
                }
                // Firebase kosong, ambil dari API dan sync
                console.log('🌐 Firebase empty, loading from API...');
                syncFirebaseWithSheet(sheetName)
                    .then(function (result) {
                        if (result.success) {
                            loadFromFirebase(firebasePath)
                                .then(function (data) {
                                    if (data) {
                                        setCachedData(cacheKey, data);
                                        if (callback) callback(data);
                                    } else {
                                        if (callback) callback([]);
                                    }
                                });
                        } else {
                            if (callback) callback([]);
                        }
                    });
            })
            .catch(function () {
                // Firebase error, fallback ke API
                console.log('🌐 Firebase error, loading from API...');
                syncFirebaseWithSheet(sheetName)
                    .then(function (result) {
                        if (result.success) {
                            loadFromFirebase(firebasePath)
                                .then(function (data) {
                                    if (data) {
                                        setCachedData(cacheKey, data);
                                        if (callback) callback(data);
                                    } else {
                                        if (callback) callback([]);
                                    }
                                });
                        } else {
                            if (callback) callback([]);
                        }
                    });
            });
    } else {
        // Firebase tidak aktif, langsung dari API
        console.log('🌐 Loading from API:', sheetName || 'main');
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

function syncAllSheets() {
    var sheets = ['', 'done', 'rejected'];
    var results = {};
    var completed = 0;

    showToast('🔄 Sinkronisasi semua data...', 'warning', 5000);

    sheets.forEach(function (sheet) {
        syncFirebaseWithSheet(sheet, true)
            .then(function (result) {
                results[sheet || 'main'] = result;
                completed++;
                if (completed === sheets.length) {
                    var total = 0;
                    sheets.forEach(function (s) {
                        if (results[s || 'main'] && results[s || 'main'].count) {
                            total += results[s || 'main'].count;
                        }
                    });
                    showToast('✅ Sinkronisasi selesai! Total ' + total + ' data', 'success');
                    console.log('✅ All sheets synced:', results);
                    // Refresh halaman
                    var currentPage = sessionStorage.getItem('currentPage') || 'dashboard';
                    if (typeof renderPage === 'function') {
                        renderPage(currentPage);
                    } else {
                        window.location.reload();
                    }
                }
            })
            .catch(function (err) {
                results[sheet || 'main'] = { success: false, error: err.message };
                completed++;
                if (completed === sheets.length) {
                    showToast('⚠️ Sinkronisasi sebagian gagal', 'warning');
                }
            });
    });
}

// ============================================
// 6. TOMBOL SYNC - UI
// ============================================

function addSyncButton() {
    // Cari elemen head-actions
    var headActions = document.querySelector('.head-actions');
    if (!headActions) {
        // Tunggu sebentar
        setTimeout(addSyncButton, 1000);
        return;
    }

    // Cek apakah tombol sudah ada
    if (document.getElementById('syncButton')) return;

    var syncBtn = document.createElement('button');
    syncBtn.id = 'syncButton';
    syncBtn.className = 'btn-secondary';
    syncBtn.style.cssText = 'display:flex;align-items:center;gap:6px;';
    syncBtn.innerHTML = '🔄 Sinkronisasi';
    syncBtn.onclick = function () {
        if (confirm('Sinkronkan semua data dari Google Sheet ke Firebase?')) {
            syncAllSheets();
        }
    };

    headActions.appendChild(syncBtn);
    console.log('✅ Sync button added');
}

// ============================================
// 7. AUTO SYNC - Setiap 5 menit
// ============================================

function startAutoSync(intervalMinutes) {
    if (intervalMinutes === undefined) intervalMinutes = 5;

    setInterval(function () {
        console.log('🔄 Auto-sync triggered...');
        var sheets = ['', 'done', 'rejected'];
        sheets.forEach(function (sheet) {
            syncFirebaseWithSheet(sheet, true)
                .then(function (result) {
                    if (result.success) {
                        console.log('✅ Auto-sync success:', sheet || 'main', result.count, 'records');
                    }
                })
                .catch(function (err) {
                    console.warn('⚠️ Auto-sync failed:', sheet || 'main', err.message);
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
window.loadDataSmart = loadDataSmart;
window.syncFirebaseWithSheet = syncFirebaseWithSheet;
window.syncAllSheets = syncAllSheets;
window.addSyncButton = addSyncButton;
window.startAutoSync = startAutoSync;
window.loadDataFromAPI = loadDataFromAPI;