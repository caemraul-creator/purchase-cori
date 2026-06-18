/**
 * config.js - Configuration file untuk Purchase Request System
 */

// =====================================================
// API CONFIGURATION - PAKAI YANG BARU
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
  version: '1.0.0',
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
    debug: true, // SET TRUE UNTUK DEBUG
    firebase: USE_FIREBASE
  },

  ui: {
    toastDuration: 3000,
    tablePageSize: 25,
    lazyRenderBatchSize: 50,
    debounceDelay: 300,
    mobileBreakpoint: 768
  },

  cache: {
    enabled: true,
    ttl: 5 * 60 * 1000
  }
};

// =====================================================
// VALIDATION
// =====================================================

(function validateConfig() {
  console.log('🔍 Validating config...');
  console.log('API_URL:', API_URL);
  console.log('USE_FIREBASE:', USE_FIREBASE);

  if (USE_FIREBASE) {
    console.log('Firebase Project:', FIREBASE_CONFIG.projectId);
    console.log('Firebase Database:', FIREBASE_CONFIG.databaseURL);
  }

  console.log('✅ Config loaded');
})();