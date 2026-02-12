// ======================
// CONFIG & STATE
// ======================
const DONE_HIDDEN_COLUMNS = [
  'CreatedAt', 'ApprovedBy', 'ApprovedDate', 'DoneBy', 
  'DoneDate', 'RejectedBy', 'RejectedDate', 'RejectedReason'
];

const NUMBER_COLUMNS = ['Qty'];
const CURRENCY_COLUMNS = ['Price', 'Nominal'];
const DATE_COLUMNS = ['SubmissionDate', 'LastBuyingDate', 'OrderDate'];

let allData = [];
let filteredData = [];
let headers = [];
let currentPage = 1;
let pageSize = 100;

// ======================
// LOAD DATA
// ======================
function loadData() {
  // Gunakan parameter sheet 'done' untuk mengambil data dari sheet DONE
  loadDataOptimized((data) => {
    // Filter hanya status 'done' (bukan 'approved')
    allData = (data || []).filter(d => d.Status && d.Status.toLowerCase() === 'done');
    filteredData = [...allData];

    // Debug: lihat berapa data yang masuk
    console.log(`📊 Done sheet loaded: ${allData.length} records with status 'done'`);

    headers = Object.keys(allData[0] || {}).filter(h => !DONE_HIDDEN_COLUMNS.includes(h));

    currentPage = 1;
    renderTable();
    renderPagination();
  }, 'done'); // ← PENTING: ambil dari sheet 'done'
}

// ======================
// SEARCH & PAGE
// ======================
function onSearch(e) {
  const q = e.target.value.toLowerCase();
  currentPage = 1;
  filteredData = allData.filter(r =>
    headers.map(h => r[h]).join(' ').toLowerCase().includes(q)
  );
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
  
  if (total === 0) {
    info.textContent = `Menampilkan 0–0 dari 0 data`;
    return;
  }

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);
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

  // Header - HAPUS kolom Aksi karena di DONE tidak perlu tombol
  const headerHtml = headers.map(h => `<th>${h}</th>`).join('');
  thead.innerHTML = `<tr>${headerHtml}</tr>`;

  const pageData = getPagedData();
  if (!pageData.length) {
    tbody.innerHTML = `<tr><td colspan="${headers.length}" class="text-center">Tidak ada data dengan status DONE</td></tr>`;
    return;
  }

  const rowsHtml = pageData.map(r => {
    let cellsHtml = headers.map(h => {
      let v = r[h] ?? '';
      let cls = '';

      // Format sesuai tipe data
      if (DATE_COLUMNS.includes(h)) { 
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

      // Truncate untuk kolom panjang
      if (h === 'Items' || h === 'Description') cls += ' truncate';

      // Status badge
      if (h === 'Status') {
        const statusClass = String(v).toLowerCase();
        return `<td class="text-center"><span class="status ${statusClass}">${v}</span></td>`;
      }

      return `<td class="${cls}" title="${v}">${v}</td>`;
    }).join('');
    
    return `<tr>${cellsHtml}</tr>`;
  });

  if (typeof lazyRenderRows === 'function') {
    lazyRenderRows(rowsHtml, tbody, 50);
  } else {
    tbody.innerHTML = rowsHtml.join('');
  }
}

// ======================
// HAPUS FUNGSI MARK DONE - TIDAK DIGUNAKAN DI DONE.HTML
// ======================
// Fungsi markDone, completeAll, partialComplete, submit dihapus karena tidak digunakan di halaman Done

// ======================
// INIT
// ======================
document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ Done.js initialized - loading data from sheet: done');
  loadData();
  
  const searchInput = document.getElementById('search');
  if (searchInput) {
    if (typeof debounceSearch === 'function') {
      searchInput.addEventListener('input', debounceSearch(onSearch, 300));
    } else {
      searchInput.addEventListener('input', onSearch);
    }
  }
  
  const pageSizeSelect = document.getElementById('pageSize');
  if (pageSizeSelect) {
    pageSizeSelect.addEventListener('change', (e) => {
      pageSize = Number(e.target.value);
      currentPage = 1;
      renderTable();
      renderPagination();
    });
  }
  
  // Auto-refresh setiap 60 detik
  setInterval(() => {
    console.log('🔄 Auto-refreshing done data...');
    if (window.dataCache) delete window.dataCache['done'];
    loadData();
  }, 60000);
});

// Export fungsi untuk debugging dari console
window.loadDoneData = loadData;