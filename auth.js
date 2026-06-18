/**
 * auth.js - Authentication & Authorization
 * FINAL VERSION - Fixed
 */

// ===============================
// CONFIGURATION
// ===============================

const AUTH_CONFIG = {
  debug: true,
  sessionTimeout: 8 // hours
};

// ===============================
// UTILITY FUNCTIONS
// ===============================

function debugLog(...args) {
  if (AUTH_CONFIG.debug) {
    console.log(`[AUTH] ${new Date().toLocaleTimeString()}`, ...args);
  }
}

function normalizeRole(role) {
  if (!role) return 'viewer';
  return String(role)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function getCurrentPage() {
  return sessionStorage.getItem('currentPage') || 'dashboard';
}

// ===============================
// AUTHENTICATION CORE
// ===============================

function checkAuth() {
  const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
  debugLog('checkAuth:', isLoggedIn);

  if (!isLoggedIn) {
    if (typeof showToast === 'function') {
      showToast('Silakan login terlebih dahulu', 'error');
    }
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 500);
    return false;
  }
  return true;
}

function checkPermission(page) {
  debugLog('=== PERMISSION CHECK ===');
  debugLog('Current page:', page);

  if (!checkAuth()) {
    return false;
  }

  const rawRole = sessionStorage.getItem('userRole') || 'viewer';
  const role = normalizeRole(rawRole);
  debugLog('User role:', role);

  if (typeof PERMISSIONS === 'undefined') {
    console.error('❌ PERMISSIONS tidak defined');
    return true;
  }

  const allowedPages = PERMISSIONS[role] || [];
  const hasAccess = allowedPages.includes(page);

  if (hasAccess) {
    debugLog(`✅ Access granted: ${role} → ${page}`);
    return true;
  }

  debugLog(`❌ Access denied: ${role} tidak boleh akses ${page}`);

  if (allowedPages.length > 0) {
    const defaultPage = allowedPages[0];
    const roleName = ROLE_NAMES && ROLE_NAMES[role] ? ROLE_NAMES[role] : role;

    setTimeout(() => {
      alert(`Maaf, Anda tidak memiliki akses ke halaman ini.\n\nSebagai ${roleName}, Anda hanya dapat mengakses:\n• ${allowedPages.join('\n• ')}`);
      sessionStorage.setItem('currentPage', defaultPage);
      window.location.reload();
    }, 100);
  }

  return false;
}

// ===============================
// USER MANAGEMENT
// ===============================

function getCurrentUser() {
  const rawRole = sessionStorage.getItem('userRole') || 'viewer';
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

function setUserSession(username, fullName, role) {
  debugLog('Setting user session:', { username, role });
  sessionStorage.setItem('username', username);
  sessionStorage.setItem('fullName', fullName);
  sessionStorage.setItem('userRole', role);
  sessionStorage.setItem('isLoggedIn', 'true');
  sessionStorage.setItem('loginTime', new Date().toISOString());
}

function clearUserSession() {
  debugLog('Clearing user session');
  sessionStorage.clear();
}

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
// NAVIGATION & UI
// ===============================

function logout() {
  if (confirm('Keluar dari aplikasi?')) {
    clearUserSession();
    window.location.href = 'login.html';
  }
}

function navigateTo(page) {
  debugLog(`Navigating to: ${page}`);
  sessionStorage.setItem('currentPage', page);

  if (typeof renderPage === 'function') {
    renderPage(page);
  } else {
    window.location.reload();
  }

  if (typeof renderUserStatus === 'function') {
    renderUserStatus();
  }
}

function hasAccessTo(page) {
  const rawRole = sessionStorage.getItem('userRole') || 'viewer';
  const role = normalizeRole(rawRole);
  if (typeof PERMISSIONS === 'undefined') return true;
  const allowedPages = PERMISSIONS[role] || [];
  return allowedPages.includes(page);
}

// ===============================
// INITIALIZATION
// ===============================

function initAuth() {
  debugLog('=== AUTH INITIALIZATION ===');
  debugLog('Session:', {
    isLoggedIn: sessionStorage.getItem('isLoggedIn'),
    userRole: sessionStorage.getItem('userRole'),
    username: sessionStorage.getItem('username')
  });

  const currentPage = sessionStorage.getItem('currentPage') || 'dashboard';
  const isLoginPage = window.location.pathname.includes('login.html');

  if (sessionStorage.getItem('isLoggedIn') !== 'true') {
    if (!isLoginPage) {
      debugLog('User not logged in, redirecting to login');
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 100);
    }
    return;
  }

  if (isLoginPage && sessionStorage.getItem('isLoggedIn') === 'true') {
    window.location.href = 'index.html';
    return;
  }

  // Session validation
  setInterval(() => {
    if (sessionStorage.getItem('isLoggedIn') === 'true' && !validateSession()) {
      alert('Sesi Anda telah berakhir. Silakan login kembali.');
      window.location.href = 'login.html';
    }
  }, 5 * 60 * 1000);

  debugLog('Auth initialized');
}

// Export functions
window.normalizeRole = normalizeRole;
window.checkAuth = checkAuth;
window.checkPermission = checkPermission;
window.getCurrentUser = getCurrentUser;
window.setUserSession = setUserSession;
window.clearUserSession = clearUserSession;
window.logout = logout;
window.navigateTo = navigateTo;
window.hasAccessTo = hasAccessTo;
window.initAuth = initAuth;

// Auto initialize
document.addEventListener('DOMContentLoaded', function () {
  const tryInit = (attempt = 0) => {
    if (typeof PERMISSIONS !== 'undefined' || attempt >= 15) {
      setTimeout(initAuth, 200);
    } else {
      setTimeout(() => tryInit(attempt + 1), 100);
    }
  };
  tryInit();
});

window.authDebug = {
  getCurrentPage,
  getCurrentUser,
  checkPermission,
  hasAccessTo,
  getRole: function () {
    return normalizeRole(sessionStorage.getItem('userRole'));
  },
  getAllowedPages: function () {
    const role = normalizeRole(sessionStorage.getItem('userRole'));
    return PERMISSIONS[role] || [];
  }
};