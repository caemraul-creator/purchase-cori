/**
 * config.js - Configuration file untuk Purchase Request System
 * Kompatibel dengan: Cloudflare Pages, Vercel, GitHub Pages, Netlify, dsb
 */

// =====================================================
// API CONFIGURATION
// =====================================================

// Google Apps Script Deployment URL
// PASTIKAN URL INI ADALAH DEPLOYMENT ID TERBARU!
const API_URL = "https://script.google.com/macros/s/AKfycbyGToDbI6GpI6jkq8r7Y-mBdxpnpKRRDZrN3xRk7Tf_HR26QwlvjIeCj_9IvUm1E93Sbw/exec";

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
 * Ini harus match dengan struktur di auth.js
 */
const PERMISSIONS = {
  admin: [
    'dashboard.html',
    'index.html',
    'approval.html',
    'done.html',
    'rekap.html',
    'rejected.html',
    'print.html'
  ],
  viewer: [
    'dashboard.html',
    'index.html',
    'print.html'
  ],
  staff_a: [
    'dashboard.html',
    'index.html',
    'rekap.html',
    'rejected.html',
    'print.html'
  ],
  staff_b: [
    'dashboard.html',
    'index.html',
    'approval.html',
    'done.html',
    'rekap.html',
    'print.html'
  ],
  staff_c: [
    'dashboard.html',
    'index.html',
    'approval.html',
    'done.html',
    'rekap.html',
    'rejected.html',
    'print.html'
  ]
};

// =====================================================
// APPLICATION CONFIGURATION
// =====================================================

/**
 * APP_CONFIG - Konfigurasi umum aplikasi
 */
const APP_CONFIG = {
  name: 'Purchase Request System',
  version: '1.0.0',
  environment: (function() {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'development';
    } else if (hostname.includes('vercel.app') || hostname.includes('pages.dev') || hostname.includes('netlify.app')) {
      return 'production';
    }
    return 'production';
  })(),
  
  // Features
  features: {
    caching: true,
    retryOnError: true,
    debug: false // Set ke true untuk verbose logging
  },

  // UI
  ui: {
    toastDuration: 3000,
    tablePageSize: 25,
    lazyRenderBatchSize: 50,
    debounceDelay: 300
  },

  // Cache
  cache: {
    enabled: true,
    ttl: 5 * 60 * 1000 // 5 menit
  }
};

// =====================================================
// DEBUG UTILITIES
// =====================================================

/**
 * Safe console logging untuk debug mode
 */
const Logger = {
  log: function(msg, data) {
    if (APP_CONFIG.features.debug) {
      console.log(`[${new Date().toLocaleTimeString()}] ${msg}`, data || '');
    }
  },
  
  warn: function(msg, data) {
    console.warn(`[${new Date().toLocaleTimeString()}] ⚠️  ${msg}`, data || '');
  },
  
  error: function(msg, data) {
    console.error(`[${new Date().toLocaleTimeString()}] ❌ ${msg}`, data || '');
  },
  
  info: function(msg, data) {
    console.info(`[${new Date().toLocaleTimeString()}] ℹ️  ${msg}`, data || '');
  }
};

// =====================================================
// VALIDATION
// =====================================================

// Cek config di console saat load
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