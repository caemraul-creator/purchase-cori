/**
 * auth.js - Authentication & Authorization
 * REFACTORED v2.0:
 * - Fixed permission bypass (no more override by app.js)
 * - Cross-tab session sync via storage event
 * - Session validation on init (not just every 5 minutes)
 * - Proper role normalization
 */

// ===============================
// CONFIGURATION
// ===============================

var AUTH_CONFIG = {
  debug: true,
  sessionTimeout: 8, // hours (sync with APP_CONFIG.auth.sessionTimeoutHours)
  crossTabSync: true
};

// ===============================
// UTILITY FUNCTIONS
// ===============================

function debugLogAuth() {
  if (!AUTH_CONFIG.debug) return;
  var args = Array.prototype.slice.call(arguments);
  args.unshift('[AUTH ' + new Date().toLocaleTimeString() + ']');
  console.log.apply(console, args);
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
  debugLogAuth('checkAuth:', isLoggedIn);

  if (isLoggedIn && !validateSession()) {
    // Session expired
    clearUserSession();
    return false;
  }

  return isLoggedIn;
}

function checkPermission(page) {
  debugLogAuth('=== PERMISSION CHECK ===', 'page:', page);

  if (!checkAuth()) {
    debugLogAuth('❌ Not authenticated');
    return false;
  }

  var rawRole = sessionStorage.getItem('userRole') || 'viewer';
  var role = normalizeRole(rawRole);
  debugLogAuth('User role:', role);

  if (typeof PERMISSIONS === 'undefined') {
    debugLogAuth('⚠️ PERMISSIONS undefined, denying all but dashboard');
    return page === 'dashboard';
  }

  var allowedPages = PERMISSIONS[role] || [];
  var hasAccess = allowedPages.indexOf(page) !== -1;

  if (hasAccess) {
    debugLogAuth('✅ Access granted:', role, '→', page);
    return true;
  }

  debugLogAuth('❌ Access denied:', role, 'tidak boleh akses', page);
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
    initial: (username || 'U').charAt(0).toUpperCase()
  };
}

function setUserSession(username, fullName, role) {
  debugLogAuth('Setting user session:', { username: username, role: role });
  sessionStorage.setItem('username', username);
  sessionStorage.setItem('fullName', fullName);
  sessionStorage.setItem('userRole', role);
  sessionStorage.setItem('isLoggedIn', 'true');
  sessionStorage.setItem('loginTime', new Date().toISOString());
  sessionStorage.setItem('currentPage', 'dashboard');

  // Cross-tab sync: broadcast to other tabs
  if (AUTH_CONFIG.crossTabSync && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('pr_auth_event', JSON.stringify({
        type: 'login',
        username: username,
        role: role,
        timestamp: Date.now()
      }));
    } catch (e) {
      debugLogAuth('LocalStorage sync error:', e);
    }
  }
}

function clearUserSession() {
  debugLogAuth('Clearing user session');
  sessionStorage.clear();

  // Cross-tab sync: tell other tabs to logout
  if (AUTH_CONFIG.crossTabSync && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('pr_auth_event', JSON.stringify({
        type: 'logout',
        timestamp: Date.now()
      }));
    } catch (e) {
      debugLogAuth('LocalStorage sync error:', e);
    }
  }
}

function validateSession() {
  var loginTime = sessionStorage.getItem('loginTime');
  if (!loginTime) return false;

  var elapsed = Date.now() - new Date(loginTime).getTime();
  var maxMs = AUTH_CONFIG.sessionTimeout * 60 * 60 * 1000;

  if (elapsed > maxMs) {
    debugLogAuth('Session expired (elapsed:', Math.round(elapsed / 60000), 'min)');
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
  debugLogAuth('Navigating to:', page);

  // ✅ Check permission BEFORE navigate
  if (!checkPermission(page)) {
    if (typeof showToast === 'function') {
      showToast('⚠️ Anda tidak punya akses ke halaman ini', 'error');
    }
    debugLogAuth('Navigation blocked - no permission for', page);
    return false;
  }

  sessionStorage.setItem('currentPage', page);

  if (typeof renderPage === 'function') {
    renderPage(page);
  } else {
    window.location.reload();
  }

  if (typeof renderUserStatus === 'function') {
    renderUserStatus();
  }

  return true;
}

function hasAccessTo(page) {
  var rawRole = sessionStorage.getItem('userRole') || 'viewer';
  var role = normalizeRole(rawRole);
  if (typeof PERMISSIONS === 'undefined') return page === 'dashboard';
  var allowedPages = PERMISSIONS[role] || [];
  return allowedPages.indexOf(page) !== -1;
}

// ===============================
// CROSS-TAB SESSION SYNC
// ===============================

function setupCrossTabSync() {
  if (!AUTH_CONFIG.crossTabSync || typeof localStorage === 'undefined') return;

  window.addEventListener('storage', function (e) {
    if (e.key !== 'pr_auth_event' || !e.newValue) return;

    try {
      var event = JSON.parse(e.newValue);
      debugLogAuth('Cross-tab event:', event.type);

      if (event.type === 'logout') {
        // Logout di tab lain → logout juga di tab ini
        sessionStorage.clear();
        alert('Sesi telah berakhir (logout dari tab lain).');
        window.location.href = 'login.html';
      } else if (event.type === 'login') {
        // Login di tab lain → reload ke index
        if (window.location.pathname.indexOf('login.html') !== -1) {
          window.location.href = 'index.html';
        }
      }
    } catch (err) {
      debugLogAuth('Cross-tab sync parse error:', err);
    }
  });
}

// ===============================
// INITIALIZATION
// ===============================

function initAuth() {
  debugLogAuth('=== AUTH INITIALIZATION ===');
  debugLogAuth('Session:', {
    isLoggedIn: sessionStorage.getItem('isLoggedIn'),
    userRole: sessionStorage.getItem('userRole'),
    username: sessionStorage.getItem('username'),
    loginTime: sessionStorage.getItem('loginTime')
  });

  // ✅ Validate session immediately (not just every 5 min)
  if (sessionStorage.getItem('isLoggedIn') === 'true' && !validateSession()) {
    debugLogAuth('Session expired on init, clearing...');
    clearUserSession();
    alert('Sesi Anda telah berakhir. Silakan login kembali.');
    window.location.href = 'login.html';
    return;
  }

  // Periodic session validation (every 5 minutes)
  setInterval(function () {
    if (sessionStorage.getItem('isLoggedIn') === 'true' && !validateSession()) {
      alert('Sesi Anda telah berakhir. Silakan login kembali.');
      clearUserSession();
      window.location.href = 'login.html';
    }
  }, 5 * 60 * 1000);

  // Cross-tab sync
  setupCrossTabSync();

  debugLogAuth('Auth initialized');
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
    return (typeof PERMISSIONS !== 'undefined' && PERMISSIONS[role]) || [];
  }
};
