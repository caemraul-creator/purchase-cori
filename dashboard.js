// =========================================
// dashboard.js - FINAL PRODUCTION VERSION
// =========================================

// ================================
// MENU DEFINITION
// ================================
const MENU_DEF = [
  { id: 'request',  page: 'index.html',    icon: '📋', title: 'New Request',    desc: 'Create and submit new purchase requests.' },
  { id: 'approval', page: 'approval.html', icon: '📬', title: 'Approval Hub',    desc: 'Central portal to review and approve requests.' },
  { id: 'done',     page: 'done.html',     icon: '📦', title: 'Fulfillment',     desc: 'Track and finalize procurement steps.' },
  { id: 'rekap',    page: 'rekap.html',    icon: '📊', title: 'Report Center',    desc: 'Comprehensive analytics and history.' },
  { id: 'rejected', page: 'rejected.html', icon: '⛔', title: 'Rejection Log',    desc: 'Archive of non-fulfillment decisions.' },
  { id: 'print',    page: 'print.html',    icon: '📥', title: 'Export & Print',   desc: 'Download data purchase request to PDF/Excel.' }
];

// ================================
// ROLE NORMALIZATION
// ================================
function normalizeRole(role) {
  if (!role || role.trim() === '') return 'viewer';
  
  const roleStr = role.toString().toLowerCase().trim();
  
  const roleMap = {
    'admin': 'administrator',
    'administrator': 'administrator',
    'superadmin': 'administrator',
    'super_admin': 'administrator',
    'user': 'user',
    'pengguna': 'user',
    'anggota': 'user',
    'member': 'user',
    'viewer': 'viewer',
    'guest': 'viewer',
    'tamu': 'viewer',
    'manager': 'manager',
    'manajer': 'manager'
  };
  
  return roleMap[roleStr] || roleStr;
}

// ================================
// INIT
// ================================
document.addEventListener('DOMContentLoaded', init);

function init() {
  if (!sessionStorage.getItem('isLoggedIn')) {
    window.location.href = 'login.html';
    return;
  }

  console.log('=== DASHBOARD INIT ===');
  console.log('User Role:', sessionStorage.getItem('userRole'));
  console.log('Full Name:', sessionStorage.getItem('fullName'));
  console.log('Permissions defined:', typeof PERMISSIONS !== 'undefined');
  
  if (typeof PERMISSIONS !== 'undefined') {
    console.log('Available permission keys:', Object.keys(PERMISSIONS));
  }

  setGreeting();
  renderWorkMenu();

  if (typeof API_URL !== 'undefined' && typeof loadMultipleSheets === 'function') {
    loadDashboardStatsOptimized();
  }
}

// ================================
// GREETING
// ================================
function setGreeting() {
  const el = document.getElementById('greetingText');
  if (!el) return;

  const hour = new Date().getHours();
  let greet = 'Halo';

  if (hour < 11) greet = 'Selamat Pagi';
  else if (hour < 15) greet = 'Selamat Siang';
  else if (hour < 19) greet = 'Selamat Sore';
  else greet = 'Selamat Malam';

  const name =
    sessionStorage.getItem('fullName') ||
    sessionStorage.getItem('username') ||
    'Rekan';

  el.textContent = `${greet}, ${name}`;
}

// ================================
// MENU RENDER (ANTI BLANK)
// ================================
function renderWorkMenu() {
  const container = document.getElementById('menuContainer');
  if (!container) {
    console.warn('menuContainer not found');
    return;
  }

  const rawRole = sessionStorage.getItem('userRole') || 'viewer';
  const role = normalizeRole(rawRole);
  console.log('User Role:', rawRole, '→ Normalized:', role);

  let allowedPages = [];

  if (typeof PERMISSIONS !== 'undefined') {
    // Cari permissions dengan berbagai format key
    const possibleKeys = [role, rawRole.toLowerCase()];
    
    for (const key of possibleKeys) {
      if (PERMISSIONS[key]) {
        allowedPages = PERMISSIONS[key];
        console.log(`✓ Permissions found for key: "${key}"`);
        break;
      }
    }
    
    // Fallback jika tidak ditemukan
    if (allowedPages.length === 0) {
      console.warn(`✗ No permissions found for "${role}", using default`);
      // Default berdasarkan role
      if (role === 'administrator') {
        allowedPages = MENU_DEF.map(m => m.page);
      } else if (role === 'user') {
        allowedPages = ['index.html', 'done.html', 'rekap.html', 'print.html'];
      } else {
        allowedPages = ['rekap.html', 'print.html']; // untuk viewer
      }
    }
  } else {
    console.error('PERMISSIONS is not defined!');
    // Fallback extreme: tampilkan semua
    allowedPages = MENU_DEF.map(m => m.page);
  }

  console.log('Allowed pages:', allowedPages);

  // Render menu
  const html = MENU_DEF
    .filter(menu => allowedPages.includes(menu.page))
    .map(menu => `
      <a href="${menu.page}" class="menu-item" data-page="${menu.page}">
        <div class="menu-item-icon">${menu.icon}</div>
        <div class="menu-item-info">
          <h3>${menu.title}</h3>
          <p>${menu.desc}</p>
        </div>
        <div class="menu-item-arrow">→</div>
      </a>
    `)
    .join('');

  container.innerHTML = html || '<p class="text-muted">Tidak ada menu tersedia</p>';
}

// ================================
// DASHBOARD STATS (OPTIMIZED)
// ================================
let statsData = {
  pending: 0,
  approved: 0,
  done: 0,
  rejected: 0
};

let seenIds = new Set();

function loadDashboardStatsOptimized() {
  statsData = { pending: 0, approved: 0, done: 0, rejected: 0 };
  seenIds.clear();

  loadMultipleSheets(['', 'done', 'rejected'], (results) => {
    // MAIN SHEET
    (results[''] || []).forEach(item => processItem(item));

    // DONE
    (results['done'] || []).forEach(item => {
      if (item.ID) statsData.done++;
    });

    // REJECTED
    (results['rejected'] || []).forEach(item => {
      if (item.ID) statsData.rejected++;
    });

    syncStatsUI();
  });
}

function processItem(item) {
  if (!item || !item.ID || seenIds.has(item.ID)) return;

  const status = (item.Status || '').toLowerCase().trim();
  if (statsData.hasOwnProperty(status)) {
    statsData[status]++;
    seenIds.add(item.ID);
  }
}

function syncStatsUI() {
  setText('statPending', statsData.pending);
  setText('statApproved', statsData.approved);
  setText('statDone', statsData.done);
  setText('statRejected', statsData.rejected);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}