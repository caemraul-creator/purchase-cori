/**
 * firebase-helper.js - Firebase Integration for Faster Loading
 */

// ============================================
// 1. FIREBASE INITIALIZATION
// ============================================

let firebaseApp = null;
let firebaseDb = null;
let firebaseInitialized = false;

function initFirebase() {
    if (!USE_FIREBASE) {
        console.log('ℹ️ Firebase disabled');
        return false;
    }

    try {
        // Cek apakah Firebase SDK sudah loaded
        if (typeof firebase === 'undefined') {
            console.warn('⚠️ Firebase SDK not loaded, loading from CDN...');
            return false;
        }

        // Inisialisasi Firebase
        if (!firebase.apps.length) {
            firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
            firebaseDb = firebase.database();
            firebaseInitialized = true;
            console.log('✅ Firebase initialized successfully');
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
// 2. FIREBASE CACHE FUNCTIONS
// ============================================

function saveToFirebase(path, data) {
    if (!firebaseInitialized || !USE_FIREBASE) return Promise.resolve(false);

    return new Promise((resolve, reject) => {
        try {
            const ref = firebaseDb.ref(path);
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

    return new Promise((resolve, reject) => {
        try {
            const ref = firebaseDb.ref(path);
            ref.once('value', function (snapshot) {
                const data = snapshot.val();
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

    return new Promise((resolve, reject) => {
        try {
            const ref = firebaseDb.ref(path);
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
// 3. SMART LOAD - Firebase + API Fallback
// ============================================

function loadDataSmart(callback, sheetName, forceRefresh) {
    if (forceRefresh === undefined) forceRefresh = false;
    if (sheetName === undefined) sheetName = '';

    const cacheKey = sheetName || 'main';
    const firebasePath = 'purchase_data/' + cacheKey;

    // Jika force refresh, skip cache
    if (forceRefresh) {
        console.log('🔄 Force refresh, skipping cache');
        return loadFromAPI(callback, sheetName);
    }

    // 1. Cek localStorage dulu (cepat)
    const localData = getCachedData(cacheKey);
    if (localData) {
        console.log('📦 Data from localStorage:', cacheKey);
        if (callback) setTimeout(function () { callback(localData); }, 0);
        return;
    }

    // 2. Cek Firebase (lebih cepat dari API)
    if (USE_FIREBASE && firebaseInitialized) {
        loadFromFirebase(firebasePath)
            .then(function (data) {
                if (data) {
                    console.log('☁️ Data from Firebase:', cacheKey);
                    setCachedData(cacheKey, data);
                    if (callback) callback(data);
                    return;
                }
                // Firebase kosong, ambil dari API
                loadFromAPI(callback, sheetName);
            })
            .catch(function () {
                // Firebase error, fallback ke API
                loadFromAPI(callback, sheetName);
            });
    } else {
        // Firebase tidak aktif, langsung dari API
        loadFromAPI(callback, sheetName);
    }
}

function loadFromAPI(callback, sheetName) {
    console.log('🌐 Loading from API:', sheetName || 'main');

    loadDataOptimized(function (data) {
        // Simpan ke Firebase dan localStorage
        if (USE_FIREBASE && firebaseInitialized && data) {
            const cacheKey = sheetName || 'main';
            const firebasePath = 'purchase_data/' + cacheKey;
            saveToFirebase(firebasePath, data);
        }

        if (callback) callback(data);
    }, sheetName);
}

// ============================================
// 4. BATCH LOAD - Multiple Sheets dengan Firebase
// ============================================

function loadMultipleSheetsSmart(sheets, onAllLoaded, forceRefresh) {
    if (forceRefresh === undefined) forceRefresh = false;

    const results = {};
    let loadedCount = 0;
    const totalSheets = sheets.length;

    if (totalSheets === 0) {
        if (onAllLoaded) onAllLoaded(results);
        return;
    }

    sheets.forEach(function (sheet) {
        loadDataSmart(function (data) {
            results[sheet] = data;
            loadedCount++;
            if (loadedCount === totalSheets && onAllLoaded) {
                try { onAllLoaded(results); } catch (err) { console.error('Error in callback:', err); }
            }
        }, sheet, forceRefresh);
    });
}

// ============================================
// 5. PRELOAD - Muat data di background
// ============================================

function preloadData(sheets) {
    if (!sheets) sheets = ['', 'done', 'rejected'];

    console.log('🔄 Preloading data...');
    sheets.forEach(function (sheet) {
        loadDataSmart(function () {
            console.log('✅ Preloaded:', sheet || 'main');
        }, sheet, false);
    });
}

// ============================================
// 6. EXPORT FUNCTIONS
// ============================================

window.initFirebase = initFirebase;
window.saveToFirebase = saveToFirebase;
window.loadFromFirebase = loadFromFirebase;
window.removeFromFirebase = removeFromFirebase;
window.loadDataSmart = loadDataSmart;
window.loadMultipleSheetsSmart = loadMultipleSheetsSmart;
window.preloadData = preloadData;