/**
 * auth.js - Authentication & Authorization
 * Kompatibel dengan Cloudflare Pages, Vercel, dan platform lain
 */

// ===============================
// NORMALIZE ROLE
// ===============================

/**
 * Normalize role dari berbagai format ke format standard
 * Input: "Admin", "ADMIN", "admin ", " Admin", "Admin User"
 * Output: "admin"
 */
function normalizeRole(role) {
  if (!role) return 'viewer';
  
  return String(role)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_') // Replace semua whitespace dengan underscore
    .replace(/[^a-z0-9_]/g, ''); // Remove special characters
}

// ===============================
// LOGIN CHECK
// ===============================

/**
 * Check apakah user sudah login
 * Return: true jika login, false jika belum
 */
function checkAuth() {
  const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
  
  if (!isLoggedIn) {
    console.warn('Akses ditolak: User belum login');
    window.location.href = 'login.html';
    return false;
  }
  
  return true;
}

// ===============================
// PERMISSION CHECK
// ===============================

/**
 * Check apakah user punya akses ke halaman ini
 * Return: true jika boleh, false jika tidak
 */
function checkPermission() {
  // 1. Check login first
  if (!checkAuth()) return false;

  // 2. Get current page
  let page = window.location.pathname.split('/').pop();
  if (!page) page = 'index.html';
  
  // Remove query string jika ada
  page = page.split('?')[0];

  // 3. Get user role
  const rawRole = sessionStorage.getItem('userRole');
  const role = normalizeRole(rawRole);

  // 4. Check permission
  if (typeof PERMISSIONS === 'undefined') {
    console.error('❌ PERMISSIONS tidak defined. Pastikan config.js sudah dimuat!');
    window.location.href = 'index.html';
    return false;
  }

  const allowedPages = PERMISSIONS[role] || [];

  if (!allowedPages.includes(page)) {
    console.warn(`Akses ditolak: Role "${role}" tidak boleh akses "${page}"`);
    console.log(`  Allowed pages: ${allowedPages.join(', ')}`);
    
    // Redirect ke halaman default
    const defaultPage = allowedPages.length > 0 ? allowedPages[0] : 'index.html';
    window.location.href = defaultPage;
    return false;
  }

  console.log(`✅ Access granted: ${role} → ${page}`);
  return true;
}

// ===============================
// GET CURRENT USER
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

// ===============================
// LOGOUT
// ===============================

/**
 * Logout user
 */
function logout() {
  if (confirm('Keluar dari aplikasi?')) {
    sessionStorage.clear();
    window.location.href = 'login.html';
  }
}

// ===============================
// SESSION MANAGEMENT
// ===============================

/**
 * Store user session
 */
function setUserSession(username, fullName, role) {
  sessionStorage.setItem('username', username);
  sessionStorage.setItem('fullName', fullName);
  sessionStorage.setItem('userRole', role);
  sessionStorage.setItem('isLoggedIn', 'true');
  sessionStorage.setItem('loginTime', new Date().toISOString());
}

/**
 * Clear user session
 */
function clearUserSession() {
  sessionStorage.removeItem('username');
  sessionStorage.removeItem('fullName');
  sessionStorage.removeItem('userRole');
  sessionStorage.removeItem('isLoggedIn');
  sessionStorage.removeItem('loginTime');
}

/**
 * Check session validity (optional - untuk auto-logout after X hours)
 */
function validateSession(maxHours = 8) {
  const loginTime = sessionStorage.getItem('loginTime');
  if (!loginTime) return false;

  const elapsed = Date.now() - new Date(loginTime).getTime();
  const maxMs = maxHours * 60 * 60 * 1000;

  if (elapsed > maxMs) {
    console.warn('Session expired');
    clearUserSession();
    return false;
  }

  return true;
}

// ===============================
// INIT - Auto Check Permission
// ===============================

/**
 * Auto-check permission saat page load
 * Skip untuk login.html
 */
document.addEventListener('DOMContentLoaded', function() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const isLoginPage = currentPage.includes('login');

  if (!isLoginPage) {
    checkPermission();
    
    // Validate session setiap 5 menit
    setInterval(() => {
      if (!validateSession()) {
        alert('Sesi Anda telah berakhir. Silakan login kembali.');
        window.location.href = 'login.html';
      }
    }, 5 * 60 * 1000);
  }
});