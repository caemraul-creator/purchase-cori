// ======================
// CONFIG & STATE
// ======================
const HIDDEN_COLUMNS = [
  'DoneBy', 'DoneDate', 'CreatedAt', 'RejectedBy', 
  'RejectedDate', 'RejectedReason', 'PartOf', 'Requester'
];

const NUMBER_COLUMNS = ['Qty'];
const CURRENCY_COLUMNS = ['Price', 'Nominal'];
const DATE_COLUMNS = ['LastBuyingDate', 'OrderDate'];
const DATETIME_COLUMNS = ['CreatedAt', 'SubmissionDate', 'ApprovedDate', 'DoneDate'];

let allData = [];
let filteredData = [];
let headers = [];
let currentPage = 1;
let pageSize = 100;
let editMode = false;
let currentEditId = null;

// ======================
// HELPER FUNCTIONS
// ======================
function populateForm(row) {
  document.getElementById('formID').value = row.ID || '';
  
  // Isi semua field dari row
  ['Department', 'Office', 'Items', 'PartOf', 'Description', 'Qty', 'Unit', 'Price', 'Priority', 'OrderBy'].forEach(name => {
    const el = document.querySelector(`[name="${name}"]`);
    if(el) el.value = row[name] || '';
  });

  // Handle LastBuyingDate Fallback (Logika spesifik form)
  if (typeof handleLastBuyingDateFallback === 'function') {
    handleLastBuyingDateFallback(row.LastBuyingDate || '');
  }

  // Handle OrderDate
  const orderDateInput = document.querySelector('[name="OrderDate"]');
  if (orderDateInput) {
    orderDateInput.value = parseDateForInput(row.OrderDate);
  }
}

function clearForm() {
  const form = document.getElementById('prForm');
  if (form) form.reset();
  
  document.getElementById('formID').value = '';
  
  // Reset khusus untuk LastBuyingDate
  if(document.getElementById('lastBuyingOption')) {
    document.getElementById('lastBuyingOption').value = 'date';
    document.getElementById('lastBuyingDate').disabled = false;
    document.getElementById('lastBuyingDate').value = '';
    document.getElementById('lastBuyingDate').style.backgroundColor = '#fff';
  }
  
  // Set OrderDate ke hari ini
  const today = new Date().toISOString().split('T')[0];
  const orderDateInput = document.querySelector('[name="OrderDate"]');
  if (orderDateInput) {
    orderDateInput.value = today;
  }
}

// Helper khusus form (Tetap disimpan disini karena spesifik input form)
function parseDateForInput(dateValue) {
  if (!dateValue) return '';
  if (typeof dateValue === 'string' && dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) return dateValue;
  
  const d = new Date(dateValue);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return '';
}

// ======================
// LOAD DATA (WITH FORCE REFRESH OPTION)
// ======================
function loadData(forceRefresh = false) {
  // Clear cache jika force refresh
  if (forceRefresh && window.dataCache) {
    delete window.dataCache['main'];
    console.log('🔄 Cache cleared, forcing data refresh');
  }
  
  // Menggunakan loadDataOptimized dari ui-helper.js
  loadDataOptimized((data) => {
    allData = data || [];
    filteredData = [...allData];

    // Ambil header dari baris pertama data
    if (allData.length > 0) {
      headers = Object.keys(allData[0] || {}).filter(h => !HIDDEN_COLUMNS.includes(h));
    } else {
      headers = [];
    }

    currentPage = 1;
    renderTable();
    renderPagination();
    
    // Debug info
    console.log(`✅ Data loaded: ${allData.length} records`);
    if (forceRefresh) {
      showToast('Data diperbarui', 'success');
    }
  }); // Kosong = sheet default/main
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

  // Header
  const headerHtml = headers.map(h => {
    let html = `<th>${h}</th>`;
    if (h === 'ID') html += '<th>Aksi</th>';
    return html;
  }).join('');
  
  thead.innerHTML = `<tr>${headerHtml}</tr>`;

  const pageData = getPagedData();
  if (!pageData.length) {
    tbody.innerHTML = `<tr><td colspan="${headers.length + 1}" class="text-center">Data tidak ditemukan</td></tr>`;
    return;
  }

  // Rows
  const rowsHtml = pageData.map(row => {
    let cellsHtml = headers.map(h => {
      let v = row[h] ?? '';
      let cls = '';

      // Menggunakan Format Global dari ui-helper.js
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
      
      if (h === 'Items' || h === 'Description') cls += ' truncate';

      let cell = `<td class="${cls}" title="${v}">${v}</td>`;

      if (h === 'Status') {
        const statusClass = String(v).toLowerCase();
        cell = `<td class="text-center"><span class="status ${statusClass}">${v}</span></td>`;
      }

      if (h === 'ID') {
        cell += `<td class="text-center" style="white-space: nowrap;">
          <button class="btn-secondary btn-xs" onclick="openEdit('${row.ID}')" title="Edit">✏️</button>
        </td>`;
      }
      return cell;
    }).join('');
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
// EDIT & FORM HANDLING
// ======================
function openEdit(id) {
  console.log(`✏️ Opening edit for ID: ${id}`);
  
  // Cari data di cache saat ini
  const row = allData.find(r => r.ID === id);
  
  if (!row) {
    // Data tidak ditemukan di cache, coba refresh data dulu
    showToast('Mengambil data terbaru...', 'warning');
    
    // Simpan ID yang akan diedit
    window.pendingEditId = id;
    
    // Refresh data terlebih dahulu
    loadData(true);
    
    // Tunggu 1 detik lalu coba lagi
    setTimeout(() => {
      const updatedRow = allData.find(r => r.ID === id);
      if (updatedRow) {
        editMode = true;
        currentEditId = id;
        populateForm(updatedRow);
        document.getElementById('modal').classList.add('show');
        delete window.pendingEditId;
      } else {
        showToast('Data tidak ditemukan', 'error');
      }
    }, 1000);
    return;
  }
  
  // Data ditemukan, lanjutkan edit
  editMode = true;
  currentEditId = id;
  populateForm(row);
  document.getElementById('modal').classList.add('show');
}

// ======================
// FORM SUBMIT HANDLER
// ======================
async function submitFormData(formData) {
  try {
    showLoading(true);
    
    // Tambah timestamp untuk memastikan tidak ada cache
    formData.append('_t', Date.now());
    
    const response = await fetch(API_URL, { 
      method: 'POST', 
      body: formData 
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.text();
    console.log('✅ Form submitted successfully:', result);
    
    return { success: true, message: 'Data berhasil disimpan' };
  } catch (error) {
    console.error('❌ Form submission error:', error);
    return { success: false, message: error.message };
  } finally {
    showLoading(false);
  }
}

// ======================
// INIT & EVENT LISTENERS
// ======================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 App.js initialized');
  
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

  // Modal handlers
  const modal = document.getElementById('modal');
  const form = document.getElementById('prForm');
  const btnAdd = document.getElementById('btnAdd');
  const btnClose = document.getElementById('btnClose');
  const btnCancel = document.getElementById('btnCancel');
  
  if (btnAdd) {
    btnAdd.addEventListener('click', () => {
      console.log('➕ Add button clicked');
      editMode = false;
      currentEditId = null;
      clearForm();
      modal.classList.add('show');
    });
  }

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      modal.classList.remove('show');
    });
  }

  if (btnCancel) {
    btnCancel.addEventListener('click', () => {
      modal.classList.remove('show');
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log('📝 Form submission started');
      
      const fd = new FormData(form);
      
      // Set mode (create/update)
      if (editMode && currentEditId) {
        fd.append('ID', currentEditId);
        fd.append('action', 'update');
      } else {
        fd.append('action', 'create');
      }
      
      // Tambah user info
      const username = sessionStorage.getItem('username') || 'User';
      fd.append('Requester', username);
      fd.append('UpdatedBy', username);
      
      // Tangani LastBuyingDate
      const lastBuyingOption = document.getElementById('lastBuyingOption');
      const lastBuyingDateInput = document.getElementById('lastBuyingDate');
      const lastBuyingDateHidden = document.getElementById('lastBuyingDateHidden');
      
      if (lastBuyingOption && lastBuyingDateInput && lastBuyingDateHidden) {
        if (lastBuyingOption.value === 'never') {
          fd.append('LastBuyingDate', 'Never Buy');
        } else if (lastBuyingDateInput.value) {
          fd.append('LastBuyingDate', lastBuyingDateInput.value);
        }
      }
      
      // Show processing message
      showToast(editMode ? 'Memperbarui data...' : 'Menyimpan data baru...', 'success');
      
      // Submit form
      const result = await submitFormData(fd);
      
      if (result.success) {
        showToast(result.message, 'success');
        modal.classList.remove('show');
        
        // FORCE REFRESH DATA - Ini yang memperbaiki masalah
        console.log('🔄 Forcing data refresh after save');
        
        // Tunggu 1 detik untuk memberi waktu server memproses
        setTimeout(() => {
          // Clear semua cache terlebih dahulu
          if (window.dataCache) {
            Object.keys(window.dataCache).forEach(key => {
              delete window.dataCache[key];
            });
          }
          
          // Load data dengan force refresh
          loadData(true);
        }, 800);
      } else {
        showToast('Gagal: ' + result.message, 'error');
      }
    });
  }
  
  // Tambah event listener untuk klik di luar modal (optional)
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('show');
      }
    });
  }
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // ESC untuk tutup modal
    if (e.key === 'Escape' && modal && modal.classList.contains('show')) {
      modal.classList.remove('show');
    }
    
    // Ctrl+F untuk fokus search
    if (e.ctrlKey && e.key === 'f' && searchInput) {
      e.preventDefault();
      searchInput.focus();
    }
  });
  
  // Auto-refresh data setiap 30 detik (optional)
  setInterval(() => {
    if (!modal || !modal.classList.contains('show')) {
      console.log('🔄 Auto-refreshing data...');
      loadData(true);
    }
  }, 30000); // 30 detik
});

// ======================
// GLOBAL FUNCTIONS (accessible from HTML)
// ======================
// Buat fungsi global untuk akses dari inline onclick
window.openEdit = openEdit;