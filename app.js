/**
 * app.js - ALL LOGIC IN ONE FILE
 * Gabungan dari: app.js, approval.js, dashboard.js, done.js, rekap.js, rejected.js, print.js
 * Versi SPA - Single Page Application
 * LENGKAP - SATU FILE
 */

// ============================================
// 0. PASTIKAN FUNGSI GLOBAL TERSEDIA
// ============================================

if (typeof normalizeRole === 'undefined') {
  window.normalizeRole = function (role) {
    if (!role) return 'viewer';
    return String(role).toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  };
}

if (typeof checkPermission === 'undefined') {
  window.checkPermission = function (page) {
    return sessionStorage.getItem('isLoggedIn') === 'true';
  };
}

// ============================================
// 1. KONFIGURASI DASAR
// ============================================

const HIDDEN_COLUMNS = {
  request: ['DoneBy', 'DoneDate', 'CreatedAt', 'RejectedBy', 'RejectedDate', 'RejectedReason', 'PartOf', 'Requester'],
  approval: ['CreatedAt', 'ApprovedBy', 'ApprovedDate', 'DoneBy', 'DoneDate', 'RejectedBy', 'RejectedDate', 'RejectedReason'],
  done: ['CreatedAt', 'ApprovedBy', 'ApprovedDate', 'DoneBy', 'DoneDate', 'RejectedBy', 'RejectedDate', 'RejectedReason'],
  rekap: ['CreatedAt', 'ApprovedBy', 'ApprovedDate', 'DoneBy', 'DoneDate', 'RejectedBy', 'RejectedDate', 'RejectedReason', 'Requester'],
  rejected: ['DoneBy', 'DoneDate', 'Price', 'Nominal', 'LastBuyingDate', 'Aksi', 'CreatedAt', 'ApprovedBy', 'ApprovedDate']
};

const NUMBER_COLUMNS = ['Qty'];
const CURRENCY_COLUMNS = ['Price', 'Nominal'];
const DATE_COLUMNS = ['LastBuyingDate', 'OrderDate'];
const DATETIME_COLUMNS = ['CreatedAt', 'SubmissionDate', 'ApprovedDate', 'DoneDate', 'RejectedDate'];

let allData = {};
let filteredData = {};
let headers = {};
let currentPage = {};
let pageSize = 100;
let editMode = false;
let currentEditId = null;

const MENU_DEF = [
  { id: 'request', page: 'request', icon: '📋', title: 'New Request', desc: 'Create and submit new purchase requests.' },
  { id: 'approval', page: 'approval', icon: '📬', title: 'Approval Hub', desc: 'Central portal to review and approve requests.' },
  { id: 'done', page: 'done', icon: '📦', title: 'Fulfillment', desc: 'Track and finalize procurement steps.' },
  { id: 'rekap', page: 'rekap', icon: '📊', title: 'Report Center', desc: 'Comprehensive analytics and history.' },
  { id: 'rejected', page: 'rejected', icon: '⛔', title: 'Rejection Log', desc: 'Archive of non-fulfillment decisions.' },
  { id: 'print', page: 'print', icon: '📥', title: 'Export & Print', desc: 'Download data purchase request to PDF/Excel.' }
];

['request', 'approval', 'done', 'rekap', 'rejected'].forEach(page => {
  allData[page] = [];
  filteredData[page] = [];
  headers[page] = [];
  currentPage[page] = 1;
});

// ============================================
// 2. NAVIGASI & RENDER PAGE
// ============================================

function renderPage(page) {
  console.log(`📄 Rendering page: ${page}`);

  document.querySelectorAll('.page-container').forEach(el => {
    el.style.display = 'none';
  });

  const container = document.getElementById(`page-${page}`);
  if (container) {
    container.style.display = 'block';
    sessionStorage.setItem('currentPage', page);
  } else {
    console.error(`Page container not found: page-${page}`);
    return;
  }

  switch (page) {
    case 'dashboard': renderDashboard(); break;
    case 'request': renderRequestPage(); break;
    case 'approval': renderApprovalPage(); break;
    case 'done': renderDonePage(); break;
    case 'rekap': renderRekapPage(); break;
    case 'rejected': renderRejectedPage(); break;
    case 'print': renderPrintPage(); break;
    default: console.warn(`Unknown page: ${page}`);
  }

  if (typeof renderUserStatus === 'function') {
    renderUserStatus();
  }
}

// ============================================
// 3. DASHBOARD
// ============================================

function renderDashboard() {
  const container = document.getElementById('page-dashboard');
  if (!container) return;

  const hour = new Date().getHours();
  let greet = 'Halo';
  if (hour < 11) greet = 'Selamat Pagi';
  else if (hour < 15) greet = 'Selamat Siang';
  else if (hour < 19) greet = 'Selamat Sore';
  else greet = 'Selamat Malam';

  const name = sessionStorage.getItem('fullName') || sessionStorage.getItem('username') || 'Rekan';

  container.innerHTML = `
    <div class="header">
      <div class="logo-section">
        <img src="logo.png" alt="Company Logo" style="width:70px;height:70px;object-fit:contain;margin:0 auto;display:block;">
      </div>
      <div class="greeting-box" style="font-size:2.5rem;font-weight:700;color:#1f2937;display:flex;align-items:center;justify-content:center;gap:12px;">
        <span style="animation:wave 2s infinite;display:inline-block;">👋</span>
        <span>${greet}, ${name}</span>
      </div>
      <h1 style="font-size:1.5rem;color:#374151;margin-bottom:20px;">Dashboard Utama</h1>
      <p style="color:#6b7280;">Modernized Management Analytics for Purchase Request Operations</p>
    </div>

    <div class="stats-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;margin-bottom:40px;">
      <div class="stat-card pending" style="background:white;border-radius:16px;padding:20px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 4px 6px rgba(0,0,0,0.05);border:1px solid #e5e7eb;">
        <div class="stat-icon-wrapper" style="width:50px;height:50px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;background:#fff7ed;color:#c2410c;">⏳</div>
        <div>
          <div id="statPending" class="stat-value" style="font-size:2rem;font-weight:700;line-height:1;color:#c2410c;">0</div>
          <div class="stat-label" style="font-size:0.85rem;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Pending</div>
        </div>
      </div>
      <div class="stat-card approved" style="background:white;border-radius:16px;padding:20px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 4px 6px rgba(0,0,0,0.05);border:1px solid #e5e7eb;">
        <div class="stat-icon-wrapper" style="width:50px;height:50px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;background:#eff6ff;color:#1d4ed8;">✅</div>
        <div>
          <div id="statApproved" class="stat-value" style="font-size:2rem;font-weight:700;line-height:1;color:#1d4ed8;">0</div>
          <div class="stat-label" style="font-size:0.85rem;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Approved</div>
        </div>
      </div>
      <div class="stat-card done" style="background:white;border-radius:16px;padding:20px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 4px 6px rgba(0,0,0,0.05);border:1px solid #e5e7eb;">
        <div class="stat-icon-wrapper" style="width:50px;height:50px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;background:#f0fdf4;color:#15803d;">📦</div>
        <div>
          <div id="statDone" class="stat-value" style="font-size:2rem;font-weight:700;line-height:1;color:#15803d;">0</div>
          <div class="stat-label" style="font-size:0.85rem;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Done</div>
        </div>
      </div>
      <div class="stat-card rejected" style="background:white;border-radius:16px;padding:20px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 4px 6px rgba(0,0,0,0.05);border:1px solid #e5e7eb;">
        <div class="stat-icon-wrapper" style="width:50px;height:50px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;background:#fef2f2;color:#b91c1c;">❌</div>
        <div>
          <div id="statRejected" class="stat-value" style="font-size:2rem;font-weight:700;line-height:1;color:#b91c1c;">0</div>
          <div class="stat-label" style="font-size:0.85rem;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Rejected</div>
        </div>
      </div>
    </div>

    <div class="section-head">
      <h2 style="font-size:1.5rem;color:#374151;margin-bottom:20px;">📋 Pilih Menu</h2>
    </div>

    <div id="menuContainer" class="menu-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;"></div>
  `;

  renderMenu();
  loadDashboardStats();
}

function renderMenu() {
  const container = document.getElementById('menuContainer');
  if (!container) return;

  const rawRole = sessionStorage.getItem('userRole') || 'viewer';
  const role = normalizeRole(rawRole);

  let allowedPages = [];
  if (typeof PERMISSIONS !== 'undefined') {
    const possibleKeys = [role, rawRole.toLowerCase()];
    for (const key of possibleKeys) {
      if (PERMISSIONS[key]) {
        allowedPages = PERMISSIONS[key];
        break;
      }
    }
  }

  if (allowedPages.length === 0) {
    allowedPages = MENU_DEF.map(m => m.page);
  }

  const html = MENU_DEF
    .filter(menu => allowedPages.includes(menu.page))
    .map(menu => `
      <div class="menu-item" onclick="navigateTo('${menu.page}')" style="background:white;border-radius:16px;padding:24px;border:1px solid #e5e7eb;display:flex;align-items:center;gap:15px;cursor:pointer;transition:all 0.2s;">
        <div class="menu-item-icon" style="width:50px;height:50px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;background:#f3f4f6;">${menu.icon}</div>
        <div class="menu-item-info">
          <h3 style="margin:0 0 4px 0;font-size:1.1rem;">${menu.title}</h3>
          <p style="margin:0;font-size:0.85rem;color:#6b7280;">${menu.desc}</p>
        </div>
        <div class="menu-item-arrow" style="margin-left:auto;color:#d1d5db;font-weight:bold;">→</div>
      </div>
    `)
    .join('');

  container.innerHTML = html || '<p style="color:#6b7280;">Tidak ada menu tersedia</p>';
}

function loadDashboardStats() {
  let stats = { pending: 0, approved: 0, done: 0, rejected: 0 };
  let seenIds = new Set();

  loadMultipleSheets(['', 'done', 'rejected'], (results) => {
    (results[''] || []).forEach(item => {
      if (item && item.ID && !seenIds.has(item.ID)) {
        const status = (item.Status || '').toLowerCase().trim();
        if (stats.hasOwnProperty(status)) {
          stats[status]++;
          seenIds.add(item.ID);
        }
      }
    });

    (results['done'] || []).forEach(item => {
      if (item && item.ID) stats.done++;
    });

    (results['rejected'] || []).forEach(item => {
      if (item && item.ID) stats.rejected++;
    });

    document.getElementById('statPending').textContent = stats.pending;
    document.getElementById('statApproved').textContent = stats.approved;
    document.getElementById('statDone').textContent = stats.done;
    document.getElementById('statRejected').textContent = stats.rejected;
  });
}

// ============================================
// 4. REQUEST PAGE
// ============================================

function renderRequestPage() {
  const container = document.getElementById('page-request');
  if (!container) return;

  container.innerHTML = `
    <div class="head-bar" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <img src="logo.png" alt="Company Logo" style="width:48px;height:48px;object-fit:contain;">
        <div>
          <h2 style="margin:0;font-size:1.5rem;color:#1f2937;">Purchase Request</h2>
          <p style="margin:0;font-size:0.85rem;color:#6b7280;font-weight:400;">Daftar permintaan pembelian barang</p>
        </div>
      </div>
      <div class="head-actions" style="display:flex;gap:12px;">
        <button onclick="navigateTo('dashboard')" class="btn-secondary btn-link" style="text-decoration:none;display:flex;align-items:center;gap:6px;">← Dashboard</button>
        <button id="btnAdd" class="btn-primary" style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:18px;">+</span> Tambah Permintaan
        </button>
      </div>
    </div>

    <div class="filter-bar" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:8px;color:#6b7280;font-size:0.9rem;">
        Tampilkan
        <select id="pageSize-request" style="padding:6px 12px;border:1px solid #d1d5db;border-radius:6px;background:white;color:#374151;font-size:0.9rem;">
          <option value="10">10</option>
          <option value="25">25</option>
          <option value="50">50</option>
          <option value="100">100</option>
          <option value="200" selected>200</option>
          <option value="500">500</option>
        </select>
        data
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="color:#6b7280;font-size:0.9rem;">🔍</span>
        <input type="text" id="search-request" placeholder="Cari data..." style="padding:8px 16px;border:1px solid #d1d5db;border-radius:8px;background:#f9fafb;min-width:250px;font-size:0.9rem;">
      </div>
    </div>

    <div class="table-wrapper">
      <table>
        <thead id="request-thead"></thead>
        <tbody id="request-tbody"></tbody>
      </table>
    </div>

    <div class="table-bottom">
      <div id="infoText-request"></div>
      <div id="pagination-request"></div>
    </div>
  `;

  document.getElementById('btnAdd')?.addEventListener('click', () => openRequestModal());
  document.getElementById('pageSize-request')?.addEventListener('change', (e) => {
    pageSize = Number(e.target.value);
    currentPage['request'] = 1;
    loadRequestData();
  });
  document.getElementById('search-request')?.addEventListener('input', debounceSearch(onRequestSearch, 300));

  loadRequestData();
}

function loadRequestData(forceRefresh = false) {
  if (forceRefresh && window.dataCache) {
    delete window.dataCache['main'];
  }

  loadDataOptimized((data) => {
    allData['request'] = data || [];
    filteredData['request'] = [...allData['request']];

    if (allData['request'].length > 0) {
      headers['request'] = Object.keys(allData['request'][0] || {}).filter(h => !HIDDEN_COLUMNS.request.includes(h));
    } else {
      headers['request'] = [];
    }

    currentPage['request'] = 1;
    renderRequestTable();
    renderRequestPagination();
  });
}

function onRequestSearch(e) {
  const q = e.target.value.toLowerCase();
  currentPage['request'] = 1;
  if (!q.trim()) {
    filteredData['request'] = [...allData['request']];
  } else {
    filteredData['request'] = allData['request'].filter(r =>
      headers['request'].map(h => r[h]).join(' ').toLowerCase().includes(q)
    );
  }
  renderRequestTable();
  renderRequestPagination();
}

function renderRequestTable() {
  const thead = document.getElementById('request-thead');
  const tbody = document.getElementById('request-tbody');
  if (!thead || !tbody) return;

  const headerHtml = headers['request'].map(h => {
    let html = `<th>${h}</th>`;
    if (h === 'ID') html += '<th>Aksi</th>';
    return html;
  }).join('');
  thead.innerHTML = `<tr>${headerHtml}</tr>`;

  const start = (currentPage['request'] - 1) * pageSize;
  const pageData = filteredData['request'].slice(start, start + pageSize);

  if (!pageData.length) {
    tbody.innerHTML = `<tr><td colspan="${headers['request'].length + 1}" class="text-center">Data tidak ditemukan</td></tr>`;
    return;
  }

  const rowsHtml = pageData.map(row => {
    let cellsHtml = headers['request'].map(h => {
      let v = row[h] ?? '';
      let cls = '';

      if (DATETIME_COLUMNS.includes(h)) { v = formatDateTime(v); cls = 'text-center'; }
      else if (DATE_COLUMNS.includes(h)) { v = formatDate(v); cls = 'text-center'; }
      if (NUMBER_COLUMNS.includes(h)) { v = formatNumber(v); cls = 'text-right'; }
      if (CURRENCY_COLUMNS.includes(h)) { v = formatRupiah(v); cls = 'text-right'; }
      if (h === 'Items' || h === 'Description') cls += ' truncate';

      let cell = `<td class="${cls}" title="${v}">${v}</td>`;
      if (h === 'Status') {
        const statusClass = String(v).toLowerCase();
        cell = `<td class="text-center"><span class="status ${statusClass}">${v}</span></td>`;
      }
      if (h === 'ID') {
        cell += `<td class="text-center" style="white-space:nowrap;">
          <button class="btn-secondary btn-xs" onclick="openRequestEdit('${row.ID}')" title="Edit">✏️</button>
        </td>`;
      }
      return cell;
    }).join('');
    return `<tr>${cellsHtml}</tr>`;
  });

  lazyRenderRows(rowsHtml, tbody, 50);
}

function renderRequestPagination() {
  const container = document.getElementById('pagination-request');
  const info = document.getElementById('infoText-request');
  if (!container || !info) return;

  const total = filteredData['request'].length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (currentPage['request'] - 1) * pageSize + 1;
  const end = Math.min(start + pageSize - 1, total);
  info.textContent = `Menampilkan ${start}–${end} dari ${total} data`;

  container.innerHTML = '';
  if (currentPage['request'] > 1) {
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '←';
    prevBtn.className = 'pagination-btn';
    prevBtn.onclick = () => { currentPage['request']--; renderRequestTable(); renderRequestPagination(); };
    container.appendChild(prevBtn);
  }

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage['request'] - 2 && i <= currentPage['request'] + 2)) {
      const b = document.createElement('button');
      b.textContent = i;
      b.className = 'pagination-btn';
      if (i === currentPage['request']) b.classList.add('active');
      b.onclick = () => { currentPage['request'] = i; renderRequestTable(); renderRequestPagination(); };
      container.appendChild(b);
    } else if (i === currentPage['request'] - 3 || i === currentPage['request'] + 3) {
      const ellipsis = document.createElement('span');
      ellipsis.textContent = '...';
      ellipsis.style.margin = '0 4px';
      ellipsis.style.color = '#6b7280';
      container.appendChild(ellipsis);
    }
  }

  if (currentPage['request'] < totalPages) {
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '→';
    nextBtn.className = 'pagination-btn';
    nextBtn.onclick = () => { currentPage['request']++; renderRequestTable(); renderRequestPagination(); };
    container.appendChild(nextBtn);
  }
}

// ============================================
// 5. REQUEST MODAL
// ============================================

function openRequestModal(row) {
  const modal = document.getElementById('requestModal');
  if (!modal) return;

  if (row) {
    editMode = true;
    currentEditId = row.ID;
    populateRequestForm(row);
  } else {
    editMode = false;
    currentEditId = null;
    clearRequestForm();
  }
  modal.classList.add('show');
}

function closeRequestModal() {
  document.getElementById('requestModal')?.classList.remove('show');
}

function populateRequestForm(row) {
  document.getElementById('formID').value = row.ID || '';
  ['Department', 'Office', 'Items', 'PartOf', 'Description', 'Qty', 'Unit', 'Price', 'Priority', 'OrderBy'].forEach(name => {
    const el = document.querySelector(`[name="${name}"]`);
    if (el) el.value = row[name] || '';
  });

  handleLastBuyingDateFallback(row.LastBuyingDate || '');

  const orderDateInput = document.querySelector('[name="OrderDate"]');
  if (orderDateInput) {
    orderDateInput.value = parseDateForInput(row.OrderDate);
  }
}

function clearRequestForm() {
  const form = document.getElementById('prForm');
  if (form) form.reset();
  document.getElementById('formID').value = '';

  const dateInput = document.getElementById('lastBuyingDate');
  const optionSelect = document.getElementById('lastBuyingOption');
  if (optionSelect) optionSelect.value = 'date';
  if (dateInput) {
    dateInput.disabled = false;
    dateInput.value = '';
    dateInput.style.backgroundColor = '#fff';
  }

  const today = new Date().toISOString().split('T')[0];
  const orderDateInput = document.querySelector('[name="OrderDate"]');
  if (orderDateInput) orderDateInput.value = today;
}

function handleLastBuyingDateFallback(value) {
  const optionSelect = document.getElementById('lastBuyingOption');
  const dateInput = document.getElementById('lastBuyingDate');

  if (!optionSelect || !dateInput) return;

  if (!value || value === 'Never Buy') {
    optionSelect.value = 'never';
    dateInput.value = '';
    dateInput.disabled = true;
    dateInput.style.backgroundColor = '#f3f4f6';
  } else {
    optionSelect.value = 'date';
    dateInput.disabled = false;
    dateInput.style.backgroundColor = '#fff';
    dateInput.value = parseDateForInput(value);
  }
}

function parseDateForInput(dateValue) {
  if (!dateValue) return '';
  if (typeof dateValue === 'string' && dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) return dateValue;
  const d = new Date(dateValue);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return '';
}

function handleLastBuyingOption() {
  const option = document.getElementById('lastBuyingOption').value;
  const dateInput = document.getElementById('lastBuyingDate');
  if (option === 'never') {
    dateInput.value = '';
    dateInput.disabled = true;
    dateInput.style.backgroundColor = '#f3f4f6';
  } else {
    dateInput.disabled = false;
    dateInput.style.backgroundColor = '#fff';
  }
}

async function submitRequestForm(e) {
  e.preventDefault();
  const form = document.getElementById('prForm');
  const fd = new FormData(form);

  if (editMode && currentEditId) {
    fd.append('ID', currentEditId);
    fd.append('action', 'update');
  } else {
    fd.append('action', 'create');
  }

  const username = sessionStorage.getItem('username') || 'User';
  fd.append('Requester', username);
  fd.append('UpdatedBy', username);

  const option = document.getElementById('lastBuyingOption').value;
  const dateInput = document.getElementById('lastBuyingDate');
  const hiddenInput = document.getElementById('lastBuyingDateHidden');
  if (option === 'never') {
    hiddenInput.value = 'Never Buy';
  } else if (dateInput.value) {
    hiddenInput.value = dateInput.value;
  }

  showToast(editMode ? 'Memperbarui data...' : 'Menyimpan data baru...', 'warning');

  try {
    const response = await fetch(API_URL, { method: 'POST', body: fd });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.text();
    console.log('✅ Form submitted:', result);

    showToast('Data berhasil disimpan', 'success');
    closeRequestModal();

    if (window.dataCache) {
      Object.keys(window.dataCache).forEach(key => delete window.dataCache[key]);
    }
    setTimeout(() => loadRequestData(true), 500);
  } catch (error) {
    console.error('❌ Submission error:', error);
    showToast('Gagal: ' + error.message, 'error');
  }
}

function openRequestEdit(id) {
  const row = allData['request'].find(r => r.ID === id);
  if (!row) {
    showToast('Data tidak ditemukan', 'error');
    return;
  }
  openRequestModal(row);
}

// ============================================
// 6. APPROVAL PAGE
// ============================================

function renderApprovalPage() {
  const container = document.getElementById('page-approval');
  if (!container) return;

  container.innerHTML = `
    <div class="head-bar" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <img src="logo.png" alt="Company Logo" style="width:48px;height:48px;object-fit:contain;">
        <div>
          <h2 style="margin:0;font-size:1.5rem;color:#1f2937;">Approval Purchase Request</h2>
          <p style="margin:0;font-size:0.85rem;color:#6b7280;font-weight:400;">Review dan approve permintaan</p>
        </div>
      </div>
      <div style="display:flex;gap:12px;">
        <button onclick="navigateTo('dashboard')" class="btn-secondary btn-link" style="text-decoration:none;display:flex;align-items:center;gap:6px;">← Dashboard</button>
        <button onclick="refreshApprovalData()" class="btn-secondary" style="display:flex;align-items:center;gap:6px;">🔄 Refresh</button>
      </div>
    </div>

    <div class="filter-bar" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:8px;color:#6b7280;font-size:0.9rem;">
        Tampilkan
        <select id="pageSize-approval" style="padding:6px 12px;border:1px solid #d1d5db;border-radius:6px;background:white;color:#374151;font-size:0.9rem;">
          <option value="10">10</option>
          <option value="25">25</option>
          <option value="50">50</option>
          <option value="100">100</option>
          <option value="200" selected>200</option>
          <option value="500">500</option>
        </select>
        data
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="color:#6b7280;font-size:0.9rem;">🔍</span>
        <input type="text" id="search-approval" placeholder="Cari data..." style="padding:8px 16px;border:1px solid #d1d5db;border-radius:8px;background:#f9fafb;min-width:250px;font-size:0.9rem;">
      </div>
    </div>

    <div class="table-wrapper">
      <table>
        <thead id="approval-thead"></thead>
        <tbody id="approval-tbody"></tbody>
      </table>
    </div>

    <div class="table-bottom">
      <div id="infoText-approval"></div>
      <div id="pagination-approval"></div>
    </div>
  `;

  document.getElementById('pageSize-approval')?.addEventListener('change', (e) => {
    pageSize = Number(e.target.value);
    currentPage['approval'] = 1;
    loadApprovalData();
  });
  document.getElementById('search-approval')?.addEventListener('input', debounceSearch(onApprovalSearch, 300));

  loadApprovalData();
}

function loadApprovalData() {
  loadDataOptimized((data) => {
    allData['approval'] = (data || []).filter(d => d.Status === 'pending');
    filteredData['approval'] = [...allData['approval']];

    if (allData['approval'].length > 0) {
      headers['approval'] = Object.keys(allData['approval'][0] || {}).filter(h => !HIDDEN_COLUMNS.approval.includes(h));
    } else {
      headers['approval'] = [];
    }

    currentPage['approval'] = 1;
    renderApprovalTable();
    renderApprovalPagination();
  });
}

function onApprovalSearch(e) {
  const q = e.target.value.toLowerCase();
  currentPage['approval'] = 1;
  filteredData['approval'] = allData['approval'].filter(r =>
    headers['approval'].map(h => r[h]).join(' ').toLowerCase().includes(q)
  );
  renderApprovalTable();
  renderApprovalPagination();
}

function renderApprovalTable() {
  const thead = document.getElementById('approval-thead');
  const tbody = document.getElementById('approval-tbody');
  if (!thead || !tbody) return;

  const headerHtml = headers['approval'].map(h => {
    let html = `<th>${h}</th>`;
    if (h === 'ID') html += '<th>Aksi</th>';
    return html;
  }).join('');
  thead.innerHTML = `<tr>${headerHtml}</tr>`;

  const start = (currentPage['approval'] - 1) * pageSize;
  const pageData = filteredData['approval'].slice(start, start + pageSize);

  if (!pageData.length) {
    tbody.innerHTML = `<tr><td colspan="${headers['approval'].length + 1}" class="text-center">Tidak ada data pending</td></tr>`;
    return;
  }

  const rowsHtml = pageData.map(r => {
    let cellsHtml = headers['approval'].map(h => {
      let v = r[h] ?? '';
      let cls = '';

      if (DATETIME_COLUMNS.includes(h)) { v = formatDateTime(v); cls = 'text-center'; }
      else if (DATE_COLUMNS.includes(h)) { v = formatDate(v); cls = 'text-center'; }
      if (NUMBER_COLUMNS.includes(h)) { v = formatNumber(v); cls = 'text-right'; }
      if (CURRENCY_COLUMNS.includes(h)) { v = formatRupiah(v); cls = 'text-right'; }

      let cell = `<td class="${cls}">${v}</td>`;
      if (h === 'Status') cell = `<td class="text-center"><span class="status pending">pending</span></td>`;
      if (h === 'ID') {
        cell += `<td class="text-center" style="white-space:nowrap;">
          <button class="btn-primary" onclick="approveRequest('${r.ID}')" title="Approve">✅</button>
          <button class="btn-secondary" onclick="rejectRequest('${r.ID}')" title="Reject">❌</button>
        </td>`;
      }
      return cell;
    }).join('');
    return `<tr>${cellsHtml}</tr>`;
  });

  lazyRenderRows(rowsHtml, tbody, 50);
}

function renderApprovalPagination() {
  const container = document.getElementById('pagination-approval');
  const info = document.getElementById('infoText-approval');
  if (!container || !info) return;

  const total = filteredData['approval'].length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (currentPage['approval'] - 1) * pageSize + 1;
  const end = Math.min(start + pageSize - 1, total);
  info.textContent = `Menampilkan ${start}–${end} dari ${total} data`;

  container.innerHTML = '';
  for (let i = 1; i <= totalPages; i++) {
    const b = document.createElement('button');
    b.textContent = i;
    b.className = 'pagination-btn';
    if (i === currentPage['approval']) b.classList.add('active');
    b.onclick = () => { currentPage['approval'] = i; renderApprovalTable(); renderApprovalPagination(); };
    container.appendChild(b);
  }
}

async function approveRequest(id) {
  const name = sessionStorage.getItem('username') || prompt('Masukkan nama approver:');
  if (!name) return;

  const fd = new FormData();
  fd.append('ID', id);
  fd.append('Status', 'approved');
  fd.append('ApprovedBy', name);
  await submitApprovalAction(fd);
}

async function rejectRequest(id) {
  const name = sessionStorage.getItem('username') || prompt('Masukkan nama penolak:');
  const reason = prompt('Masukkan alasan reject:');
  if (!name || !reason) return;

  const fd = new FormData();
  fd.append('ID', id);
  fd.append('Status', 'rejected');
  fd.append('RejectedBy', name);
  fd.append('RejectedReason', reason);
  await submitApprovalAction(fd);
}

async function submitApprovalAction(fd) {
  try {
    showToast('Memproses...', 'warning');
    const res = await fetch(API_URL, { method: 'POST', body: fd });
    if (!res.ok) throw new Error('Gagal update');
    showToast('Status berhasil diperbarui', 'success');
    if (window.dataCache) delete window.dataCache['main'];
    setTimeout(loadApprovalData, 500);
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
  }
}

function refreshApprovalData() {
  showToast('Memperbarui data...', 'warning');
  if (window.dataCache) delete window.dataCache['main'];
  loadApprovalData();
}

// ============================================
// 7. DONE PAGE
// ============================================

function renderDonePage() {
  const container = document.getElementById('page-done');
  if (!container) return;

  container.innerHTML = `
    <div class="head-bar" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <img src="logo.png" alt="Company Logo" style="width:48px;height:48px;object-fit:contain;">
        <div>
          <h2 style="margin:0;font-size:1.5rem;color:#1f2937;">Done Purchase Request</h2>
          <p style="margin:0;font-size:0.85rem;color:#6b7280;font-weight:400;">Kelola request yang sudah di-approve</p>
        </div>
      </div>
      <div style="display:flex;gap:12px;">
        <button onclick="navigateTo('dashboard')" class="btn-secondary btn-link" style="text-decoration:none;display:flex;align-items:center;gap:6px;">← Dashboard</button>
        <button onclick="refreshDoneData()" class="btn-secondary" style="display:flex;align-items:center;gap:6px;">🔄 Refresh</button>
      </div>
    </div>

    <div class="filter-bar" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:8px;color:#6b7280;font-size:0.9rem;">
        Tampilkan
        <select id="pageSize-done" style="padding:6px 12px;border:1px solid #d1d5db;border-radius:6px;background:white;color:#374151;font-size:0.9rem;">
          <option value="10">10</option>
          <option value="25">25</option>
          <option value="50">50</option>
          <option value="100">100</option>
          <option value="200" selected>200</option>
          <option value="500">500</option>
        </select>
        data
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="color:#6b7280;font-size:0.9rem;">🔍</span>
        <input type="text" id="search-done" placeholder="Cari data..." style="padding:8px 16px;border:1px solid #d1d5db;border-radius:8px;background:#f9fafb;min-width:250px;font-size:0.9rem;">
      </div>
    </div>

    <div class="table-wrapper">
      <table>
        <thead id="done-thead"></thead>
        <tbody id="done-tbody"></tbody>
      </table>
    </div>

    <div class="table-bottom">
      <div id="infoText-done"></div>
      <div id="pagination-done"></div>
    </div>
  `;

  document.getElementById('pageSize-done')?.addEventListener('change', (e) => {
    pageSize = Number(e.target.value);
    currentPage['done'] = 1;
    loadDoneData();
  });
  document.getElementById('search-done')?.addEventListener('input', debounceSearch(onDoneSearch, 300));

  loadDoneData();
}

function loadDoneData() {
  loadDataOptimized((data) => {
    allData['done'] = (data || []).filter(d => d.Status === 'approved');
    filteredData['done'] = [...allData['done']];

    if (allData['done'].length > 0) {
      headers['done'] = Object.keys(allData['done'][0] || {}).filter(h => !HIDDEN_COLUMNS.done.includes(h));
    } else {
      headers['done'] = [];
    }

    currentPage['done'] = 1;
    renderDoneTable();
    renderDonePagination();
  });
}

function onDoneSearch(e) {
  const q = e.target.value.toLowerCase();
  currentPage['done'] = 1;
  filteredData['done'] = allData['done'].filter(r =>
    headers['done'].map(h => r[h]).join(' ').toLowerCase().includes(q)
  );
  renderDoneTable();
  renderDonePagination();
}

function renderDoneTable() {
  const thead = document.getElementById('done-thead');
  const tbody = document.getElementById('done-tbody');
  if (!thead || !tbody) return;

  const headerHtml = headers['done'].map(h => {
    let html = `<th>${h}</th>`;
    if (h === 'ID') html += '<th>Aksi</th>';
    return html;
  }).join('');
  thead.innerHTML = `<tr>${headerHtml}</tr>`;

  const start = (currentPage['done'] - 1) * pageSize;
  const pageData = filteredData['done'].slice(start, start + pageSize);

  if (!pageData.length) {
    tbody.innerHTML = `<tr><td colspan="${headers['done'].length + 1}" class="text-center">Tidak ada data APPROVED</td></tr>`;
    return;
  }

  const rowsHtml = pageData.map(r => {
    let cellsHtml = headers['done'].map(h => {
      let v = r[h] ?? '';
      let cls = '';

      if (DATETIME_COLUMNS.includes(h)) { v = formatDateTime(v); cls = 'text-center'; }
      else if (DATE_COLUMNS.includes(h)) { v = formatDate(v); cls = 'text-center'; }
      if (NUMBER_COLUMNS.includes(h)) { v = formatNumber(v); cls = 'text-right'; }
      if (CURRENCY_COLUMNS.includes(h)) { v = formatRupiah(v); cls = 'text-right'; }

      let cell = `<td class="${cls}">${v}</td>`;
      if (h === 'Status') cell = `<td class="text-center"><span class="status approved">approved</span></td>`;
      if (h === 'ID') {
        cell += `<td class="text-center">
          <button class="btn-primary" onclick="markDone('${r.ID}')" title="Mark Done">📦</button>
        </td>`;
      }
      return cell;
    }).join('');
    return `<tr>${cellsHtml}</tr>`;
  });

  lazyRenderRows(rowsHtml, tbody, 50);
}

function renderDonePagination() {
  const container = document.getElementById('pagination-done');
  const info = document.getElementById('infoText-done');
  if (!container || !info) return;

  const total = filteredData['done'].length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (currentPage['done'] - 1) * pageSize + 1;
  const end = Math.min(start + pageSize - 1, total);
  info.textContent = `Menampilkan ${start}–${end} dari ${total} data`;

  container.innerHTML = '';
  for (let i = 1; i <= totalPages; i++) {
    const b = document.createElement('button');
    b.textContent = i;
    b.className = 'pagination-btn';
    if (i === currentPage['done']) b.classList.add('active');
    b.onclick = () => { currentPage['done'] = i; renderDoneTable(); renderDonePagination(); };
    container.appendChild(b);
  }
}

function markDone(id) {
  const choice = prompt('Ketik angka pilihan:\n1 = Completed (Semua dibeli)\n2 = Partial (Sebagian dibeli)');
  if (choice === '1') completeAll(id);
  else if (choice === '2') partialComplete(id);
  else if (choice !== null) alert('Pilihan tidak valid');
}

async function completeAll(id) {
  const user = sessionStorage.getItem('username') || prompt('Nama yang menyelesaikan:');
  if (!user) return;

  const fd = new FormData();
  fd.append('ID', id);
  fd.append('Status', 'done');
  fd.append('DoneBy', user);
  await submitDoneAction(fd, 'Request selesai (Completed)');
}

async function partialComplete(id) {
  const data = allData['done'].find(d => d.ID === id);
  if (!data) return;

  const boughtQty = Number(prompt(`Qty dibeli (Maks ${data.Qty}):`));
  if (!boughtQty || boughtQty <= 0 || boughtQty >= data.Qty) {
    alert('Qty tidak valid (Harus > 0 dan < Total Qty)');
    return;
  }

  const user = sessionStorage.getItem('username') || prompt('Nama yang menyelesaikan:');
  if (!user) return;

  const fd = new FormData();
  fd.append('ID', id);
  fd.append('Status', 'partial');
  fd.append('BoughtQty', boughtQty);
  fd.append('RemainingQty', data.Qty - boughtQty);
  fd.append('DoneBy', user);
  await submitDoneAction(fd, 'Partial request berhasil');
}

async function submitDoneAction(fd, successMsg) {
  try {
    showToast('Memproses...', 'warning');
    const res = await fetch(API_URL, { method: 'POST', body: fd });
    if (!res.ok) throw new Error('Gagal update');
    showToast(successMsg, 'success');
    if (window.dataCache) delete window.dataCache['main'];
    setTimeout(loadDoneData, 500);
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

function refreshDoneData() {
  showToast('Memperbarui data...', 'warning');
  if (window.dataCache) delete window.dataCache['main'];
  loadDoneData();
}

// ============================================
// 8. REKAP PAGE
// ============================================

function renderRekapPage() {
  const container = document.getElementById('page-rekap');
  if (!container) return;

  container.innerHTML = `
    <div class="head-bar" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <img src="logo.png" alt="Company Logo" style="width:48px;height:48px;object-fit:contain;">
        <div>
          <h2 style="margin:0;font-size:1.5rem;color:#1f2937;">Rekapan Purchase Request</h2>
          <p style="margin:0;font-size:0.85rem;color:#6b7280;font-weight:400;">Data request yang sudah selesai (Done)</p>
        </div>
      </div>
      <div style="display:flex;gap:12px;">
        <button onclick="navigateTo('dashboard')" class="btn-secondary btn-link" style="text-decoration:none;display:flex;align-items:center;gap:6px;">← Dashboard</button>
        <button onclick="refreshRekapData()" class="btn-secondary" style="display:flex;align-items:center;gap:6px;">🔄 Refresh</button>
      </div>
    </div>

    <div class="filter-bar" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:8px;color:#6b7280;font-size:0.9rem;">
        Tampilkan
        <select id="pageSize-rekap" style="padding:6px 12px;border:1px solid #d1d5db;border-radius:6px;background:white;color:#374151;font-size:0.9rem;">
          <option value="10">10</option>
          <option value="25">25</option>
          <option value="50">50</option>
          <option value="100">100</option>
          <option value="200" selected>200</option>
          <option value="500">500</option>
        </select>
        data
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="color:#6b7280;font-size:0.9rem;">🔍</span>
        <input type="text" id="search-rekap" placeholder="Cari data..." style="padding:8px 16px;border:1px solid #d1d5db;border-radius:8px;background:#f9fafb;min-width:250px;font-size:0.9rem;">
      </div>
    </div>

    <div class="table-wrapper">
      <table>
        <thead id="rekap-thead"></thead>
        <tbody id="rekap-tbody"></tbody>
      </table>
    </div>

    <div class="table-bottom">
      <div id="infoText-rekap"></div>
      <div id="pagination-rekap"></div>
    </div>
  `;

  document.getElementById('pageSize-rekap')?.addEventListener('change', (e) => {
    pageSize = Number(e.target.value);
    currentPage['rekap'] = 1;
    loadRekapData();
  });
  document.getElementById('search-rekap')?.addEventListener('input', debounceSearch(onRekapSearch, 300));

  loadRekapData();
}

function loadRekapData(forceRefresh = false) {
  if (forceRefresh && window.dataCache) {
    delete window.dataCache['done'];
  }

  loadDataOptimized((data) => {
    allData['rekap'] = data || [];
    filteredData['rekap'] = [...allData['rekap']];

    if (allData['rekap'].length > 0) {
      headers['rekap'] = Object.keys(allData['rekap'][0] || {}).filter(h => !HIDDEN_COLUMNS.rekap.includes(h));
    } else {
      headers['rekap'] = [];
    }

    currentPage['rekap'] = 1;
    renderRekapTable();
    renderRekapPagination();
  }, 'done');
}

function onRekapSearch(e) {
  const q = e.target.value.toLowerCase();
  currentPage['rekap'] = 1;
  filteredData['rekap'] = allData['rekap'].filter(r =>
    headers['rekap'].map(h => r[h]).join(' ').toLowerCase().includes(q)
  );
  renderRekapTable();
  renderRekapPagination();
}

function renderRekapTable() {
  const thead = document.getElementById('rekap-thead');
  const tbody = document.getElementById('rekap-tbody');
  if (!thead || !tbody) return;

  const headerHtml = headers['rekap'].map(h => {
    let displayName = h;
    if (h === 'SubmissionDate') displayName = 'Submission Date';
    return `<th>${displayName}</th>`;
  }).join('');
  thead.innerHTML = `<tr>${headerHtml}</tr>`;

  const start = (currentPage['rekap'] - 1) * pageSize;
  const pageData = filteredData['rekap'].slice(start, start + pageSize);

  if (!pageData.length) {
    tbody.innerHTML = `<tr><td colspan="${headers['rekap'].length}" class="text-center">Data tidak ditemukan</td></tr>`;
    return;
  }

  const rowsHtml = pageData.map(r => {
    let cellsHtml = headers['rekap'].map(h => {
      let v = r[h] ?? '';
      let cls = '';

      if (h === 'SubmissionDate') {
        v = formatDateTime(v);
        cls = 'text-center';
      } else if (DATETIME_COLUMNS.includes(h)) {
        v = formatDateTime(v);
        cls = 'text-center';
      } else if (DATE_COLUMNS.includes(h)) {
        v = formatDate(v);
        cls = 'text-center';
      }
      if (NUMBER_COLUMNS.includes(h)) { v = formatNumber(v); cls = 'text-right'; }
      if (CURRENCY_COLUMNS.includes(h)) { v = formatRupiah(v); cls = 'text-right'; }

      let cell = `<td class="${cls}">${v}</td>`;
      if (h === 'Status') {
        const status = String(v).toLowerCase();
        cell = `<td class="text-center"><span class="status ${status}">${v}</span></td>`;
      }
      return cell;
    }).join('');
    return `<tr>${cellsHtml}</tr>`;
  });

  lazyRenderRows(rowsHtml, tbody, 50);
}

function renderRekapPagination() {
  const container = document.getElementById('pagination-rekap');
  const info = document.getElementById('infoText-rekap');
  if (!container || !info) return;

  const total = filteredData['rekap'].length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (currentPage['rekap'] - 1) * pageSize + 1;
  const end = Math.min(start + pageSize - 1, total);
  info.textContent = `Menampilkan ${start}–${end} dari ${total} data`;

  container.innerHTML = '';
  if (currentPage['rekap'] > 1) {
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '←';
    prevBtn.className = 'pagination-btn';
    prevBtn.onclick = () => { currentPage['rekap']--; renderRekapTable(); renderRekapPagination(); };
    container.appendChild(prevBtn);
  }

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage['rekap'] - 2 && i <= currentPage['rekap'] + 2)) {
      const b = document.createElement('button');
      b.textContent = i;
      b.className = 'pagination-btn';
      if (i === currentPage['rekap']) b.classList.add('active');
      b.onclick = () => { currentPage['rekap'] = i; renderRekapTable(); renderRekapPagination(); };
      container.appendChild(b);
    } else if (i === currentPage['rekap'] - 3 || i === currentPage['rekap'] + 3) {
      const ellipsis = document.createElement('span');
      ellipsis.textContent = '...';
      ellipsis.style.margin = '0 4px';
      ellipsis.style.color = '#6b7280';
      container.appendChild(ellipsis);
    }
  }

  if (currentPage['rekap'] < totalPages) {
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '→';
    nextBtn.className = 'pagination-btn';
    nextBtn.onclick = () => { currentPage['rekap']++; renderRekapTable(); renderRekapPagination(); };
    container.appendChild(nextBtn);
  }
}

function refreshRekapData() {
  showToast('Memperbarui data rekap...', 'warning');
  if (window.dataCache) delete window.dataCache['done'];
  loadRekapData(true);
}

// ============================================
// 9. REJECTED PAGE
// ============================================

function renderRejectedPage() {
  const container = document.getElementById('page-rejected');
  if (!container) return;

  container.innerHTML = `
    <div class="head-bar" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <img src="logo.png" alt="Company Logo" style="width:48px;height:48px;object-fit:contain;">
        <div>
          <h2 style="margin:0;font-size:1.5rem;color:#1f2937;">Rejected Purchase Request</h2>
          <p style="margin:0;font-size:0.85rem;color:#6b7280;font-weight:400;">Data request yang ditolak</p>
        </div>
      </div>
      <div style="display:flex;gap:12px;">
        <button onclick="navigateTo('dashboard')" class="btn-secondary btn-link" style="text-decoration:none;display:flex;align-items:center;gap:6px;">← Dashboard</button>
        <button onclick="refreshRejectedData()" class="btn-secondary" style="display:flex;align-items:center;gap:6px;">🔄 Refresh</button>
      </div>
    </div>

    <div class="filter-bar" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:8px;color:#6b7280;font-size:0.9rem;">
        Tampilkan
        <select id="pageSize-rejected" style="padding:6px 12px;border:1px solid #d1d5db;border-radius:6px;background:white;color:#374151;font-size:0.9rem;">
          <option value="10">10</option>
          <option value="25">25</option>
          <option value="50">50</option>
          <option value="100">100</option>
          <option value="200" selected>200</option>
          <option value="500">500</option>
        </select>
        data
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="color:#6b7280;font-size:0.9rem;">🔍</span>
        <input type="text" id="search-rejected" placeholder="Cari data..." style="padding:8px 16px;border:1px solid #d1d5db;border-radius:8px;background:#f9fafb;min-width:250px;font-size:0.9rem;">
      </div>
    </div>

    <div class="table-wrapper">
      <table>
        <thead id="rejected-thead"></thead>
        <tbody id="rejected-tbody"></tbody>
      </table>
    </div>

    <div class="table-bottom">
      <div id="infoText-rejected"></div>
      <div id="pagination-rejected"></div>
    </div>
  `;

  document.getElementById('pageSize-rejected')?.addEventListener('change', (e) => {
    pageSize = Number(e.target.value);
    currentPage['rejected'] = 1;
    loadRejectedData();
  });
  document.getElementById('search-rejected')?.addEventListener('input', debounceSearch(onRejectedSearch, 300));

  loadRejectedData();
}

function loadRejectedData() {
  loadDataOptimized((data) => {
    allData['rejected'] = data || [];
    filteredData['rejected'] = [...allData['rejected']];

    if (allData['rejected'].length > 0) {
      headers['rejected'] = Object.keys(allData['rejected'][0] || {}).filter(h => !HIDDEN_COLUMNS.rejected.includes(h));
    } else {
      headers['rejected'] = [];
    }

    currentPage['rejected'] = 1;
    renderRejectedTable();
    renderRejectedPagination();
  }, 'rejected');
}

function onRejectedSearch(e) {
  const q = e.target.value.toLowerCase();
  currentPage['rejected'] = 1;
  filteredData['rejected'] = allData['rejected'].filter(r =>
    headers['rejected'].map(h => r[h]).join(' ').toLowerCase().includes(q)
  );
  renderRejectedTable();
  renderRejectedPagination();
}

function renderRejectedTable() {
  const thead = document.getElementById('rejected-thead');
  const tbody = document.getElementById('rejected-tbody');
  if (!thead || !tbody) return;

  const headerHtml = headers['rejected'].map(h => `<th>${h}</th>`).join('');
  thead.innerHTML = `<tr>${headerHtml}</tr>`;

  const start = (currentPage['rejected'] - 1) * pageSize;
  const pageData = filteredData['rejected'].slice(start, start + pageSize);

  if (!pageData.length) {
    tbody.innerHTML = `<tr><td colspan="${headers['rejected'].length}" class="text-center">Data tidak ditemukan</td></tr>`;
    return;
  }

  const rowsHtml = pageData.map(r => {
    let cellsHtml = headers['rejected'].map(h => {
      let v = r[h] ?? '';
      let cls = '';

      if (DATETIME_COLUMNS.includes(h)) { v = formatDateTime(v); cls = 'text-center'; }
      else if (DATE_COLUMNS.includes(h)) { v = formatDate(v); cls = 'text-center'; }
      if (NUMBER_COLUMNS.includes(h)) { v = formatNumber(v); cls = 'text-right'; }
      if (CURRENCY_COLUMNS.includes(h)) { v = formatRupiah(v); cls = 'text-right'; }
      if (h === 'Items' || h === 'Description' || h === 'RejectedReason') cls += ' truncate';

      let cell = `<td class="${cls}" title="${v}">${v}</td>`;
      if (h === 'Status') cell = `<td class="text-center"><span class="status rejected">rejected</span></td>`;
      return cell;
    }).join('');
    return `<tr>${cellsHtml}</tr>`;
  });

  lazyRenderRows(rowsHtml, tbody, 50);
}

function renderRejectedPagination() {
  const container = document.getElementById('pagination-rejected');
  const info = document.getElementById('infoText-rejected');
  if (!container || !info) return;

  const total = filteredData['rejected'].length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (currentPage['rejected'] - 1) * pageSize + 1;
  const end = Math.min(start + pageSize - 1, total);
  info.textContent = `Menampilkan ${start}–${end} dari ${total} data`;

  container.innerHTML = '';
  for (let i = 1; i <= totalPages; i++) {
    const b = document.createElement('button');
    b.textContent = i;
    b.className = 'pagination-btn';
    if (i === currentPage['rejected']) b.classList.add('active');
    b.onclick = () => { currentPage['rejected'] = i; renderRejectedTable(); renderRejectedPagination(); };
    container.appendChild(b);
  }
}

function refreshRejectedData() {
  showToast('Memperbarui data...', 'warning');
  if (window.dataCache) delete window.dataCache['rejected'];
  loadRejectedData();
}

// ============================================
// 10. PRINT/EXPORT PAGE
// ============================================

function renderPrintPage() {
  const container = document.getElementById('page-print');
  if (!container) return;

  container.innerHTML = `
    <div class="header" style="text-align:center;margin-bottom:40px;">
      <div class="logo-container" style="margin-bottom:20px;">
        <img src="logo.png" alt="Company Logo" style="width:80px;height:80px;object-fit:contain;margin:0 auto;display:block;">
      </div>
      <h1 style="font-size:2.5rem;font-weight:700;color:#0c4a6e;margin-bottom:10px;display:flex;align-items:center;justify-content:center;gap:12px;">
        <span>📄</span> Export Data PDF
      </h1>
      <p style="font-size:1rem;color:#0369a1;">Download data purchase request sesuai tampilan tabel halaman</p>
    </div>

    <div class="card" style="background:white;border-radius:16px;padding:32px;border:1px solid #cffafe;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
      <div class="buttons-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:32px;">
        <button class="btn btn-request" onclick="exportByPage('request')" style="display:flex;flex-direction:row;align-items:center;justify-content:center;gap:8px;padding:16px 20px;border:none;border-radius:12px;font-weight:600;font-size:0.9rem;cursor:pointer;transition:all 0.3s;text-align:center;line-height:1.2;min-height:56px;background:linear-gradient(135deg,#a8e6d8,#7ddcd0);color:#0d5046;box-shadow:0 4px 6px rgba(120,220,200,0.3);">
          📄 Export Request
        </button>
        <button class="btn btn-approval" onclick="exportByPage('approval')" style="display:flex;flex-direction:row;align-items:center;justify-content:center;gap:8px;padding:16px 20px;border:none;border-radius:12px;font-weight:600;font-size:0.9rem;cursor:pointer;transition:all 0.3s;text-align:center;line-height:1.2;min-height:56px;background:linear-gradient(135deg,#f5bfda,#f0a8d0);color:#5f1841;box-shadow:0 4px 6px rgba(245,191,218,0.3);">
          📄 Export Approval
        </button>
        <button class="btn btn-rekap" onclick="exportByPage('rekap')" style="display:flex;flex-direction:row;align-items:center;justify-content:center;gap:8px;padding:16px 20px;border:none;border-radius:12px;font-weight:600;font-size:0.9rem;cursor:pointer;transition:all 0.3s;text-align:center;line-height:1.2;min-height:56px;background:linear-gradient(135deg,#fed9b1,#fcc886);color:#5a2700;box-shadow:0 4px 6px rgba(254,217,177,0.3);">
          📄 Export Rekap
        </button>
        <button class="btn btn-rejected" onclick="exportByPage('rejected')" style="display:flex;flex-direction:row;align-items:center;justify-content:center;gap:8px;padding:16px 20px;border:none;border-radius:12px;font-weight:600;font-size:0.9rem;cursor:pointer;transition:all 0.3s;text-align:center;line-height:1.2;min-height:56px;background:linear-gradient(135deg,#f5bfbf,#f0a5a5);color:#5a1111;box-shadow:0 4px 6px rgba(245,191,191,0.3);">
          📄 Export Rejected
        </button>
      </div>

      <div class="info-box" style="background:linear-gradient(135deg,#f0fdf4 0%,#f5fdf7 100%);border:1px solid #d1fce8;border-radius:12px;padding:24px;margin-top:24px;">
        <h3 style="color:#134e4a;font-size:1.1rem;margin-bottom:16px;display:flex;align-items:center;gap:8px;">📋 Penjelasan Setiap Export:</h3>
        <ul style="list-style:none;padding:0;">
          <li style="color:#166534;padding:8px 0;line-height:1.6;"><strong style="color:#15803d;">📄 Export Request</strong><br>Export data pending dari halaman New Request</li>
          <li style="color:#166534;padding:8px 0;line-height:1.6;"><strong style="color:#15803d;">📄 Export Approval</strong><br>Export data yang sudah approval</li>
          <li style="color:#166534;padding:8px 0;line-height:1.6;"><strong style="color:#15803d;">📄 Export Rekap</strong><br>Export data barang yang sudah di Done</li>
          <li style="color:#166534;padding:8px 0;line-height:1.6;"><strong style="color:#15803d;">📄 Export Rejected</strong><br>Export data reject</li>
        </ul>
      </div>

      <div class="info-box" style="background:linear-gradient(135deg,#fef3c7 0%,#fffbeb 100%);border-color:#fcd34d;border-radius:12px;padding:24px;margin-top:24px;">
        <h3 style="color:#92400e;font-size:1.1rem;margin-bottom:16px;display:flex;align-items:center;gap:8px;">ℹ️ Informasi Teknis:</h3>
        <ul style="list-style:none;padding:0;color:#78350f;">
          <li style="padding:8px 0;line-height:1.6;">✓ Format: <strong>PDF Landscape</strong></li>
          <li style="padding:8px 0;line-height:1.6;">✓ Kolom: <strong>Hanya sampai Status (kolom utama)</strong></li>
          <li style="padding:8px 0;line-height:1.6;">✓ Format Rupiah: <strong>Rp dengan pemisah ribuan</strong></li>
          <li style="padding:8px 0;line-height:1.6;">✓ Format Tanggal: <strong>DD/MM/YYYY (Order Date & Last Buying Date)</strong></li>
          <li style="padding:8px 0;line-height:1.6;">✓ Nama file otomatis dengan tanggal dan jam download</li>
        </ul>
      </div>
    </div>
  `;
}

async function exportByPage(pageKey) {
  const sheetMap = { request: '', approval: '', rekap: 'done', rejected: 'rejected' };
  const filterMap = { request: 'pending', approval: 'approved', rekap: null, rejected: null };
  const titleMap = {
    request: 'Purchase Request - New Request',
    approval: 'Purchase Request - Approval Hub',
    rekap: 'Purchase Request - Report Center',
    rejected: 'Purchase Request - Rejection Log'
  };

  const btn = document.querySelector(`.btn-${pageKey}`);
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Memproses...';
  }

  try {
    showToast(`⏳ Mengekspor ${pageKey}...`, 'warning');

    const data = await fetchExportData(sheetMap[pageKey]);
    const htmlContent = createExportTable(data, filterMap[pageKey], titleMap[pageKey]);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    generatePDF(htmlContent, `Purchase-Request-${pageKey}-${timestamp}.pdf`);

    showToast(`✅ Export ${pageKey} berhasil!`, 'success');
  } catch (err) {
    console.error(err);
    showToast(`❌ ${err.message}`, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = `📄 Export ${pageKey.charAt(0).toUpperCase() + pageKey.slice(1)}`;
    }
  }
}

function fetchExportData(sheetName = '') {
  return new Promise((resolve, reject) => {
    const callbackName = `cb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    window[callbackName] = function (data) {
      delete window[callbackName];
      document.getElementById(`script-${callbackName}`)?.remove();
      resolve(data);
    };

    const url = new URL(API_URL);
    url.searchParams.set('callback', callbackName);
    if (sheetName) url.searchParams.set('sheet', sheetName);

    const script = document.createElement('script');
    script.id = `script-${callbackName}`;
    script.src = url.toString();
    script.onerror = () => reject(new Error('Gagal mengambil data'));

    const timeout = setTimeout(() => {
      reject(new Error('Timeout - data tidak diterima'));
    }, 15000);

    script.onload = () => clearTimeout(timeout);
    document.body.appendChild(script);
  });
}

function createExportTable(data, filter = null, title = '') {
  if (!Array.isArray(data) || data.length === 0) return '<p>Tidak ada data</p>';

  let filteredData = data;
  if (filter) {
    filteredData = data.filter(row => (row.Status || '').toLowerCase() === filter);
  }

  if (filteredData.length === 0) return '<p>Tidak ada data</p>';

  const ALLOWED_COLUMNS = ['ID', 'Department', 'Office', 'Items', 'PartOf', 'Description', 'Qty', 'Unit', 'Price', 'Nominal', 'LastBuyingDate', 'OrderDate', 'Priority', 'OrderBy', 'Status'];
  const allHeaders = Object.keys(filteredData[0] || {});
  const headers = allHeaders.filter(h => ALLOWED_COLUMNS.includes(h));

  const headerRow = headers.map(h => `<th style="padding:6px;text-align:left;border:1px solid #ddd;background:#f0f0f0;font-weight:bold;font-size:9px;word-wrap:break-word;">${h}</th>`).join('');

  const bodyRows = filteredData.map(row => {
    const cells = headers.map(h => {
      let value = row[h] ?? '';

      if (['CreatedAt', 'SubmissionDate', 'ApprovedDate', 'DoneDate', 'RejectedDate'].includes(h) && value) {
        value = formatDateTime(value);
      } else if (['LastBuyingDate', 'OrderDate'].includes(h) && value) {
        value = formatDate(value);
      } else if (['Price', 'Nominal'].includes(h) && value) {
        value = formatRupiah(value);
      }

      return `<td style="padding:4px;border:1px solid #ddd;font-size:8px;word-wrap:break-word;max-width:80px;">${String(value).substring(0, 50)}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `
    <div style="page-break-after:always;margin-bottom:20px;">
      <h2 style="color:#333;margin-bottom:10px;font-size:14px;">${title}</h2>
      <table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:8px;">
        <thead><tr>${headerRow}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
  `;
}

function generatePDF(htmlContent, filename) {
  const element = document.createElement('div');
  element.innerHTML = `
    <div style="font-family:Arial,sans-serif;padding:15px;font-size:8px;">
      <div style="text-align:center;margin-bottom:15px;">
        <h1 style="margin:0;color:#0c4a6e;font-size:16px;">📄 Purchase Request Report</h1>
        <p style="color:#666;margin:5px 0;font-size:9px;">Generated: ${new Date().toLocaleString('id-ID')}</p>
      </div>
      ${htmlContent}
    </div>
  `;

  const options = {
    margin: [8, 8, 8, 8],
    filename: filename,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 1.5, useCORS: true },
    jsPDF: { orientation: 'landscape', unit: 'mm', format: 'a4', compress: true }
  };

  if (typeof html2pdf !== 'undefined') {
    html2pdf().set(options).from(element).save();
  } else {
    showToast('⚠️ Library html2pdf tidak ditemukan. Pastikan CDN terload.', 'error');
    console.error('html2pdf library not loaded');
  }
}

// ============================================
// 11. INISIALISASI SPA
// ============================================

function renderPageContainers() {
  const app = document.getElementById('app');
  if (!app) return;

  const pages = ['dashboard', 'request', 'approval', 'done', 'rekap', 'rejected', 'print'];

  app.innerHTML = pages.map(page => `
    <div id="page-${page}" class="page-container" style="display:none;"></div>
  `).join('');
}

function setupModalEvents() {
  const modal = document.getElementById('requestModal');
  if (!modal) {
    createRequestModal();
  }
}

function createRequestModal() {
  const modalHTML = `
    <div id="requestModal" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Form Permintaan Barang</h3>
          <button id="btnCloseModal" class="modal-close" type="button">×</button>
        </div>
        <form id="prForm" class="pr-form" autocomplete="off">
          <input type="hidden" name="ID" id="formID">
          <div class="form-grid">
            <div><label>Department</label><input name="Department" required></div>
            <div><label>Office</label><input name="Office" required></div>
            <div><label>Items</label><input name="Items" required></div>
            <div><label>Part Of</label><input name="PartOf"></div>
            <div class="full"><label>Description</label><textarea name="Description" rows="3"></textarea></div>
            <div><label>Qty</label><input name="Qty" type="number" min="1" required></div>
            <div><label>Unit</label><input name="Unit" required></div>
            <div><label>Price</label><input name="Price" type="number" min="0" required></div>
            <div>
              <label>Last Buying Option</label>
              <select id="lastBuyingOption" onchange="handleLastBuyingOption()">
                <option value="date">Gunakan Tanggal</option>
                <option value="never">Never Buy</option>
              </select>
            </div>
            <div>
              <label>Last Buying Date</label>
              <input id="lastBuyingDate" type="date">
            </div>
            <input type="hidden" name="LastBuyingDate" id="lastBuyingDateHidden">
            <div><label>Order Date</label><input name="OrderDate" type="date" required value=""></div>
            <div><label>Priority</label>
              <select name="Priority">
                <option>Low</option>
                <option selected>Medium</option>
                <option>High</option>
              </select>
            </div>
            <div><label>Order By</label><input name="OrderBy"></div>
          </div>
          <div class="form-actions">
            <button type="button" id="btnCancelModal" class="btn-secondary">Batal</button>
            <button type="submit" class="btn-primary">Simpan</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);

  document.getElementById('btnCloseModal')?.addEventListener('click', closeRequestModal);
  document.getElementById('btnCancelModal')?.addEventListener('click', closeRequestModal);
  document.getElementById('prForm')?.addEventListener('submit', submitRequestForm);

  document.getElementById('requestModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeRequestModal();
  });
}

document.addEventListener('DOMContentLoaded', function () {
  console.log('🚀 SPA Application Initialized');

  if (!sessionStorage.getItem('isLoggedIn')) {
    window.location.href = 'login.html';
    return;
  }

  renderPageContainers();

  const initialPage = sessionStorage.getItem('currentPage') || 'dashboard';
  if (typeof checkPermission === 'function' && checkPermission(initialPage)) {
    renderPage(initialPage);
  } else {
    const role = typeof normalizeRole === 'function' ? normalizeRole(sessionStorage.getItem('userRole')) : 'viewer';
    const allowed = (typeof PERMISSIONS !== 'undefined' && PERMISSIONS[role]) || ['dashboard'];
    renderPage(allowed[0]);
  }

  setupModalEvents();

  // Auto refresh every 60 seconds
  setInterval(() => {
    const current = sessionStorage.getItem('currentPage');
    if (current === 'request') loadRequestData(true);
    else if (current === 'approval') loadApprovalData();
    else if (current === 'done') loadDoneData();
    else if (current === 'rekap') loadRekapData(true);
    else if (current === 'rejected') loadRejectedData();
  }, 60000);
});

// ============================================
// 12. GLOBAL FUNCTIONS
// ============================================

window.navigateTo = navigateTo;
window.logout = logout;
window.renderUserStatus = renderUserStatus;
window.renderPage = renderPage;
window.openRequestEdit = openRequestEdit;
window.handleLastBuyingOption = handleLastBuyingOption;
window.submitRequestForm = submitRequestForm;
window.approveRequest = approveRequest;
window.rejectRequest = rejectRequest;
window.refreshApprovalData = refreshApprovalData;
window.markDone = markDone;
window.refreshDoneData = refreshDoneData;
window.refreshRekapData = refreshRekapData;
window.refreshRejectedData = refreshRejectedData;
window.exportByPage = exportByPage;

console.log('✅ All functions loaded successfully!');