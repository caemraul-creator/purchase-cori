/**
 * config.js - Configuration file untuk Purchase Request System
 * Kompatibel dengan: Cloudflare Pages, Vercel, GitHub Pages, Netlify, dsb
 */

// =====================================================
// API CONFIGURATION
// =====================================================

// Google Apps Script Deployment URL
// PASTIKAN URL INI ADALAH DEPLOYMENT ID TERBARU!
const API_URL = "https://script.google.com/macros/s/AKfycbzk0aq1VZAN96O5UPZRC0HoipmhmHBm9n7KI9mtgzEKULEtz7IXXXsYwKTxR3gSqmWDtA/exec";

// Validasi API_URL saat load
if (!API_URL || !API_URL.includes('script.google.com')) {
  console.error('❌ Invalid API_URL in config.js');
  console.error('Pastikan Apps Script deployment URL benar!');
}

// =====================================================
// ROLE & PERMISSION CONFIGURATION
// =====================================================

/**
 * ROLE NAMES - Display names untuk setiap role
 * Key harus match dengan role di database (lowercase, underscore)
 */
const ROLE_NAMES = {
  admin: 'Administrator Utama',
  viewer: 'Analyst/Viewer',
  staff_a: 'Office Staff A',
  staff_b: 'Reviewer Staff B',
  staff_c: 'Administrator C'
};

/**
 * PERMISSIONS - Halaman mana saja yang boleh diakses setiap role
 */
const PERMISSIONS = {
  admin: [
    'dashboard',
    'request',
    'approval',
    'done',
    'rekap',
    'rejected',
    'print'
  ],
  viewer: [
    'dashboard',
    'request',
    'print'
  ],
  staff_a: [
    'dashboard',
    'request',
    'rekap',
    'rejected',
    'print'
  ],
  staff_b: [
    'dashboard',
    'request',
    'approval',
    'done',
    'rekap',
    'print'
  ],
  staff_c: [
    'dashboard',
    'request',
    'approval',
    'done',
    'rekap',
    'rejected',
    'print'
  ]
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
    } else if (hostname.includes('vercel.app') || hostname.includes('pages.dev') || hostname.includes('netlify.app')) {
      return 'production';
    }
    return 'production';
  })(),

  features: {
    caching: true,
    retryOnError: true,
    debug: false
  },

  ui: {
    toastDuration: 3000,
    tablePageSize: 25,
    lazyRenderBatchSize: 50,
    debounceDelay: 300
  },

  cache: {
    enabled: true,
    ttl: 5 * 60 * 1000
  }
};

// =====================================================
// DEBUG UTILITIES
// =====================================================

const Logger = {
  log: function (msg, data) {
    if (APP_CONFIG.features.debug) {
      console.log(`[${new Date().toLocaleTimeString()}] ${msg}`, data || '');
    }
  },
  warn: function (msg, data) {
    console.warn(`[${new Date().toLocaleTimeString()}] ⚠️ ${msg}`, data || '');
  },
  error: function (msg, data) {
    console.error(`[${new Date().toLocaleTimeString()}] ❌ ${msg}`, data || '');
  },
  info: function (msg, data) {
    console.info(`[${new Date().toLocaleTimeString()}] ℹ️ ${msg}`, data || '');
  }
};

// =====================================================
// VALIDATION
// =====================================================

(function validateConfig() {
  const errors = [];
  if (!API_URL) errors.push('API_URL tidak defined');
  if (!ROLE_NAMES || Object.keys(ROLE_NAMES).length === 0) errors.push('ROLE_NAMES kosong');
  if (!PERMISSIONS || Object.keys(PERMISSIONS).length === 0) errors.push('PERMISSIONS kosong');

  if (errors.length > 0) {
    console.error('❌ CONFIG VALIDATION FAILED:');
    errors.forEach(e => console.error(`  - ${e}`));
  } else {
    console.log('✅ Config loaded successfully');
    console.log(`Environment: ${APP_CONFIG.environment}`);
    console.log(`API URL: ${API_URL.split('?')[0]}`);
  }
})();