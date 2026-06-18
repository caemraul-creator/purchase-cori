/**
 * config.js - Configuration file untuk Purchase Request System
 * Kompatibel dengan: Cloudflare Pages, Vercel, GitHub Pages, Netlify, dsb
 */

// =====================================================
// API CONFIGURATION
// =====================================================

// Google Apps Script Deployment URL - PAKAI YANG BARU
const API_URL = "https://script.google.com/macros/s/AKfycbw3lWUjVJTMwN6rToovwtcUx0OXaeWlRtR7RRjPBJfV2Ay5_xXzUyP449FI-7-MCUfx9w/exec";

// =====================================================
// FIREBASE CONFIGURATION - PAKAI CONFIG ANDA
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

// Apakah menggunakan Firebase? SET TRUE
const USE_FIREBASE = true;

// =====================================================
// ROLE & PERMISSION CONFIGURATION
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
// APPLICATION CONFIGURATION
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
    debug: false,
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
    ttl: 5 * 60 * 1000 // 5 menit
  }
};

// =====================================================
// VALIDATION
// =====================================================

(function validateConfig() {
  const errors = [];

  // Cek API_URL
  if (!API_URL) {
    errors.push('API_URL tidak defined');
  } else if (!API_URL.includes('script.google.com')) {
    errors.push('API_URL sepertinya bukan URL Google Apps Script yang valid');
  }

  // Cek ROLE_NAMES
  if (!ROLE_NAMES || Object.keys(ROLE_NAMES).length === 0) {
    errors.push('ROLE_NAMES kosong');
  }

  // Cek PERMISSIONS
  if (!PERMISSIONS || Object.keys(PERMISSIONS).length === 0) {
    errors.push('PERMISSIONS kosong');
  }

  // Cek Firebase jika aktif
  if (USE_FIREBASE) {
    const required = ['apiKey', 'authDomain', 'projectId', 'databaseURL'];
    required.forEach(function (key) {
      if (!FIREBASE_CONFIG[key] || FIREBASE_CONFIG[key] === 'YOUR_' + key.toUpperCase()) {
        errors.push('Firebase ' + key + ' belum diisi');
      }
    });

    // Cek apakah apiKey valid (tidak mengandung placeholder)
    if (FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey.includes('YOUR_')) {
      errors.push('Firebase apiKey masih placeholder, ganti dengan config asli!');
    }
  }

  if (errors.length > 0) {
    console.error('❌ CONFIG VALIDATION FAILED:');
    errors.forEach(function (e) { console.error('  - ' + e); });
  } else {
    console.log('✅ Config loaded successfully');
    console.log('  Environment: ' + APP_CONFIG.environment);
    console.log('  API URL: ' + API_URL.split('?')[0]);
    console.log('  Firebase: ' + (USE_FIREBASE ? '✅ Active' : '❌ Disabled'));
    if (USE_FIREBASE) {
      console.log('  Firebase Project: ' + FIREBASE_CONFIG.projectId);
    }
  }
})();