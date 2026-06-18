/**
 * auth.js - Authentication & Authorization
 * FINAL VERSION - TANPA REDIRECT LOOP
 */

// ===============================
// CONFIGURATION
// ===============================

var AUTH_CONFIG = {
  debug: true,
  sessionTimeout: 8 // hours
};

// ===============================
// UTILITY FUNCTIONS
// ===============================

function debugLog() {
  if (AUTH_CONFIG.debug) {
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[AUTH] ' + new Date().toLocaleTimeString());
    console.log.apply(console, args);
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
  var isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
  debugLog('checkAuth:', isLoggedIn);
  return isLoggedIn;
}

function checkPermission(page) {
  debugLog('=== PERMISSION CHECK ===');
  debugLog('Current page:', page);

  if (!checkAuth()) {
    return false;
  }

  var rawRole = sessionStorage.getItem('userRole') || 'viewer';
  var role = normalizeRole(rawRole);
  debugLog('User role:', role);

  if (typeof PERMISSIONS === 'undefined') {
    console.error('❌ PERMISSIONS tidak defined');
    return true;
  }

  var allowedPages = PERMISSIONS[role] || [];
  var hasAccess = allowedPages.indexOf(page) !== -1;

  if (hasAccess) {
    debugLog('✅ Access granted: ' + role + ' → ' + page);
    return true;
  }

  debugLog('❌ Access denied: ' + role + ' tidak boleh akses ' + page);
  return false;
}

// ===============================
// USER MANAGEMENT
// ===============================

function getCurrentUser() {
  var rawRole = sessionStorage.getItem('userRole') || 'viewer';
  var role = normalizeRole(rawRole);
  var username = sessionStorage.getItem('username') || 'User';
  var fullName = sessionStorage.getItem('fullName') || username;

  var roleName = rawRole;
  if (typeof ROLE_NAMES !== 'undefined' && ROLE_NAMES[role]) {
    roleName = ROLE_NAMES[role];
  }

  return {
    username: username,
    fullName: fullName,
    role: role,
    roleName: roleName,
    initial: username.charAt(0).toUpperCase()
  };
}

function setUserSession(username, fullName, role) {
  debugLog('Setting user session:', { username: username, role: role });
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
  var loginTime = sessionStorage.getItem('loginTime');
  if (!loginTime) return false;
  var elapsed = Date.now() - new Date(loginTime).getTime();
  var maxMs = AUTH_CONFIG.sessionTimeout * 60 * 60 * 1000;
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
  debugLog('Navigating to: ' + page);
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
  var rawRole = sessionStorage.getItem('userRole') || 'viewer';
  var role = normalizeRole(rawRole);
  if (typeof PERMISSIONS === 'undefined') return true;
  var allowedPages = PERMISSIONS[role] || [];
  return allowedPages.indexOf(page) !== -1;
}

// ===============================
// INITIALIZATION - TANPA REDIRECT LOOP
// ===============================

function initAuth() {
  debugLog('=== AUTH INITIALIZATION ===');
  debugLog('Session:', {
    isLoggedIn: sessionStorage.getItem('isLoggedIn'),
    userRole: sessionStorage.getItem('userRole'),
    username: sessionStorage.getItem('username')
  });

  // Session validation
  setInterval(function () {
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
  var tryInit = function (attempt) {
    attempt = attempt || 0;
    if (typeof PERMISSIONS !== 'undefined' || attempt >= 15) {
      setTimeout(initAuth, 200);
    } else {
      setTimeout(function () { tryInit(attempt + 1); }, 100);
    }
  };
  tryInit();
});

window.authDebug = {
  getCurrentPage: getCurrentPage,
  getCurrentUser: getCurrentUser,
  checkPermission: checkPermission,
  hasAccessTo: hasAccessTo,
  getRole: function () {
    return normalizeRole(sessionStorage.getItem('userRole'));
  },
  getAllowedPages: function () {
    var role = normalizeRole(sessionStorage.getItem('userRole'));
    return PERMISSIONS[role] || [];
  }
};