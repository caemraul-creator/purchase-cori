// ======================
// CONFIG & STATE
// ======================
const REKAP_HIDDEN_COLUMNS = [
  'CreatedAt', 
  'ApprovedBy', 
  'ApprovedDate', 
  'DoneBy', 
  'DoneDate', 
  'RejectedBy', 
  'RejectedDate', 
  'RejectedReason',
];

const NUMBER_COLUMNS = ['Qty'];
const CURRENCY_COLUMNS = ['Price', 'Nominal'];
const DATE_COLUMNS = ['LastBuyingDate', 'OrderDate'];
const DATETIME_COLUMNS = ['CreatedAt', 'ApprovedDate', 'DoneDate', 'RejectedDate'];

let allData = [];
let filteredData = [];
let headers = [];
let currentPage = 1;
let pageSize = 20;

// ======================
// LOAD DATA (WITH FORCE REFRESH OPTION)
// ======================
function loadData(forceRefresh = false) {
  // Clear cache jika force refresh
  if (forceRefresh && window.dataCache) {
    delete window.dataCache['done'];
    console.log('🔄 Cache cleared for done sheet, forcing data refresh');
  }
  
  // Load dari sheet 'done'
  loadDataOptimized((data) => {
    allData = data || [];
    filteredData = [...allData];
    
    // DEBUG: Lihat semua kolom yang ada
    if (allData.length > 0) {
      const allColumns = Object.keys(allData[0] || {});
      console.log('📊 All columns in done sheet:', allColumns);
      console.log('🚫 Columns to hide:', REKAP_HIDDEN_COLUMNS);
      
      // Filter kolom yang akan ditampilkan
      headers = allColumns.filter(h => !REKAP_HIDDEN_COLUMNS.includes(h));
      console.log('✅ Columns to show:', headers);
    } else {
      headers = [];
    }

    currentPage = 1;
    renderTable();
    renderPagination();
    
    // Debug info
    console.log(`✅ Done sheet loaded: ${allData.length} records`);
    if (forceRefresh) {
      showToast('Data rekap diperbarui', 'success');
    }
  }, 'done');
}

// ======================
// SEARCH & PAGE
// ======================
function onSearch(e) {
  const q = e.target.value.toLowerCase();
  currentPage = 1;
  
  if (!q.trim()) {
    filteredData = [...allData];
  } else {
    filteredData = allData.filter(r =>
      headers.map(h => r[h]).join(' ').toLowerCase().includes(q)
    );
  }
  
  renderTable();
  renderPagination();
}

function getPagedData() {
  const start = (currentPage - 1) * pageSize;
  return filteredData.slice(start, start + pageSize);
}

function renderPagination() {
  const container = document.getElementById('pagination');
  const info = document.getElementById('infoText');
  if (!container || !info) return;

  const total = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  container.innerHTML = '';
  const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(start + pageSize - 1, total);
  info.textContent = `Menampilkan ${start}–${end} dari ${total} data`;

  // Tombol Previous
  if (currentPage > 1) {
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '←';
    prevBtn.className = 'pagination-btn';
    prevBtn.onclick = () => { 
      currentPage--; 
      renderTable(); 
      renderPagination(); 
    };
    container.appendChild(prevBtn);
  }

  // Tombol halaman
  for (let i = 1; i <= totalPages; i++) {
    // Tampilkan maksimal 5 halaman di sekitar current page
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      const b = document.createElement('button');
      b.textContent = i;
      b.className = 'pagination-btn';
      if (i === currentPage) b.classList.add('active');
      b.onclick = () => { 
        currentPage = i; 
        renderTable(); 
        renderPagination(); 
      };
      container.appendChild(b);
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      const ellipsis = document.createElement('span');
      ellipsis.textContent = '...';
      ellipsis.style.margin = '0 4px';
      ellipsis.style.color = '#6b7280';
      container.appendChild(ellipsis);
    }
  }

  // Tombol Next
  if (currentPage < totalPages) {
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '→';
    nextBtn.className = 'pagination-btn';
    nextBtn.onclick = () => { 
      currentPage++; 
      renderTable(); 
      renderPagination(); 
    };
    container.appendChild(nextBtn);
  }
}

// ======================
// RENDER TABLE
// ======================
function renderTable() {
  const thead = document.querySelector('thead');
  const tbody = document.querySelector('tbody');
  if (!thead || !tbody) return;

  // Header dengan pengecekan
  const headerHtml = headers.map(h => {
    // Pastikan kolom yang dihide tidak muncul
    if (REKAP_HIDDEN_COLUMNS.includes(h)) {
      console.warn(`⚠️ Column "${h}" should be hidden but still in headers!`);
      return '';
    }
    return `<th>${h}</th>`;
  }).filter(Boolean).join(''); // Filter string kosong
  
  thead.innerHTML = `<tr>${headerHtml}</tr>`;

  const pageData = getPagedData();
  if (!pageData.length) {
    tbody.innerHTML = `<tr><td colspan="${headers.length}" class="text-center">Data tidak ditemukan</td></tr>`;
    return;
  }

  const rowsHtml = pageData.map(r => {
    let cellsHtml = headers.map(h => {
      // Skip jika kolom seharusnya dihide
      if (REKAP_HIDDEN_COLUMNS.includes(h)) {
        return '';
      }
      
      let v = r[h] ?? '';
      let cls = '';

      if (DATETIME_COLUMNS.includes(h)) { 
        v = formatDateTime(v); 
        cls = 'text-center'; 
      }
      else if (DATE_COLUMNS.includes(h)) { 
        v = formatDate(v); 
        cls = 'text-center'; 
      }
      if (NUMBER_COLUMNS.includes(h)) { 
        v = formatNumber(v); 
        cls = 'text-right'; 
      }
      if (CURRENCY_COLUMNS.includes(h)) { 
        v = formatRupiah(v); 
        cls = 'text-right'; 
      }

      let cell = `<td class="${cls}">${v}</td>`;
      if (h === 'Status') {
        const status = String(v).toLowerCase();
        cell = `<td class="text-center"><span class="status ${status}">${v}</span></td>`;
      }
      return cell;
    }).filter(Boolean).join(''); // Filter string kosong
    
    return `<tr>${cellsHtml}</tr>`;
  });

  // Menggunakan lazyRenderRows dari ui-helper.js
  if (typeof lazyRenderRows === 'function') {
    lazyRenderRows(rowsHtml, tbody, 50);
  } else {
    // Fallback jika lazyRenderRows tidak tersedia
    tbody.innerHTML = rowsHtml.join('');
  }
}

// ======================
// INIT & EVENT LISTENERS
// ======================
document.addEventListener('DOMContentLoaded', () => {
  console.log('📊 Rekap.js initialized');
  
  // Load data pertama kali
  loadData();

  // Search dengan Debounce dari ui-helper.js
  const searchInput = document.getElementById('search');
  if (searchInput) {
    if (typeof debounceSearch === 'function') {
      searchInput.addEventListener('input', debounceSearch(onSearch, 300));
    } else {
      searchInput.addEventListener('input', onSearch);
    }
  }
  
  // Page size change
  const pageSizeSelect = document.getElementById('pageSize');
  if (pageSizeSelect) {
    pageSizeSelect.addEventListener('change', (e) => {
      pageSize = Number(e.target.value);
      currentPage = 1;
      renderTable();
      renderPagination();
    });
  }
  
  // Auto-refresh data setiap 60 detik (optional)
  setInterval(() => {
    console.log('🔄 Auto-refreshing rekap data...');
    loadData(true);
  }, 60000); // 60 detik
});

// ======================
// MANUAL REFRESH FUNCTION
// ======================
function refreshRekapData() {
  console.log('🔄 Manual refresh triggered');
  showToast('Memperbarui data rekap...', 'success');
  loadData(true);
}

// Make function globally available
window.refreshRekapData = refreshRekapData;