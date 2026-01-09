/**
 * auth.js - Authentication & Authorization
 * Cloudflare Pages Compatible Version
 * FINAL FIX - Mengatasi routing issue di Cloudflare Pages
 */

// ===============================
// CONFIGURATION
// ===============================

const AUTH_CONFIG = {
  debug: true, // Set false untuk production
  useHashRouter: false, // Set true jika masalah persist
  sessionTimeout: 8 // hours
};

// ===============================
// UTILITY FUNCTIONS
// ===============================

/**
 * Debug logging helper
 */
function debugLog(...args) {
  if (AUTH_CONFIG.debug) {
    console.log(`[AUTH] ${new Date().toLocaleTimeString()}`, ...args);
  }
}

/**
 * Normalize role dari berbagai format ke format standard
 */
function normalizeRole(role) {
  if (!role) return 'viewer';
  
  return String(role)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Get current page name - COMPATIBILITY FIX untuk Cloudflare Pages
 * Menangani semua skenario:
 * - Cloudflare: /approval → approval.html
 * - Local: approval.html → approval.html
 * - Hash: /#approval → approval.html
 */
function getCurrentPage() {
  let page = window.location.pathname;
  const hash = window.location.hash;
  
  debugLog('📍 Raw pathname:', page);
  debugLog('📍 Hash:', hash);
  
  // Handle hash-based routing (fallback)
  if (AUTH_CONFIG.useHashRouter && hash && hash.length > 1) {
    page = hash.replace(/^#\//, '').replace(/^#/, '');
    debugLog('📍 Using hash routing:', page);
  }
  
  // Handle empty path or root
  if (!page || page === '/' || page === '/index.html' || page === 'index.html') {
    return 'index.html';
  }
  
  // Remove leading slash
  page = page.replace(/^\//, '');
  
  // Check if it's a directory path (Cloudflare Pages style)
  if (!page.includes('.')) {
    // Ini kemungkinan path Cloudflare Pages tanpa extension
    page += '.html';
  }
  
  // Ensure .html extension exists
  if (!page.endsWith('.html')) {
    // Check if it has other extension
    if (!page.includes('.')) {
      page += '.html';
    }
  }
  
  // Remove query string dan hash
  page = page.split('?')[0].split('#')[0];
  
  debugLog('📍 Final page:', page);
  return page;
}

// ===============================
// AUTHENTICATION CORE
// ===============================

/**
 * Check apakah user sudah login
 */
function checkAuth() {
  const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
  
  if (!isLoggedIn) {
    debugLog('❌ Akses ditolak: User belum login');
    
    // Hindari infinite redirect
    const currentPage = getCurrentPage();
    if (!currentPage.includes('login')) {
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 100);
    }
    return false;
  }
  
  return true;
}

/**
 * Check permission untuk halaman saat ini
 */
function checkPermission() {
  debugLog('=== PERMISSION CHECK STARTED ===');
  
  // 1. Get current page
  const page = getCurrentPage();
  debugLog('Current page:', page);
  
  // 2. Skip untuk login page
  if (page.includes('login')) {
    debugLog('✅ Login page, skipping permission check');
    return true;
  }
  
  // 3. Check authentication
  if (!checkAuth()) {
    return false;
  }
  
  // 4. Get user role
  const rawRole = sessionStorage.getItem('userRole');
  const role = normalizeRole(rawRole);
  debugLog('User role:', role, '(raw:', rawRole + ')');
  
  // 5. Validate PERMISSIONS exists
  if (typeof PERMISSIONS === 'undefined') {
    console.error('❌ PERMISSIONS tidak defined');
    
    // Fallback: allow access if logged in
    if (sessionStorage.getItem('isLoggedIn') === 'true') {
      debugLog('⚠️ PERMISSIONS undefined, but user is logged in. Allowing access.');
      return true;
    }
    
    window.location.href = 'login.html';
    return false;
  }
  
  // 6. Check if role exists in PERMISSIONS
  if (!PERMISSIONS[role]) {
    console.error(`❌ Role "${role}" tidak ditemukan di PERMISSIONS`);
    
    // Fallback to viewer
    const fallbackRole = 'viewer';
    debugLog(`⚠️ Falling back to role: ${fallbackRole}`);
    
    if (PERMISSIONS[fallbackRole]) {
      // Check with fallback role
      return checkPageAccess(page, fallbackRole);
    } else {
      // Last resort: redirect to index if logged in
      if (sessionStorage.getItem('isLoggedIn') === 'true') {
        window.location.href = 'index.html';
        return false;
      }
    }
  }
  
  // 7. Check page access
  return checkPageAccess(page, role);
}

/**
 * Helper untuk check page access
 */
function checkPageAccess(page, role) {
  const allowedPages = PERMISSIONS[role] || [];
  
  debugLog(`Allowed pages for ${role}:`, allowedPages);
  debugLog(`Checking access to: ${page}`);
  
  // Check exact match
  if (allowedPages.includes(page)) {
    debugLog(`✅ Access granted: ${role} → ${page}`);
    return true;
  }
  
  // Check without .html extension (for Cloudflare Pages)
  const pageWithoutExt = page.replace('.html', '');
  if (allowedPages.includes(pageWithoutExt)) {
    debugLog(`✅ Access granted (without extension): ${role} → ${pageWithoutExt}`);
    return true;
  }
  
  // Check with .html if not present
  if (!page.endsWith('.html') && allowedPages.includes(page + '.html')) {
    debugLog(`✅ Access granted (with extension): ${role} → ${page + '.html'}`);
    return true;
  }
  
  // Access denied
  debugLog(`❌ Access denied: ${role} tidak boleh akses ${page}`);
  debugLog(`   Allowed: ${allowedPages.join(', ')}`);
  
  // Redirect to first allowed page or index
  const defaultPage = allowedPages.length > 0 ? allowedPages[0] : 'index.html';
  
  // Avoid infinite redirect
  if (page !== defaultPage && !page.includes('login')) {
    setTimeout(() => {
      debugLog(`Redirecting to: ${defaultPage}`);
      window.location.href = defaultPage;
    }, 100);
  }
  
  return false;
}

// ===============================
// USER MANAGEMENT
// ===============================

/**
 * Get informasi user yang sedang login
 */
function getCurrentUser() {
  const rawRole = sessionStorage.getItem('userRole');
  const role = normalizeRole(rawRole);
  const username = sessionStorage.getItem('username') || 'User';
  const fullName = sessionStorage.getItem('fullName') || username;

  let roleName = rawRole;
  if (typeof ROLE_NAMES !== 'undefined' && ROLE_NAMES[role]) {
    roleName = ROLE_NAMES[role];
  }

  return {
    username,
    fullName,
    role,
    roleName,
    initial: username.charAt(0).toUpperCase()
  };
}

/**
 * Store user session
 */
function setUserSession(username, fullName, role) {
  debugLog('Setting user session:', { username, role });
  
  sessionStorage.setItem('username', username);
  sessionStorage.setItem('fullName', fullName);
  sessionStorage.setItem('userRole', role);
  sessionStorage.setItem('isLoggedIn', 'true');
  sessionStorage.setItem('loginTime', new Date().toISOString());
  
  // Trigger storage event for cross-tab sync
  window.dispatchEvent(new Event('storage'));
}

/**
 * Clear user session
 */
function clearUserSession() {
  debugLog('Clearing user session');
  
  sessionStorage.removeItem('username');
  sessionStorage.removeItem('fullName');
  sessionStorage.removeItem('userRole');
  sessionStorage.removeItem('isLoggedIn');
  sessionStorage.removeItem('loginTime');
  
  window.dispatchEvent(new Event('storage'));
}

/**
 * Check session validity
 */
function validateSession() {
  const loginTime = sessionStorage.getItem('loginTime');
  if (!loginTime) return false;

  const elapsed = Date.now() - new Date(loginTime).getTime();
  const maxMs = AUTH_CONFIG.sessionTimeout * 60 * 60 * 1000;

  if (elapsed > maxMs) {
    debugLog('Session expired');
    clearUserSession();
    return false;
  }

  return true;
}

// ===============================
// NAVIGATION & UI HELPERS
// ===============================

/**
 * Logout user
 */
function logout() {
  if (confirm('Keluar dari aplikasi?')) {
    clearUserSession();
    window.location.href = 'login.html';
  }
}

/**
 * Navigasi yang aman untuk Cloudflare Pages
 */
function navigateTo(page) {
  let targetPage = page;
  
  // Ensure .html extension
  if (!targetPage.includes('.') || targetPage.endsWith('/')) {
    targetPage = targetPage.replace(/\/$/, '') + '.html';
  } else if (!targetPage.endsWith('.html')) {
    targetPage += '.html';
  }
  
  debugLog(`Navigating to: ${targetPage}`);
  
  // Check permission before navigating
  if (typeof PERMISSIONS !== 'undefined') {
    const rawRole = sessionStorage.getItem('userRole');
    const role = normalizeRole(rawRole);
    const allowedPages = PERMISSIONS[role] || [];
    
    // Check multiple formats
    const pageWithoutExt = targetPage.replace('.html', '');
    const hasAccess = allowedPages.includes(targetPage) || 
                     allowedPages.includes(pageWithoutExt);
    
    if (!hasAccess) {
      debugLog(`❌ No permission to navigate to: ${targetPage}`);
      alert('Anda tidak memiliki akses ke halaman ini.');
      return false;
    }
  }
  
  window.location.href = targetPage;
  return true;
}

/**
 * Check if user has access to a page (for UI)
 */
function hasAccessTo(page) {
  const rawRole = sessionStorage.getItem('userRole');
  const role = normalizeRole(rawRole);
  
  if (typeof PERMISSIONS === 'undefined') return false;
  
  const allowedPages = PERMISSIONS[role] || [];
  const pageWithExt = page.includes('.') ? page : page + '.html';
  const pageWithoutExt = page.replace('.html', '');
  
  return allowedPages.includes(pageWithExt) || 
         allowedPages.includes(pageWithoutExt);
}

// ===============================
// CLOUDFLARE PAGES FIXES
// ===============================

/**
 * Fix semua link untuk Cloudflare Pages compatibility
 */
function fixLinksForCloudflare() {
  const links = document.querySelectorAll('a[href]:not([href*="://"]):not([href^="mailto:"]):not([href^="tel:"])');
  
  links.forEach(link => {
    const href = link.getAttribute('href');
    
    // Skip jika sudah ada extension atau special cases
    if (!href || 
        href === '#' || 
        href.startsWith('#') ||
        href.includes('.html') ||
        href.includes('.css') ||
        href.includes('.js') ||
        href.includes('.png') ||
        href.includes('.jpg') ||
        href.includes('.jpeg') ||
        href.includes('.gif') ||
        href.includes('.ico') ||
        href.includes('.svg')) {
      return;
    }
    
    // Tambahkan .html untuk internal links
    const newHref = href + '.html';
    link.setAttribute('href', newHref);
    debugLog(`Fixed link: ${href} → ${newHref}`);
  });
}

/**
 * Initialize hash-based routing jika diperlukan
 */
function initHashRouter() {
  if (!AUTH_CONFIG.useHashRouter) return;
  
  window.addEventListener('hashchange', function() {
    const hash = window.location.hash;
    if (hash && hash.length > 1) {
      const page = hash.replace(/^#\//, '').replace(/^#/, '') + '.html';
      debugLog('Hash changed, checking permission for:', page);
      checkPermission();
    }
  });
}

// ===============================
// INITIALIZATION
// ===============================

/**
 * Initialize authentication system
 */
function initAuth() {
  debugLog('=== AUTH INITIALIZATION ===');
  debugLog('Location:', window.location.href);
  debugLog('Pathname:', window.location.pathname);
  debugLog('Session:', {
    isLoggedIn: sessionStorage.getItem('isLoggedIn'),
    userRole: sessionStorage.getItem('userRole'),
    username: sessionStorage.getItem('username')
  });
  
  // Check permission on page load
  const currentPage = getCurrentPage();
  const isLoginPage = currentPage.includes('login');
  
  if (!isLoginPage) {
    debugLog('Non-login page, checking permission...');
    setTimeout(() => {
      checkPermission();
    }, 50);
  } else {
    debugLog('Login page, auth check skipped');
  }
  
  // Apply Cloudflare Pages fixes
  setTimeout(fixLinksForCloudflare, 100);
  
  // Initialize hash router jika diperlukan
  initHashRouter();
  
  // Session validation interval
  setInterval(() => {
    if (sessionStorage.getItem('isLoggedIn') === 'true' && !validateSession()) {
      alert('Sesi Anda telah berakhir. Silakan login kembali.');
      window.location.href = 'login.html';
    }
  }, 5 * 60 * 1000); // 5 minutes
  
  debugLog('Auth initialization complete');
}

// ===============================
// AUTO-INITIALIZE
// ===============================

// Tunggu DOM siap dan config.js dimuat
let initAttempts = 0;
const maxInitAttempts = 10;

function tryInit() {
  if (typeof PERMISSIONS !== 'undefined' || initAttempts >= maxInitAttempts) {
    initAuth();
  } else {
    initAttempts++;
    setTimeout(tryInit, 100);
  }
}

// Start initialization ketika DOM siap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', tryInit);
} else {
  tryInit();
}

// Export untuk penggunaan di module lain (jika diperlukan)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    checkAuth,
    checkPermission,
    getCurrentUser,
    logout,
    setUserSession,
    clearUserSession,
    navigateTo,
    hasAccessTo,
    normalizeRole
  };
}
