/**
 * auth.js - Authentication & Authorization
 * FINAL VERSION - Fixed untuk Cloudflare Pages
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
  let page = window.location.pathname;
  
  debugLog('Raw pathname:', page);
  
  // Handle root path
  if (!page || page === '/' || page === '/index.html') {
    return 'index.html';
  }
  
  // Remove leading slash
  page = page.replace(/^\//, '');
  
  // Handle Cloudflare Pages style (without .html)
  if (!page.includes('.')) {
    page += '.html';
  }
  
  // Remove query parameters
  page = page.split('?')[0].split('#')[0];
  
  // Ensure .html extension
  if (!page.endsWith('.html') && !page.includes('.')) {
    page += '.html';
  }
  
  debugLog('Final page:', page);
  return page;
}

// ===============================
// AUTHENTICATION CORE
// ===============================

function checkAuth() {
  const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
  
  if (!isLoggedIn) {
    const currentPage = getCurrentPage();
    if (!currentPage.includes('login')) {
      debugLog('Redirecting to login');
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 100);
    }
    return false;
  }
  
  return true;
}

function checkPermission() {
  debugLog('=== PERMISSION CHECK ===');
  
  const page = getCurrentPage();
  debugLog('Current page:', page);
  
  // Skip for login page
  if (page.includes('login')) {
    return true;
  }
  
  // Check if user is logged in
  if (!checkAuth()) {
    return false;
  }
  
  // Get user role
  const rawRole = sessionStorage.getItem('userRole');
  const role = normalizeRole(rawRole);
  debugLog('User role:', role, '(raw:', rawRole + ')');
  
  // Check if PERMISSIONS is defined
  if (typeof PERMISSIONS === 'undefined') {
    console.error('❌ PERMISSIONS tidak defined');
    // As a fallback, allow access if logged in
    return sessionStorage.getItem('isLoggedIn') === 'true';
  }
  
  // Get allowed pages for role
  const allowedPages = PERMISSIONS[role] || [];
  
  // Check access with multiple formats
  const pageWithoutExt = page.replace('.html', '');
  const hasAccess = allowedPages.includes(page) || 
                    allowedPages.includes(pageWithoutExt);
  
  if (hasAccess) {
    debugLog(`✅ Access granted: ${role} → ${page}`);
    return true;
  }
  
  // ACCESS DENIED - Handle properly
  debugLog(`❌ Access denied: ${role} tidak boleh akses ${page}`);
  debugLog(`Allowed pages: ${allowedPages.join(', ')}`);
  
  // Show user-friendly message
  const roleName = ROLE_NAMES && ROLE_NAMES[role] ? ROLE_NAMES[role] : role;
  
  setTimeout(() => {
    // Only redirect if not already on an allowed page
    const currentPage = getCurrentPage();
    const currentPageWithoutExt = currentPage.replace('.html', '');
    
    // Check if current page is already allowed
    const isCurrentPageAllowed = allowedPages.includes(currentPage) || 
                                allowedPages.includes(currentPageWithoutExt);
    
    if (!isCurrentPageAllowed && allowedPages.length > 0) {
      // Get default page (first in allowed pages)
      let defaultPage = allowedPages[0];
      
      // Ensure default page has .html extension
      if (!defaultPage.includes('.')) {
        defaultPage += '.html';
      } else if (!defaultPage.endsWith('.html')) {
        defaultPage = defaultPage.split('.')[0] + '.html';
      }
      
      // Prevent redirect loop - check if we're already on default page
      const current = getCurrentPage();
      if (current !== defaultPage && current !== defaultPage.replace('.html', '')) {
        alert(`Maaf, Anda tidak memiliki akses ke halaman ini.\n\nSebagai ${roleName}, Anda hanya dapat mengakses:\n• ${allowedPages.map(p => p.replace('.html', '')).join('\n• ')}`);
        
        debugLog(`Redirecting to default page: ${defaultPage}`);
        window.location.href = defaultPage;
      }
    }
  }, 100);
  
  return false;
}

// ===============================
// USER MANAGEMENT
// ===============================

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
  let targetPage = page;
  
  // Ensure .html extension
  if (!targetPage.includes('.')) {
    targetPage += '.html';
  }
  
  debugLog(`Navigating to: ${targetPage}`);
  window.location.href = targetPage;
}

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
// CLOUDFLARE PAGES FIX
// ===============================

function fixLinksForCloudflare() {
  const links = document.querySelectorAll('a[href]:not([href*="://"]):not([href^="#"]):not([href^="mailto:"]):not([href^="tel:"])');
  
  links.forEach(link => {
    const href = link.getAttribute('href');
    
    // Skip if already has extension or is empty
    if (!href || 
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
    
    // Add .html to internal links
    const newHref = href + '.html';
    link.setAttribute('href', newHref);
    debugLog(`Fixed link: ${href} → ${newHref}`);
  });
}

// ===============================
// INITIALIZATION
// ===============================

function initAuth() {
  debugLog('=== AUTH INITIALIZATION ===');
  debugLog('URL:', window.location.href);
  debugLog('Pathname:', window.location.pathname);
  debugLog('Session:', {
    isLoggedIn: sessionStorage.getItem('isLoggedIn'),
    userRole: sessionStorage.getItem('userRole'),
    username: sessionStorage.getItem('username')
  });
  
  // Get current page
  const currentPage = getCurrentPage();
  const isLoginPage = currentPage.includes('login');
  
  // Fix links for Cloudflare Pages
  setTimeout(fixLinksForCloudflare, 100);
  
  // If not login page, check permission
  if (!isLoginPage) {
    // Check if user is logged in first
    const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
    
    if (!isLoggedIn) {
      debugLog('User not logged in, redirecting to login');
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 100);
      return;
    }
    
    // Check permission with delay to ensure DOM is ready
    setTimeout(() => {
      checkPermission();
    }, 50);
  }
  
  // Session validation
  setInterval(() => {
    if (sessionStorage.getItem('isLoggedIn') === 'true' && !validateSession()) {
      alert('Sesi Anda telah berakhir. Silakan login kembali.');
      window.location.href = 'login.html';
    }
  }, 5 * 60 * 1000); // Check every 5 minutes
  
  debugLog('Auth initialized');
}

// ===============================
// AUTO-INITIALIZE
// ===============================

// Wait for DOM and config.js to load
document.addEventListener('DOMContentLoaded', function() {
  // Try to initialize, retry if PERMISSIONS not loaded yet
  const tryInit = (attempt = 0) => {
    if (typeof PERMISSIONS !== 'undefined' || attempt >= 10) {
      initAuth();
    } else {
      setTimeout(() => tryInit(attempt + 1), 100);
    }
  };
  
  tryInit();
});

// For debugging in console
window.authDebug = {
  getCurrentPage,
  getCurrentUser,
  checkPermission,
  hasAccessTo: function(page) {
    return hasAccessTo(page);
  },
  getRole: function() {
    return normalizeRole(sessionStorage.getItem('userRole'));
  },
  getAllowedPages: function() {
    const role = normalizeRole(sessionStorage.getItem('userRole'));
    return PERMISSIONS[role] || [];
  },
  reload: function() {
    window.location.reload();
  }
};