/**
 * app.js - SPA logic
 * REFACTORED v2.0
 *
 * Fixes:
 * - Variable conflict: `currentPage` (object) → `paginationState`, `activePage` (string)
 * - Generic pagination/table renderers (no more 5x duplication)
 * - Modal untuk markDone/reject/partialComplete (replaces prompt)
 * - No more force-refresh on auto-refresh timer
 * - Pagination/search state preserved saat pindah page (via state object)
 * - Cache consistency: clear all related cache after action
 * - Optimistic update: update UI dulu, kirim request background
 * - No more ad-hoc `delete window.dataCache` - pakai clearCache()
 * - Permission check on navigateTo
 * - Empty state dengan ilustrasi/CTA
 * - Mobile nav lengkap (7 items)
 * - Better error handling
 */

// ============================================
// 0. CEK LOGIN
// ============================================

(function () {
  var isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
  if (typeof debugLog === 'function') debugLog('🔐 App.js - isLoggedIn:', isLoggedIn);

  if (!isLoggedIn) {
    if (typeof debugLog === 'function') debugLog('❌ Not logged in, redirecting to login.html');
    window.location.href = 'login.html';
    return;
  }
})();

// ============================================
// 1. KONFIGURASI DASAR
// ============================================

var HIDDEN_COLUMNS = {
  request: ['DoneBy', 'DoneDate', 'CreatedAt', 'RejectedBy', 'RejectedDate', 'RejectedReason', 'PartOf', 'Requester'],
  approval: ['CreatedAt', 'ApprovedBy', 'ApprovedDate', 'DoneBy', 'DoneDate', 'RejectedBy', 'RejectedDate', 'RejectedReason'],
  done: ['CreatedAt', 'ApprovedBy', 'ApprovedDate', 'DoneBy', 'DoneDate', 'RejectedBy', 'RejectedDate', 'RejectedReason'],
  rekap: ['CreatedAt', 'ApprovedBy', 'ApprovedDate', 'DoneBy', 'DoneDate', 'RejectedBy', 'RejectedDate', 'RejectedReason', 'Requester'],
  rejected: ['DoneBy', 'DoneDate', 'Price', 'Nominal', 'LastBuyingDate', 'Aksi', 'CreatedAt', 'ApprovedBy', 'ApprovedDate']
};

var NUMBER_COLUMNS = ['Qty'];
var CURRENCY_COLUMNS = ['Price', 'Nominal'];
var DATE_COLUMNS = ['LastBuyingDate', 'OrderDate'];
var DATETIME_COLUMNS = ['CreatedAt', 'SubmissionDate', 'ApprovedDate', 'DoneDate', 'RejectedDate'];

// ✅ RENAMED: state object untuk hindari conflict
var appState = {
  data: {},              // allData[pageKey] = []
  filtered: {},          // filteredData[pageKey] = []
  headers: {},           // headers[pageKey] = []
  pagination: {          // pagination[pageKey] = { page, size, search, token }
    request: { page: 1, size: 100, search: '', token: null },
    approval: { page: 1, size: 100, search: '', token: null },
    done: { page: 1, size: 100, search: '', token: null },
    rekap: { page: 1, size: 100, search: '', token: null },
    rejected: { page: 1, size: 100, search: '', token: null }
  },
  editMode: false,
  currentEditId: null,
  activePage: 'dashboard',
  initialized: {}        // initialized[pageKey] = true (apakah sudah pernah render)
};

var MENU_DEF = [
  { id: 'request', page: 'request', icon: '📋', title: 'New Request', desc: 'Create and submit new purchase requests.' },
  { id: 'approval', page: 'approval', icon: '📬', title: 'Approval Hub', desc: 'Central portal to review and approve requests.' },
  { id: 'done', page: 'done', icon: '📦', title: 'Fulfillment', desc: 'Track and finalize procurement steps.' },
  { id: 'rekap', page: 'rekap', icon: '📊', title: 'Report Center', desc: 'Comprehensive analytics and history.' },
  { id: 'rejected', page: 'rejected', icon: '⛔', title: 'Rejection Log', desc: 'Archive of non-fulfillment decisions.' },
  { id: 'print', page: 'print', icon: '📥', title: 'Export & Print', desc: 'Download data purchase request to PDF/Excel.' }
];

// Initialize empty state
['request', 'approval', 'done', 'rekap', 'rejected'].forEach(function (page) {
  appState.data[page] = [];
  appState.filtered[page] = [];
  appState.headers[page] = [];
});

// ============================================
// 2. NAVIGASI & RENDER PAGE
// ============================================

function renderPage(page) {
  if (typeof debugLog === 'function') debugLog('📄 Rendering page:', page);
  appState.activePage = page;

  // Hide all
  document.querySelectorAll('.page-container').forEach(function (el) {
    el.style.display = 'none';
  });

  var container = document.getElementById('page-' + page);
  if (!container) {
    if (typeof debugError === 'function') debugError('Page container not found: page-' + page);
    return;
  }
  container.style.display = 'block';
  sessionStorage.setItem('currentPage', page);

  // ✅ Permission check
  if (typeof checkPermission === 'function' && !checkPermission(page)) {
    container.innerHTML =
      '<div style="text-align:center;padding:60px 20px;">' +
      '<div style="font-size:64px;margin-bottom:16px;">🔒</div>' +
      '<h2 style="color:#dc2626;margin-bottom:8px;">Akses Ditolak</h2>' +
      '<p style="color:#6b7280;">Anda tidak punya izin untuk mengakses halaman ini.</p>' +
      '<button class="btn-primary" style="margin-top:16px;" onclick="navigateTo(\'dashboard\')">Kembali ke Dashboard</button>' +
      '</div>';
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
    default:
      if (typeof debugWarn === 'function') debugWarn('Unknown page:', page);
  }

  if (typeof renderUserStatus === 'function') {
    renderUserStatus();
  }

  // Update mobile nav (function defined in index.html)
  if (typeof window.updateMobileNavGlobal === 'function') {
    window.updateMobileNavGlobal(page);
  }
}

// ============================================
// 3. DASHBOARD
// ============================================

function renderDashboard() {
  var container = document.getElementById('page-dashboard');
  if (!container) return;

  var hour = new Date().getHours();
  var greet = 'Halo';
  if (hour < 11) greet = 'Selamat Pagi';
  else if (hour < 15) greet = 'Selamat Siang';
  else if (hour < 19) greet = 'Selamat Sore';
  else greet = 'Selamat Malam';

  var name = sessionStorage.getItem('fullName') || sessionStorage.getItem('username') || 'Rekan';

  container.innerHTML =
    '<div class="header">' +
      '<div class="logo-section">' +
        '<img src="logo.png" alt="Company Logo" style="width:70px;height:70px;object-fit:contain;margin:0 auto;display:block;">' +
      '</div>' +
      '<div class="greeting-box" style="font-size:2.5rem;font-weight:700;color:#1f2937;display:flex;align-items:center;justify-content:center;gap:12px;">' +
        '<span style="animation:wave 2s infinite;display:inline-block;">👋</span>' +
        '<span>' + _escapeHtml(greet + ', ' + name) + '</span>' +
      '</div>' +
      '<h1 style="font-size:1.5rem;color:#374151;margin-bottom:20px;">Dashboard Utama</h1>' +
      '<p style="color:#6b7280;">Modernized Management Analytics for Purchase Request Operations</p>' +
    '</div>' +
    '<div class="stats-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;margin-bottom:40px;">' +
      _buildStatCard('statPending', '⏳', 'Pending', '#fff7ed', '#c2410c') +
      _buildStatCard('statApproved', '✅', 'Approved', '#eff6ff', '#1d4ed8') +
      _buildStatCard('statDone', '📦', 'Done', '#f0fdf4', '#15803d') +
      _buildStatCard('statRejected', '❌', 'Rejected', '#fef2f2', '#b91c1c') +
    '</div>' +
    '<div class="section-head">' +
      '<h2 style="font-size:1.5rem;color:#374151;margin-bottom:20px;">📋 Pilih Menu</h2>' +
    '</div>' +
    '<div id="menuContainer" class="menu-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;"></div>';

  renderMenu();
  loadDashboardStats();
}

function _buildStatCard(id, icon, label, bg, color) {
  return '<div class="stat-card" style="background:white;border-radius:16px;padding:20px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 4px 6px rgba(0,0,0,0.05);border:1px solid #e5e7eb;">' +
    '<div class="stat-icon-wrapper" style="width:50px;height:50px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;background:' + bg + ';color:' + color + ';">' + icon + '</div>' +
    '<div>' +
      '<div id="' + id + '" class="stat-value" style="font-size:2rem;font-weight:700;line-height:1;color:' + color + ';">0</div>' +
      '<div class="stat-label" style="font-size:0.85rem;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">' + label + '</div>' +
    '</div>' +
  '</div>';
}

function renderMenu() {
  var container = document.getElementById('menuContainer');
  if (!container) return;

  var rawRole = sessionStorage.getItem('userRole') || 'viewer';
  var role = normalizeRole(rawRole);

  var allowedPages = [];
  if (typeof PERMISSIONS !== 'undefined') {
    allowedPages = PERMISSIONS[role] || [];
  }

  if (allowedPages.length === 0) {
    allowedPages = MENU_DEF.map(function (m) { return m.page; });
  }

  var html = MENU_DEF
    .filter(function (menu) { return allowedPages.indexOf(menu.page) !== -1; })
    .map(function (menu) {
      return '<div class="menu-item" onclick="navigateTo(\'' + menu.page + '\')" style="background:white;border-radius:16px;padding:24px;border:1px solid #e5e7eb;display:flex;align-items:center;gap:15px;cursor:pointer;transition:all 0.2s;">' +
        '<div class="menu-item-icon" style="width:50px;height:50px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;background:#f3f4f6;">' + menu.icon + '</div>' +
        '<div class="menu-item-info">' +
        '<h3 style="margin:0 0 4px 0;font-size:1.1rem;">' + _escapeHtml(menu.title) + '</h3>' +
        '<p style="margin:0;font-size:0.85rem;color:#6b7280;">' + _escapeHtml(menu.desc) + '</p>' +
        '</div>' +
        '<div class="menu-item-arrow" style="margin-left:auto;color:#d1d5db;font-weight:bold;">→</div>' +
        '</div>';
    })
    .join('');

  container.innerHTML = html || '<p style="color:#6b7280;">Tidak ada menu tersedia</p>';
}

function loadDashboardStats() {
  var stats = { pending: 0, approved: 0, done: 0, rejected: 0 };
  var seenIds = new Set();

  loadMultipleSheets(['', 'done', 'rejected'], function (results) {
    (results[''] || []).forEach(function (item) {
      if (item && item.ID && !seenIds.has(item.ID)) {
        var status = (item.Status || '').toLowerCase().trim();
        if (stats.hasOwnProperty(status)) {
          stats[status]++;
          seenIds.add(item.ID);
        }
      }
    });

    (results['done'] || []).forEach(function (item) {
      if (item && item.ID) stats.done++;
    });

    (results['rejected'] || []).forEach(function (item) {
      if (item && item.ID) stats.rejected++;
    });

    var el;
    if ((el = document.getElementById('statPending'))) el.textContent = stats.pending;
    if ((el = document.getElementById('statApproved'))) el.textContent = stats.approved;
    if ((el = document.getElementById('statDone'))) el.textContent = stats.done;
    if ((el = document.getElementById('statRejected'))) el.textContent = stats.rejected;
  });
}

// ============================================
// 4. GENERIC TABLE RENDERER
// ============================================

/**
 * ✅ NEW: Generic renderer untuk semua tabel page
 * @param {string} pageKey - request, approval, done, rekap, rejected
 */
function renderTableGeneric(pageKey) {
  var state = appState.pagination[pageKey];
  var thead = document.getElementById(pageKey + '-thead');
  var tbody = document.getElementById(pageKey + '-tbody');
  if (!thead || !tbody) return;

  var headers = appState.headers[pageKey] || [];

  // Build header
  var headerHtml = headers.map(function (h) {
    var html = '<th>' + _escapeHtml(h) + '</th>';
    if (h === 'ID') html += '<th>Aksi</th>';
    return html;
  }).join('');
  thead.innerHTML = '<tr>' + headerHtml + '</tr>';

  // Slice page
  var start = (state.page - 1) * state.size;
  var pageData = appState.filtered[pageKey].slice(start, start + state.size);

  if (!pageData.length) {
    var emptyMsg = _getEmptyMessage(pageKey);
    tbody.innerHTML =
      '<tr><td colspan="' + (headers.length + 1) + '" class="text-center" style="padding:40px 20px;">' +
      '<div style="font-size:48px;margin-bottom:8px;opacity:0.3;">📭</div>' +
      '<div style="color:#6b7280;font-weight:600;">' + emptyMsg + '</div>' +
      '</td></tr>';
    return;
  }

  // Build rows
  var rowsHtml = pageData.map(function (row) {
    var cellsHtml = headers.map(function (h) {
      var v = row[h] || '';
      var cls = '';

      if (DATETIME_COLUMNS.indexOf(h) !== -1) {
        v = formatDateTime(v); cls = 'text-center';
      } else if (DATE_COLUMNS.indexOf(h) !== -1) {
        v = formatDate(v); cls = 'text-center';
      }
      if (NUMBER_COLUMNS.indexOf(h) !== -1) {
        v = formatNumber(v); cls = 'text-right';
      }
      if (CURRENCY_COLUMNS.indexOf(h) !== -1) {
        v = formatRupiah(v); cls = 'text-right';
      }
      if (h === 'Items' || h === 'Description' || h === 'RejectedReason') cls += ' truncate';

      var displayV = (typeof v === 'string') ? _escapeHtml(v) : v;
      var cell = '<td class="' + cls + '" title="' + displayV + '">' + displayV + '</td>';

      if (h === 'Status') {
        var statusClass = String(v).toLowerCase();
        cell = '<td class="text-center"><span class="status ' + statusClass + '">' + displayV + '</span></td>';
      }

      if (h === 'ID') {
        cell += '<td class="text-center" style="white-space:nowrap;">' + _renderRowActions(pageKey, row) + '</td>';
      }

      return cell;
    }).join('');
    return '<tr data-id="' + _escapeHtml(row.ID || '') + '">' + cellsHtml + '</tr>';
  });

  // ✅ Cancel previous render via token
  if (state.token) state.token.cancelled = true;
  var newToken = { cancelled: false };
  state.token = newToken;

  lazyRenderRows(rowsHtml, tbody, 50, newToken);
}

function _getEmptyMessage(pageKey) {
  var msgs = {
    request: 'Belum ada data permintaan. Klik "Tambah Permintaan" untuk membuat baru.',
    approval: 'Tidak ada request pending untuk di-approve.',
    done: 'Tidak ada request approved untuk di-process.',
    rekap: 'Belum ada data rekap (request yang sudah Done).',
    rejected: 'Tidak ada request yang ditolak.'
  };
  return msgs[pageKey] || 'Data tidak ditemukan';
}

function _renderRowActions(pageKey, row) {
  var id = _escapeHtml(row.ID);
  switch (pageKey) {
    case 'request':
      return '<button class="btn-secondary btn-xs" onclick="openRequestEdit(\'' + id + '\')" title="Edit">✏️</button>';
    case 'approval':
      return '<button class="btn-primary btn-xs" onclick="approveRequest(\'' + id + '\')" title="Approve">✅</button>' +
             '<button class="btn-secondary btn-xs" onclick="rejectRequest(\'' + id + '\')" title="Reject" style="margin-left:4px;">❌</button>';
    case 'done':
      return '<button class="btn-primary btn-xs" onclick="markDone(\'' + id + '\')" title="Mark Done">📦</button>';
    default:
      return '';
  }
}

// ============================================
// 5. GENERIC PAGINATION
// ============================================

function renderPaginationGeneric(pageKey) {
  var state = appState.pagination[pageKey];
  var container = document.getElementById('pagination-' + pageKey);
  var info = document.getElementById('infoText-' + pageKey);
  if (!container || !info) return;

  var total = appState.filtered[pageKey].length;
  var totalPages = Math.max(1, Math.ceil(total / state.size));
  var start = total === 0 ? 0 : (state.page - 1) * state.size + 1;
  var end = Math.min(start + state.size - 1, total);

  info.textContent = 'Menampilkan ' + start + '–' + end + ' dari ' + total + ' data';

  container.innerHTML = '';

  // Prev button
  if (state.page > 1) {
    var prevBtn = document.createElement('button');
    prevBtn.textContent = '←';
    prevBtn.className = 'pagination-btn';
    prevBtn.onclick = function () {
      state.page--;
      renderTableGeneric(pageKey);
      renderPaginationGeneric(pageKey);
    };
    container.appendChild(prevBtn);
  }

  // Page numbers with ellipsis
  for (var i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= state.page - 2 && i <= state.page + 2)) {
      var b = document.createElement('button');
      b.textContent = i;
      b.className = 'pagination-btn';
      if (i === state.page) b.classList.add('active');
      b.onclick = (function (page) {
        return function () {
          state.page = page;
          renderTableGeneric(pageKey);
          renderPaginationGeneric(pageKey);
        };
      })(i);
      container.appendChild(b);
    } else if (i === state.page - 3 || i === state.page + 3) {
      var ellipsis = document.createElement('span');
      ellipsis.textContent = '...';
      ellipsis.style.margin = '0 4px';
      ellipsis.style.color = '#6b7280';
      container.appendChild(ellipsis);
    }
  }

  // Next button
  if (state.page < totalPages) {
    var nextBtn = document.createElement('button');
    nextBtn.textContent = '→';
    nextBtn.className = 'pagination-btn';
    nextBtn.onclick = function () {
      state.page++;
      renderTableGeneric(pageKey);
      renderPaginationGeneric(pageKey);
    };
    container.appendChild(nextBtn);
  }
}

// ============================================
// 6. PAGE BUILDERS (Header + Filter + Table container)
// ============================================

function _buildPageHeader(title, subtitle, pageKey) {
  if (!pageKey) pageKey = '';
  return '<div class="head-bar" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">' +
    '<div style="display:flex;align-items:center;gap:12px;">' +
      '<img src="logo.png" alt="Company Logo" style="width:48px;height:48px;object-fit:contain;">' +
      '<div>' +
        '<h2 style="margin:0;font-size:1.5rem;color:#1f2937;">' + _escapeHtml(title) + '</h2>' +
        '<p style="margin:0;font-size:0.85rem;color:#6b7280;font-weight:400;">' + _escapeHtml(subtitle) + '</p>' +
      '</div>' +
    '</div>' +
    '<div class="head-actions" style="display:flex;gap:12px;">' +
      '<button onclick="navigateTo(\'dashboard\')" class="btn-secondary btn-link" style="text-decoration:none;display:flex;align-items:center;gap:6px;">← Dashboard</button>' +
      '<button onclick="refreshActiveTable(\'' + pageKey + '\', false)" class="btn-secondary" style="display:flex;align-items:center;gap:6px;">🔄 Refresh</button>' +
    '</div>' +
  '</div>';
}

function _buildFilterBar(pageKey) {
  return '<div class="filter-bar" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
    '<div style="display:flex;align-items:center;gap:8px;color:#6b7280;font-size:0.9rem;">' +
      'Tampilkan' +
      '<select id="pageSize-' + pageKey + '" style="padding:6px 12px;border:1px solid #d1d5db;border-radius:6px;background:white;color:#374151;font-size:0.9rem;">' +
        '<option value="10">10</option>' +
        '<option value="25">25</option>' +
        '<option value="50">50</option>' +
        '<option value="100">100</option>' +
        '<option value="200">200</option>' +
        '<option value="500">500</option>' +
      '</select>' +
      'data' +
    '</div>' +
    '<div style="display:flex;align-items:center;gap:8px;">' +
      '<span style="color:#6b7280;font-size:0.9rem;">🔍</span>' +
      '<input type="text" id="search-' + pageKey + '" placeholder="Cari data..." style="padding:8px 16px;border:1px solid #d1d5db;border-radius:8px;background:#f9fafb;min-width:250px;font-size:0.9rem;">' +
    '</div>' +
  '</div>';
}

function _buildTableContainer(pageKey, emptyColspanSuffix) {
  var colspan = emptyColspanSuffix || 1;
  return '<div class="table-wrapper">' +
    '<table>' +
      '<thead id="' + pageKey + '-thead"></thead>' +
      '<tbody id="' + pageKey + '-tbody"></tbody>' +
    '</table>' +
  '</div>' +
  '<div class="table-bottom">' +
    '<div id="infoText-' + pageKey + '"></div>' +
    '<div id="pagination-' + pageKey + '"></div>' +
  '</div>';
}

// ============================================
// 7. REQUEST PAGE
// ============================================

function renderRequestPage() {
  var container = document.getElementById('page-request');
  if (!container) return;

  var header = _buildPageHeader('Purchase Request', 'Daftar permintaan pembelian barang', 'request');
  // Tambah tombol Add di header actions
  header = header.replace(
    '<button onclick="navigateTo(\'dashboard\')"',
    '<button id="btnAdd" class="btn-primary" style="display:flex;align-items:center;gap:8px;"><span style="font-size:18px;">+</span> Tambah Permintaan</button>' +
    '<button onclick="navigateTo(\'dashboard\')"'
  );

  container.innerHTML = header + _buildFilterBar('request') + _buildTableContainer('request');

  // ✅ Restore search & pageSize dari state
  var state = appState.pagination.request;
  document.getElementById('pageSize-request').value = state.size;
  document.getElementById('search-request').value = state.search;

  // Event listeners
  document.getElementById('btnAdd').addEventListener('click', function () { openRequestModal(); });
  document.getElementById('pageSize-request').addEventListener('change', function (e) {
    state.size = Number(e.target.value);
    state.page = 1;
    renderTableGeneric('request');
    renderPaginationGeneric('request');
  });
  document.getElementById('search-request').addEventListener('input', debounceSearch(function (e) {
    _onSearch('request', e.target.value);
  }, 300));

  loadRequestData();
}

function loadRequestData(forceRefresh) {
  if (forceRefresh === undefined) forceRefresh = false;

  if (forceRefresh) {
    clearCache('main');
  }

  loadDataOptimized(function (data) {
    appState.data.request = data || [];
    appState.filtered.request = appState.data.request.slice();

    if (appState.data.request.length > 0) {
      appState.headers.request = Object.keys(appState.data.request[0] || {}).filter(function (h) {
        return HIDDEN_COLUMNS.request.indexOf(h) === -1;
      });
    } else {
      appState.headers.request = [];
    }

    // ✅ Re-apply search filter kalau ada
    var state = appState.pagination.request;
    if (state.search) {
      _applySearchFilter('request', state.search);
    } else {
      appState.filtered.request = appState.data.request.slice();
    }

    renderTableGeneric('request');
    renderPaginationGeneric('request');
  });
}

function _onSearch(pageKey, query) {
  appState.pagination[pageKey].page = 1;
  appState.pagination[pageKey].search = query;
  _applySearchFilter(pageKey, query);
  renderTableGeneric(pageKey);
  renderPaginationGeneric(pageKey);
}

function _applySearchFilter(pageKey, query) {
  var q = (query || '').toLowerCase().trim();
  if (!q) {
    appState.filtered[pageKey] = appState.data[pageKey].slice();
    return;
  }
  var headers = appState.headers[pageKey];
  appState.filtered[pageKey] = appState.data[pageKey].filter(function (r) {
    var text = headers.map(function (h) { return r[h]; }).join(' ').toLowerCase();
    return text.indexOf(q) !== -1;
  });
}

// ============================================
// 8. REQUEST MODAL
// ============================================

function openRequestModal(row) {
  var modal = document.getElementById('requestModal');
  if (!modal) return;

  if (row) {
    appState.editMode = true;
    appState.currentEditId = row.ID;
    populateRequestForm(row);
  } else {
    appState.editMode = false;
    appState.currentEditId = null;
    clearRequestForm();
  }
  modal.classList.add('show');
}

function closeRequestModal() {
  var modal = document.getElementById('requestModal');
  if (modal) modal.classList.remove('show');
}

function populateRequestForm(row) {
  document.getElementById('formID').value = row.ID || '';
  ['Department', 'Office', 'Items', 'PartOf', 'Description', 'Qty', 'Unit', 'Price', 'Priority', 'OrderBy'].forEach(function (name) {
    var el = document.querySelector('[name="' + name + '"]');
    if (el) el.value = row[name] || '';
  });

  handleLastBuyingDateFallback(row.LastBuyingDate || '');

  var orderDateInput = document.querySelector('[name="OrderDate"]');
  if (orderDateInput) {
    orderDateInput.value = parseDateForInput(row.OrderDate);
  }
}

function clearRequestForm() {
  var form = document.getElementById('prForm');
  if (form) form.reset();
  document.getElementById('formID').value = '';

  var dateInput = document.getElementById('lastBuyingDate');
  var optionSelect = document.getElementById('lastBuyingOption');
  if (optionSelect) optionSelect.value = 'date';
  if (dateInput) {
    dateInput.disabled = false;
    dateInput.value = '';
    dateInput.style.backgroundColor = '#fff';
  }

  var today = new Date().toISOString().split('T')[0];
  var orderDateInput = document.querySelector('[name="OrderDate"]');
  if (orderDateInput) orderDateInput.value = today;
}

function handleLastBuyingDateFallback(value) {
  var optionSelect = document.getElementById('lastBuyingOption');
  var dateInput = document.getElementById('lastBuyingDate');
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
  var d = new Date(dateValue);
  if (!isNaN(d.getTime())) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  return '';
}

function handleLastBuyingOption() {
  var option = document.getElementById('lastBuyingOption').value;
  var dateInput = document.getElementById('lastBuyingDate');
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
  var form = document.getElementById('prForm');
  var fd = new FormData(form);

  if (appState.editMode && appState.currentEditId) {
    fd.append('ID', appState.currentEditId);
    fd.append('action', 'update');
  } else {
    fd.append('action', 'create');
  }

  var username = sessionStorage.getItem('username') || 'User';
  fd.append('Requester', username);
  fd.append('UpdatedBy', username);

  var option = document.getElementById('lastBuyingOption').value;
  var dateInput = document.getElementById('lastBuyingDate');
  var hiddenInput = document.getElementById('lastBuyingDateHidden');
  if (option === 'never') {
    hiddenInput.value = 'Never Buy';
  } else if (dateInput.value) {
    hiddenInput.value = dateInput.value;
  }

  showToast(appState.editMode ? 'Memperbarui data...' : 'Menyimpan data baru...', 'warning');

  try {
    var response = await fetch(API_URL, { method: 'POST', body: fd });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    var result = await response.text();
    if (typeof debugLog === 'function') debugLog('✅ Form submitted:', result);

    showToast('Data berhasil disimpan', 'success');
    closeRequestModal();

    // ✅ Clear ALL related cache (main, done, rejected all可能 affected)
    clearCacheForAction();

    setTimeout(function () { loadRequestData(true); }, 500);
  } catch (error) {
    if (typeof debugError === 'function') debugError('❌ Submission error:', error);
    showToast('Gagal: ' + error.message, 'error');
  }
}

function openRequestEdit(id) {
  var row = appState.data.request.find(function (r) { return r.ID === id; });
  if (!row) {
    showToast('Data tidak ditemukan', 'error');
    return;
  }
  openRequestModal(row);
}

// ============================================
// 9. APPROVAL PAGE
// ============================================

function renderApprovalPage() {
  var container = document.getElementById('page-approval');
  if (!container) return;

  container.innerHTML = _buildPageHeader('Approval Purchase Request', 'Review dan approve permintaan', 'approval') +
    _buildFilterBar('approval') + _buildTableContainer('approval');

  var state = appState.pagination.approval;
  document.getElementById('pageSize-approval').value = state.size;
  document.getElementById('search-approval').value = state.search;

  document.getElementById('pageSize-approval').addEventListener('change', function (e) {
    state.size = Number(e.target.value);
    state.page = 1;
    renderTableGeneric('approval');
    renderPaginationGeneric('approval');
  });
  document.getElementById('search-approval').addEventListener('input', debounceSearch(function (e) {
    _onSearch('approval', e.target.value);
  }, 300));

  loadApprovalData();
}

function loadApprovalData() {
  loadDataOptimized(function (data) {
    appState.data.approval = (data || []).filter(function (d) { return d.Status === 'pending'; });
    appState.filtered.approval = appState.data.approval.slice();

    if (appState.data.approval.length > 0) {
      appState.headers.approval = Object.keys(appState.data.approval[0] || {}).filter(function (h) {
        return HIDDEN_COLUMNS.approval.indexOf(h) === -1;
      });
    } else {
      appState.headers.approval = [];
    }

    var state = appState.pagination.approval;
    if (state.search) _applySearchFilter('approval', state.search);

    renderTableGeneric('approval');
    renderPaginationGeneric('approval');
  });
}

async function approveRequest(id) {
  var name = sessionStorage.getItem('username') || 'User';

  confirmDialog({
    title: 'Konfirmasi Approve',
    message: 'Approve request <strong>#' + _escapeHtml(id) + '</strong>?',
    confirmText: '✅ Approve',
    type: 'info',
    onConfirm: function () {
      var fd = new FormData();
      fd.append('ID', id);
      fd.append('Status', 'approved');
      fd.append('ApprovedBy', name);
      submitApprovalAction(fd, 'Request berhasil di-approve');
    }
  });
}

async function rejectRequest(id) {
  var name = sessionStorage.getItem('username') || 'User';

  confirmDialog({
    title: 'Konfirmasi Reject',
    message: 'Reject request <strong>#' + _escapeHtml(id) + '</strong>?',
    confirmText: '❌ Reject',
    type: 'danger',
    input: {
      label: 'Alasan Reject',
      placeholder: 'Tulis alasan penolakan...',
      type: 'text',
      validate: function (val) {
        if (!val || !val.trim()) return 'Alasan reject wajib diisi';
        if (val.length < 3) return 'Alasan terlalu pendek (min 3 karakter)';
        return null;
      }
    },
    onConfirm: function (reason) {
      var fd = new FormData();
      fd.append('ID', id);
      fd.append('Status', 'rejected');
      fd.append('RejectedBy', name);
      fd.append('RejectedReason', reason);
      submitApprovalAction(fd, 'Request berhasil di-reject');
    }
  });
}

async function submitApprovalAction(fd, successMsg) {
  try {
    showToast('Memproses...', 'warning');
    var res = await fetch(API_URL, { method: 'POST', body: fd });
    if (!res.ok) throw new Error('Gagal update');
    showToast(successMsg, 'success');

    // ✅ Clear all related cache
    clearCacheForAction();

    // ✅ Optimistic: remove from approval list immediately
    var id = fd.get('ID');
    appState.data.approval = appState.data.approval.filter(function (r) { return r.ID !== id; });
    appState.filtered.approval = appState.filtered.approval.filter(function (r) { return r.ID !== id; });
    renderTableGeneric('approval');
    renderPaginationGeneric('approval');

    // Still reload to ensure consistency
    setTimeout(loadApprovalData, 500);
  } catch (err) {
    if (typeof debugError === 'function') debugError('Approval error:', err);
    showToast('Gagal: ' + err.message, 'error');
  }
}

// ============================================
// 10. DONE PAGE
// ============================================

function renderDonePage() {
  var container = document.getElementById('page-done');
  if (!container) return;

  container.innerHTML = _buildPageHeader('Done Purchase Request', 'Kelola request yang sudah di-approve', 'done') +
    _buildFilterBar('done') + _buildTableContainer('done');

  var state = appState.pagination.done;
  document.getElementById('pageSize-done').value = state.size;
  document.getElementById('search-done').value = state.search;

  document.getElementById('pageSize-done').addEventListener('change', function (e) {
    state.size = Number(e.target.value);
    state.page = 1;
    renderTableGeneric('done');
    renderPaginationGeneric('done');
  });
  document.getElementById('search-done').addEventListener('input', debounceSearch(function (e) {
    _onSearch('done', e.target.value);
  }, 300));

  loadDoneData();
}

function loadDoneData() {
  loadDataOptimized(function (data) {
    appState.data.done = (data || []).filter(function (d) { return d.Status === 'approved'; });
    appState.filtered.done = appState.data.done.slice();

    if (appState.data.done.length > 0) {
      appState.headers.done = Object.keys(appState.data.done[0] || {}).filter(function (h) {
        return HIDDEN_COLUMNS.done.indexOf(h) === -1;
      });
    } else {
      appState.headers.done = [];
    }

    var state = appState.pagination.done;
    if (state.search) _applySearchFilter('done', state.search);

    renderTableGeneric('done');
    renderPaginationGeneric('done');
  });
}

function markDone(id) {
  // ✅ Use modal instead of prompt with numeric choice
  var data = appState.data.done.find(function (d) { return d.ID === id; });
  if (!data) {
    showToast('Data tidak ditemukan', 'error');
    return;
  }

  confirmDialog({
    title: 'Tandai Selesai',
    message: 'Pilih aksi untuk request <strong>#' + _escapeHtml(id) + '</strong> (Qty: ' + _escapeHtml(data.Qty) + '):',
    confirmText: 'Completed',
    cancelText: 'Partial',
    type: 'info',
    onConfirm: function () {
      completeAll(id);
    },
    onCancel: function () {
      partialComplete(id);
    }
  });
}

async function completeAll(id) {
  var user = sessionStorage.getItem('username') || 'User';

  confirmDialog({
    title: 'Konfirmasi Completed',
    message: 'Tandai request <strong>#' + _escapeHtml(id) + '</strong> sebagai <strong>Completed</strong> (semua qty dibeli)?',
    confirmText: 'Ya, Completed',
    type: 'info',
    onConfirm: async function () {
      var fd = new FormData();
      fd.append('ID', id);
      fd.append('Status', 'done');
      fd.append('DoneBy', user);
      await submitDoneAction(fd, 'Request selesai (Completed)');
    }
  });
}

async function partialComplete(id) {
  var data = appState.data.done.find(function (d) { return d.ID === id; });
  if (!data) return;

  confirmDialog({
    title: 'Partial Complete',
    message: 'Qty dibeli (maks ' + _escapeHtml(data.Qty) + '):',
    confirmText: 'Submit Partial',
    type: 'info',
    input: {
      label: 'Qty Dibeli',
      placeholder: 'Masukkan qty (1 - ' + data.Qty + ')',
      type: 'number',
      validate: function (val) {
        var n = Number(val);
        if (!val || isNaN(n)) return 'Harus angka';
        if (n <= 0) return 'Qty harus > 0';
        if (n >= data.Qty) return 'Qty harus < ' + data.Qty + ' (gunakan Completed)';
        return null;
      }
    },
    onConfirm: async function (boughtQtyStr) {
      var boughtQty = Number(boughtQtyStr);
      var user = sessionStorage.getItem('username') || 'User';

      var fd = new FormData();
      fd.append('ID', id);
      fd.append('Status', 'partial');
      fd.append('BoughtQty', boughtQty);
      fd.append('RemainingQty', data.Qty - boughtQty);
      fd.append('DoneBy', user);
      await submitDoneAction(fd, 'Partial request berhasil');
    }
  });
}

async function submitDoneAction(fd, successMsg) {
  try {
    showToast('Memproses...', 'warning');
    var res = await fetch(API_URL, { method: 'POST', body: fd });
    if (!res.ok) throw new Error('Gagal update');
    showToast(successMsg, 'success');

    clearCacheForAction();

    // Optimistic remove from done list
    var id = fd.get('ID');
    appState.data.done = appState.data.done.filter(function (r) { return r.ID !== id; });
    appState.filtered.done = appState.filtered.done.filter(function (r) { return r.ID !== id; });
    renderTableGeneric('done');
    renderPaginationGeneric('done');

    setTimeout(loadDoneData, 500);
  } catch (err) {
    if (typeof debugError === 'function') debugError('Done action error:', err);
    showToast('Error: ' + err.message, 'error');
  }
}

// ============================================
// 11. REKAP PAGE
// ============================================

function renderRekapPage() {
  var container = document.getElementById('page-rekap');
  if (!container) return;

  container.innerHTML = _buildPageHeader('Rekapan Purchase Request', 'Data request yang sudah selesai (Done)', 'rekap') +
    _buildFilterBar('rekap') + _buildTableContainer('rekap');

  var state = appState.pagination.rekap;
  document.getElementById('pageSize-rekap').value = state.size;
  document.getElementById('search-rekap').value = state.search;

  document.getElementById('pageSize-rekap').addEventListener('change', function (e) {
    state.size = Number(e.target.value);
    state.page = 1;
    renderTableGeneric('rekap');
    renderPaginationGeneric('rekap');
  });
  document.getElementById('search-rekap').addEventListener('input', debounceSearch(function (e) {
    _onSearch('rekap', e.target.value);
  }, 300));

  loadRekapData();
}

function loadRekapData(forceRefresh) {
  if (forceRefresh === undefined) forceRefresh = false;
  if (forceRefresh) clearCache('done');

  loadDataOptimized(function (data) {
    appState.data.rekap = data || [];
    appState.filtered.rekap = appState.data.rekap.slice();

    if (appState.data.rekap.length > 0) {
      appState.headers.rekap = Object.keys(appState.data.rekap[0] || {}).filter(function (h) {
        return HIDDEN_COLUMNS.rekap.indexOf(h) === -1;
      });
    } else {
      appState.headers.rekap = [];
    }

    var state = appState.pagination.rekap;
    if (state.search) _applySearchFilter('rekap', state.search);

    renderTableGeneric('rekap');
    renderPaginationGeneric('rekap');
  }, 'done');
}

// ============================================
// 12. REJECTED PAGE
// ============================================

function renderRejectedPage() {
  var container = document.getElementById('page-rejected');
  if (!container) return;

  container.innerHTML = _buildPageHeader('Rejected Purchase Request', 'Data request yang ditolak', 'rejected') +
    _buildFilterBar('rejected') + _buildTableContainer('rejected');

  var state = appState.pagination.rejected;
  document.getElementById('pageSize-rejected').value = state.size;
  document.getElementById('search-rejected').value = state.search;

  document.getElementById('pageSize-rejected').addEventListener('change', function (e) {
    state.size = Number(e.target.value);
    state.page = 1;
    renderTableGeneric('rejected');
    renderPaginationGeneric('rejected');
  });
  document.getElementById('search-rejected').addEventListener('input', debounceSearch(function (e) {
    _onSearch('rejected', e.target.value);
  }, 300));

  loadRejectedData();
}

function loadRejectedData() {
  loadDataOptimized(function (data) {
    appState.data.rejected = data || [];
    appState.filtered.rejected = appState.data.rejected.slice();

    if (appState.data.rejected.length > 0) {
      appState.headers.rejected = Object.keys(appState.data.rejected[0] || {}).filter(function (h) {
        return HIDDEN_COLUMNS.rejected.indexOf(h) === -1;
      });
    } else {
      appState.headers.rejected = [];
    }

    var state = appState.pagination.rejected;
    if (state.search) _applySearchFilter('rejected', state.search);

    renderTableGeneric('rejected');
    renderPaginationGeneric('rejected');
  }, 'rejected');
}

// ============================================
// 13. PRINT/EXPORT PAGE
// ============================================

function renderPrintPage() {
  var container = document.getElementById('page-print');
  if (!container) return;

  container.innerHTML =
    '<div class="header" style="text-align:center;margin-bottom:40px;">' +
      '<div class="logo-container" style="margin-bottom:20px;">' +
        '<img src="logo.png" alt="Company Logo" style="width:80px;height:80px;object-fit:contain;margin:0 auto;display:block;">' +
      '</div>' +
      '<h1 style="font-size:2.5rem;font-weight:700;color:#0c4a6e;margin-bottom:10px;display:flex;align-items:center;justify-content:center;gap:12px;">' +
        '<span>📄</span> Export Data PDF' +
      '</h1>' +
      '<p style="font-size:1rem;color:#0369a1;">Download data purchase request sesuai tampilan tabel halaman</p>' +
    '</div>' +
    '<div class="card" style="background:white;border-radius:16px;padding:32px;border:1px solid #cffafe;box-shadow:0 4px 12px rgba(0,0,0,0.08);">' +
      '<div class="buttons-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:32px;">' +
        '<button class="btn btn-request" onclick="exportByPage(\'request\')" style="display:flex;flex-direction:row;align-items:center;justify-content:center;gap:8px;padding:16px 20px;border:none;border-radius:12px;font-weight:600;font-size:0.9rem;cursor:pointer;transition:all 0.3s;text-align:center;line-height:1.2;min-height:56px;background:linear-gradient(135deg,#a8e6d8,#7ddcd0);color:#0d5046;box-shadow:0 4px 6px rgba(120,220,200,0.3);">' +
          '📄 Export Request' +
        '</button>' +
        '<button class="btn btn-approval" onclick="exportByPage(\'approval\')" style="display:flex;flex-direction:row;align-items:center;justify-content:center;gap:8px;padding:16px 20px;border:none;border-radius:12px;font-weight:600;font-size:0.9rem;cursor:pointer;transition:all 0.3s;text-align:center;line-height:1.2;min-height:56px;background:linear-gradient(135deg,#f5bfda,#f0a8d0);color:#5f1841;box-shadow:0 4px 6px rgba(245,191,218,0.3);">' +
          '📄 Export Approval' +
        '</button>' +
        '<button class="btn btn-rekap" onclick="exportByPage(\'rekap\')" style="display:flex;flex-direction:row;align-items:center;justify-content:center;gap:8px;padding:16px 20px;border:none;border-radius:12px;font-weight:600;font-size:0.9rem;cursor:pointer;transition:all 0.3s;text-align:center;line-height:1.2;min-height:56px;background:linear-gradient(135deg,#fed9b1,#fcc886);color:#5a2700;box-shadow:0 4px 6px rgba(254,217,177,0.3);">' +
          '📄 Export Rekap' +
        '</button>' +
        '<button class="btn btn-rejected" onclick="exportByPage(\'rejected\')" style="display:flex;flex-direction:row;align-items:center;justify-content:center;gap:8px;padding:16px 20px;border:none;border-radius:12px;font-weight:600;font-size:0.9rem;cursor:pointer;transition:all 0.3s;text-align:center;line-height:1.2;min-height:56px;background:linear-gradient(135deg,#f5bfbf,#f0a5a5);color:#5a1111;box-shadow:0 4px 6px rgba(245,191,191,0.3);">' +
          '📄 Export Rejected' +
        '</button>' +
      '</div>' +
      '<div class="info-box" style="background:linear-gradient(135deg,#f0fdf4 0%,#f5fdf7 100%);border:1px solid #d1fce8;border-radius:12px;padding:24px;margin-top:24px;">' +
        '<h3 style="color:#134e4a;font-size:1.1rem;margin-bottom:16px;display:flex;align-items:center;gap:8px;">📋 Penjelasan Setiap Export:</h3>' +
        '<ul style="list-style:none;padding:0;">' +
          '<li style="color:#166534;padding:8px 0;line-height:1.6;"><strong style="color:#15803d;">📄 Export Request</strong><br>Export data pending dari halaman New Request</li>' +
          '<li style="color:#166534;padding:8px 0;line-height:1.6;"><strong style="color:#15803d;">📄 Export Approval</strong><br>Export data yang sudah approval</li>' +
          '<li style="color:#166534;padding:8px 0;line-height:1.6;"><strong style="color:#15803d;">📄 Export Rekap</strong><br>Export data barang yang sudah di Done</li>' +
          '<li style="color:#166534;padding:8px 0;line-height:1.6;"><strong style="color:#15803d;">📄 Export Rejected</strong><br>Export data reject</li>' +
        '</ul>' +
      '</div>' +
      '<div class="info-box" style="background:linear-gradient(135deg,#fef3c7 0%,#fffbeb 100%);border-color:#fcd34d;border-radius:12px;padding:24px;margin-top:24px;">' +
        '<h3 style="color:#92400e;font-size:1.1rem;margin-bottom:16px;display:flex;align-items:center;gap:8px;">ℹ️ Informasi Teknis:</h3>' +
        '<ul style="list-style:none;padding:0;color:#78350f;">' +
          '<li style="padding:8px 0;line-height:1.6;">✓ Format: <strong>PDF Landscape</strong></li>' +
          '<li style="padding:8px 0;line-height:1.6;">✓ Kolom: <strong>Hanya sampai Status (kolom utama)</strong></li>' +
          '<li style="padding:8px 0;line-height:1.6;">✓ Format Rupiah: <strong>Rp dengan pemisah ribuan</strong></li>' +
          '<li style="padding:8px 0;line-height:1.6;">✓ Format Tanggal: <strong>DD/MM/YYYY (Order Date & Last Buying Date)</strong></li>' +
          '<li style="padding:8px 0;line-height:1.6;">✓ Nama file otomatis dengan tanggal dan jam download</li>' +
        '</ul>' +
      '</div>' +
    '</div>';
}

async function exportByPage(pageKey) {
  var sheetMap = { request: '', approval: '', rekap: 'done', rejected: 'rejected' };
  var filterMap = { request: 'pending', approval: 'approved', rekap: null, rejected: null };
  var titleMap = {
    request: 'Purchase Request - New Request',
    approval: 'Purchase Request - Approval Hub',
    rekap: 'Purchase Request - Report Center',
    rejected: 'Purchase Request - Rejection Log'
  };

  var btn = document.querySelector('.btn-' + pageKey);
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Memproses...';
  }

  try {
    showToast('⏳ Mengekspor ' + pageKey + '...', 'warning');

    var data = await fetchExportData(sheetMap[pageKey]);
    var htmlContent = createExportTable(data, filterMap[pageKey], titleMap[pageKey]);

    var timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    generatePDF(htmlContent, 'Purchase-Request-' + pageKey + '-' + timestamp + '.pdf');

    showToast('✅ Export ' + pageKey + ' berhasil!', 'success');
  } catch (err) {
    if (typeof debugError === 'function') debugError('Export error:', err);
    showToast('❌ ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '📄 Export ' + pageKey.charAt(0).toUpperCase() + pageKey.slice(1);
    }
  }
}

function fetchExportData(sheetName) {
  if (sheetName === undefined) sheetName = '';
  return new Promise(function (resolve, reject) {
    var callbackName = 'cb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    var isResolved = false;
    var timeoutId = null;

    window[callbackName] = function (data) {
      if (isResolved) return;
      isResolved = true;
      if (timeoutId) clearTimeout(timeoutId);
      delete window[callbackName];
      var scriptEl = document.getElementById('script-' + callbackName);
      if (scriptEl && scriptEl.parentNode) scriptEl.parentNode.removeChild(scriptEl);
      resolve(data || []);
    };

    timeoutId = setTimeout(function () {
      if (!isResolved) {
        isResolved = true;
        delete window[callbackName];
        var scriptEl = document.getElementById('script-' + callbackName);
        if (scriptEl && scriptEl.parentNode) scriptEl.parentNode.removeChild(scriptEl);
        reject(new Error('Timeout - data tidak diterima'));
      }
    }, 15000);

    try {
      var url = new URL(API_URL);
      url.searchParams.set('action', 'read');
      url.searchParams.set('callback', callbackName);
      if (sheetName) url.searchParams.set('sheet', sheetName);
      url.searchParams.set('_t', Date.now());

      var script = document.createElement('script');
      script.id = 'script-' + callbackName;
      script.src = url.toString();
      script.async = true;
      script.onerror = function () {
        if (!isResolved) {
          isResolved = true;
          if (timeoutId) clearTimeout(timeoutId);
          delete window[callbackName];
          if (script.parentNode) script.parentNode.removeChild(script);
          reject(new Error('Gagal mengambil data'));
        }
      };

      script.onload = function () { if (timeoutId) clearTimeout(timeoutId); };
      document.body.appendChild(script);
    } catch (err) {
      if (!isResolved) {
        isResolved = true;
        reject(err);
      }
    }
  });
}

function createExportTable(data, filter, title) {
  if (filter === undefined) filter = null;
  if (title === undefined) title = '';
  if (!Array.isArray(data) || data.length === 0) return '<p>Tidak ada data</p>';

  var exportData = data;
  if (filter) {
    exportData = data.filter(function (row) {
      return (row.Status || '').toLowerCase() === filter;
    });
  }

  if (exportData.length === 0) return '<p>Tidak ada data</p>';

  var ALLOWED_COLUMNS = ['ID', 'Department', 'Office', 'Items', 'PartOf', 'Description', 'Qty', 'Unit', 'Price', 'Nominal', 'LastBuyingDate', 'OrderDate', 'Priority', 'OrderBy', 'Status'];
  var allHeaders = Object.keys(exportData[0] || {});
  var headers = allHeaders.filter(function (h) { return ALLOWED_COLUMNS.indexOf(h) !== -1; });

  var headerRow = headers.map(function (h) {
    return '<th style="padding:6px;text-align:left;border:1px solid #ddd;background:#f0f0f0;font-weight:bold;font-size:9px;word-wrap:break-word;">' + _escapeHtml(h) + '</th>';
  }).join('');

  var bodyRows = exportData.map(function (row) {
    var cells = headers.map(function (h) {
      var value = row[h] || '';

      if (['CreatedAt', 'SubmissionDate', 'ApprovedDate', 'DoneDate', 'RejectedDate'].indexOf(h) !== -1 && value) {
        value = formatDateTime(value);
      } else if (['LastBuyingDate', 'OrderDate'].indexOf(h) !== -1 && value) {
        value = formatDate(value);
      } else if (['Price', 'Nominal'].indexOf(h) !== -1 && value) {
        value = formatRupiah(value);
      }

      return '<td style="padding:4px;border:1px solid #ddd;font-size:8px;word-wrap:break-word;max-width:80px;">' + _escapeHtml(String(value).substring(0, 50)) + '</td>';
    }).join('');
    return '<tr>' + cells + '</tr>';
  }).join('');

  return '<div style="page-break-after:always;margin-bottom:20px;">' +
    '<h2 style="color:#333;margin-bottom:10px;font-size:14px;">' + _escapeHtml(title) + '</h2>' +
    '<table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:8px;">' +
    '<thead><tr>' + headerRow + '</tr></thead>' +
    '<tbody>' + bodyRows + '</tbody>' +
    '</table>' +
    '</div>';
}

function generatePDF(htmlContent, filename) {
  var element = document.createElement('div');
  element.innerHTML = '<div style="font-family:Arial,sans-serif;padding:15px;font-size:8px;">' +
    '<div style="text-align:center;margin-bottom:15px;">' +
    '<h1 style="margin:0;color:#0c4a6e;font-size:16px;">📄 Purchase Request Report</h1>' +
    '<p style="color:#666;margin:5px 0;font-size:9px;">Generated: ' + new Date().toLocaleString('id-ID') + '</p>' +
    '</div>' +
    htmlContent +
    '</div>';

  var options = {
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
    if (typeof debugError === 'function') debugError('html2pdf library not loaded');
  }
}

// ============================================
// 14. REFRESH ACTIVE TABLE (called from syncAllSheets & timer)
// ============================================

/**
 * Refresh hanya tabel aktif, tidak rebuild page HTML.
 * @param {string} page - active page
 * @param {boolean} silent - if true, no toast
 */
function refreshActiveTable(page, silent) {
  if (silent === undefined) silent = false;
  if (!page) page = appState.activePage || sessionStorage.getItem('currentPage') || 'dashboard';

  if (!silent && typeof showToast === 'function') {
    // Skip toast - terlalu noisy
  }

  switch (page) {
    case 'request': loadRequestData(false); break;
    case 'approval': loadApprovalData(); break;
    case 'done': loadDoneData(); break;
    case 'rekap': loadRekapData(false); break;
    case 'rejected': loadRejectedData(); break;
    case 'dashboard': loadDashboardStats(); break;
    // print page: no refresh needed
  }
}

// ============================================
// 15. INISIALISASI SPA
// ============================================

function renderPageContainers() {
  var app = document.getElementById('app');
  if (!app) return;

  var pages = ['dashboard', 'request', 'approval', 'done', 'rekap', 'rejected', 'print'];
  app.innerHTML = pages.map(function (page) {
    return '<div id="page-' + page + '" class="page-container" style="display:none;"></div>';
  }).join('');
}

function setupModalEvents() {
  var modal = document.getElementById('requestModal');
  if (!modal) {
    createRequestModal();
  }
}

function createRequestModal() {
  var modalHTML =
    '<div id="requestModal" class="modal">' +
      '<div class="modal-content">' +
        '<div class="modal-header">' +
          '<h3>Form Permintaan Barang</h3>' +
          '<button id="btnCloseModal" class="modal-close" type="button">×</button>' +
        '</div>' +
        '<form id="prForm" class="pr-form" autocomplete="off">' +
          '<input type="hidden" name="ID" id="formID">' +
          '<div class="form-grid">' +
            '<div><label>Department</label><input name="Department" required></div>' +
            '<div><label>Office</label><input name="Office" required></div>' +
            '<div><label>Items</label><input name="Items" required></div>' +
            '<div><label>Part Of</label><input name="PartOf"></div>' +
            '<div class="full"><label>Description</label><textarea name="Description" rows="3"></textarea></div>' +
            '<div><label>Qty</label><input name="Qty" type="number" min="1" required></div>' +
            '<div><label>Unit</label><input name="Unit" required></div>' +
            '<div><label>Price</label><input name="Price" type="number" min="0" required></div>' +
            '<div>' +
              '<label>Last Buying Option</label>' +
              '<select id="lastBuyingOption" onchange="handleLastBuyingOption()">' +
                '<option value="date">Gunakan Tanggal</option>' +
                '<option value="never">Never Buy</option>' +
              '</select>' +
            '</div>' +
            '<div>' +
              '<label>Last Buying Date</label>' +
              '<input id="lastBuyingDate" type="date">' +
            '</div>' +
            '<input type="hidden" name="LastBuyingDate" id="lastBuyingDateHidden">' +
            '<div><label>Order Date</label><input name="OrderDate" type="date" required value=""></div>' +
            '<div><label>Priority</label>' +
              '<select name="Priority">' +
                '<option>Low</option>' +
                '<option selected>Medium</option>' +
                '<option>High</option>' +
              '</select>' +
            '</div>' +
            '<div><label>Order By</label><input name="OrderBy"></div>' +
          '</div>' +
          '<div class="form-actions">' +
            '<button type="button" id="btnCancelModal" class="btn-secondary">Batal</button>' +
            '<button type="submit" class="btn-primary">Simpan</button>' +
          '</div>' +
        '</form>' +
      '</div>' +
    '</div>';

  document.body.insertAdjacentHTML('beforeend', modalHTML);

  document.getElementById('btnCloseModal').addEventListener('click', closeRequestModal);
  document.getElementById('btnCancelModal').addEventListener('click', closeRequestModal);
  document.getElementById('prForm').addEventListener('submit', submitRequestForm);

  document.getElementById('requestModal').addEventListener('click', function (e) {
    if (e.target === this) closeRequestModal();
  });
}

// ============================================
// 16. INIT
// ============================================

document.addEventListener('DOMContentLoaded', function () {
  if (typeof debugLog === 'function') debugLog('🚀 SPA Application Initialized v2.0');

  if (!sessionStorage.getItem('isLoggedIn')) {
    window.location.href = 'login.html';
    return;
  }

  renderPageContainers();

  var initialPage = sessionStorage.getItem('currentPage') || 'dashboard';
  if (typeof checkPermission === 'function' && checkPermission(initialPage)) {
    renderPage(initialPage);
  } else {
    var role = typeof normalizeRole === 'function' ? normalizeRole(sessionStorage.getItem('userRole')) : 'viewer';
    var allowed = (typeof PERMISSIONS !== 'undefined' && PERMISSIONS[role]) || ['dashboard'];
    renderPage(allowed[0]);
  }

  setupModalEvents();

  // ✅ Auto-refresh: pakai cache (forceRefresh=false)
  // Default: disabled. Enable via APP_CONFIG.features.autoRefreshInterval
  var interval = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.features && APP_CONFIG.features.autoRefreshInterval) || 0;
  if (interval > 0) {
    if (typeof debugLog === 'function') debugLog('🔄 Auto-refresh enabled:', interval, 'ms (cache-first, no force)');
    setInterval(function () {
      if (document.hidden) return;
      var current = sessionStorage.getItem('currentPage');
      if (current && current !== 'dashboard' && current !== 'print') {
        refreshActiveTable(current, true); // silent
      }
    }, interval);
  }

  // ✅ Visibility change: refresh saat user kembali ke tab (jika idle > 5 min)
  var lastActive = Date.now();
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      lastActive = Date.now();
    } else {
      var idleMs = Date.now() - lastActive;
      if (idleMs > 5 * 60 * 1000) {
        if (typeof debugLog === 'function') debugLog('👁️ Tab visible after', Math.round(idleMs / 1000), 's, refreshing...');
        refreshActiveTable(appState.activePage, true);
      }
    }
  });
});

// ============================================
// 17. GLOBAL FUNCTIONS
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
window.markDone = markDone;
window.completeAll = completeAll;
window.partialComplete = partialComplete;
window.refreshActiveTable = refreshActiveTable;
window.exportByPage = exportByPage;
