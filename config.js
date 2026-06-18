/**
 * config.js - Configuration file untuk Purchase Request System
 * REFACTORED: Added debug wrapper, safer defaults
 */

// =====================================================
// API CONFIGURATION
// =====================================================

const API_URL = "https://script.google.com/macros/s/AKfycbw3lWUjVJTMwN6rToovwtcUx0OXaeWlRtR7RRjPBJfV2Ay5_xXzUyP449FI-7-MCUfx9w/exec";

// =====================================================
// FIREBASE CONFIGURATION
// =====================================================

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBY6B_AMQjeWCfzQiVPtQCLTlTz3ShInwo",
  authDomain: "purchase-request-system-47767.firebaseapp.com",
  databaseURL: "https://purchase-request-system-47767-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "purchase-request-system-47767",
  storageBucket: "purchase-request-system-47767.firebasestorage.app",
  messagingSenderId: "197480550971",
  appId: "1:197480550971:web:bae4bcfc99e6dddbb3c21e"
};

// ✅ AKTIFKAN FIREBASE
const USE_FIREBASE = true;

// =====================================================
// ROLE & PERMISSION
// =====================================================

const ROLE_NAMES = {
  admin: 'Administrator Utama',
  viewer: 'Analyst/Viewer',
  staff_a: 'Office Staff A',
  staff_b: 'Reviewer Staff B',
  staff_c: 'Administrator C'
};

const PERMISSIONS = {
  admin: ['dashboard', 'request', 'approval', 'done', 'rekap', 'rejected', 'print'],
  viewer: ['dashboard', 'request', 'print'],
  staff_a: ['dashboard', 'request', 'rekap', 'rejected', 'print'],
  staff_b: ['dashboard', 'request', 'approval', 'done', 'rekap', 'print'],
  staff_c: ['dashboard', 'request', 'approval', 'done', 'rekap', 'rejected', 'print']
};

// =====================================================
// APP CONFIG
// =====================================================

const APP_CONFIG = {
  name: 'Purchase Request System',
  version: '2.0.0',
  environment: (function () {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'development';
    }
    return 'production';
  })(),

  features: {
    caching: true,
    retryOnError: true,
    // ⚠️ Set FALSE di production untuk kurangi console noise
    debug: APP_DEBUG(),
    firebase: USE_FIREBASE,
    // Auto-refresh table data (ms). 0 = disabled.
    autoRefreshInterval: 0,
    // Auto-sync Firebase (ms). 0 = disabled.
    autoSyncInterval: 5 * 60 * 1000,
  },

  ui: {
    toastDuration: 3000,
    tablePageSize: 100,
    lazyRenderBatchSize: 50,
    debounceDelay: 300,
    mobileBreakpoint: 768
  },

  cache: {
    enabled: true,
    ttl: 5 * 60 * 1000
  },

  auth: {
    sessionTimeoutHours: 8,
    // Cross-tab sync: logout di 1 tab akan logout semua tab
    crossTabSync: true
  }
};

function APP_DEBUG() {
  try {
    // Pakai localStorage supaya bisa di-toggle tanpa edit kode
    // Buka console: localStorage.setItem('debug', 'true')
    var stored = localStorage.getItem('pr_debug');
    if (stored !== null) return stored === 'true';
    return APP_CONFIG_ENVIRONMENT_DETECTION();
  } catch (e) {
    return false;
  }
}

function APP_CONFIG_ENVIRONMENT_DETECTION() {
  var hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

// =====================================================
// DEBUG LOGGER - Wrapper untuk console.log
// =====================================================

window.debugLog = function () {
  if (!APP_CONFIG.features.debug) return;
  var args = Array.prototype.slice.call(arguments);
  var prefix = '[PR ' + new Date().toLocaleTimeString() + ']';
  args.unshift(prefix);
  console.log.apply(console, args);
};

window.debugWarn = function () {
  if (!APP_CONFIG.features.debug) return;
  var args = Array.prototype.slice.call(arguments);
  args.unshift('[PR WARN]');
  console.warn.apply(console, args);
};

window.debugError = function () {
  // Error selalu di-log
  var args = Array.prototype.slice.call(arguments);
  args.unshift('[PR ERROR]');
  console.error.apply(console, args);
};

// =====================================================
// VALIDATION
// =====================================================

(function validateConfig() {
  debugLog('🔍 Validating config...');
  debugLog('API_URL:', API_URL);
  debugLog('USE_FIREBASE:', USE_FIREBASE);
  debugLog('Environment:', APP_CONFIG.environment);
  debugLog('Debug mode:', APP_CONFIG.features.debug);

  if (USE_FIREBASE) {
    debugLog('Firebase Project:', FIREBASE_CONFIG.projectId);
    debugLog('Firebase Database:', FIREBASE_CONFIG.databaseURL);
  }

  debugLog('✅ Config loaded');
})();
