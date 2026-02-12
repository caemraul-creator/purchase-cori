// ======================
// CONFIG & STATE
//=======================
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
// LOAD DATA - DARI SHEET MAIN, FILTER APPROVED
// ======================
function loadData() {
  // Ambil dari sheet MAIN (bukan done)
  loadDataOptimized((data) => {
    // Filter status APPROVED (karena approved = siap diproses/done)
    allData = (data || []).filter(d => d.Status === 'approved');
    filteredData = [...allData];

    headers = Object.keys(allData[0] || {}).filter(h => !DONE_HIDDEN_COLUMNS.includes(h));

    currentPage = 1;
    renderTable();
    renderPagination();
  }); // KOSONG = sheet MAIN
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
  const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(start + pageSize - 1, total);
  info.textContent = `Menampilkan ${start}–${end} dari ${total} data`;

  if (currentPage > 1) {
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '←';
    prevBtn.className = 'pagination-btn';
    prevBtn.onclick = () => { currentPage--; renderTable(); renderPagination(); };
    container.appendChild(prevBtn);
  }

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      const b = document.createElement('button');
      b.textContent = i;
      b.className = 'pagination-btn';
      if (i === currentPage) b.classList.add('active');
      b.onclick = () => { currentPage = i; renderTable(); renderPagination(); };
      container.appendChild(b);
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      const ellipsis = document.createElement('span');
      ellipsis.textContent = '...';
      ellipsis.style.margin = '0 4px';
      ellipsis.style.color = '#6b7280';
      container.appendChild(ellipsis);
    }
  }

  if (currentPage < totalPages) {
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '→';
    nextBtn.className = 'pagination-btn';
    nextBtn.onclick = () => { currentPage++; renderTable(); renderPagination(); };
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

  // TAMBAHKAN kolom Aksi
  const headerHtml = headers.map(h => {
    if (h === 'ID') {
      return `<th>${h}</th><th>Aksi</th>`;
    }
    return `<th>${h}</th>`;
  }).join('');
  thead.innerHTML = `<tr>${headerHtml}</tr>`;

  const pageData = getPagedData();
  if (!pageData.length) {
    tbody.innerHTML = `<tr><td colspan="${headers.length + 1}" class="text-center">Tidak ada data APPROVED</td></tr>`;
    return;
  }

  const rowsHtml = pageData.map(r => {
    let cellsHtml = headers.map(h => {
      let v = r[h] ?? '';
      let cls = '';

      if (DATE_COLUMNS.includes(h)) { v = formatDate(v); cls = 'text-center'; }
      if (NUMBER_COLUMNS.includes(h)) { v = formatNumber(v); cls = 'text-right'; }
      if (CURRENCY_COLUMNS.includes(h)) { v = formatRupiah(v); cls = 'text-right'; }
      
      if (h === 'Items' || h === 'Description') cls += ' truncate';

      let cell = `<td class="${cls}">${v}</td>`;
      
      if (h === 'Status') {
        cell = `<td class="text-center"><span class="status approved">approved</span></td>`;
      }
      
      if (h === 'ID') {
        cell += `<td class="text-center">
          <button class="btn-primary" onclick="markDone('${r.ID}')" title="Mark Done">📦 Selesai</button>
        </td>`;
      }
      return cell;
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
// MARK DONE - PINDAHKAN KE SHEET DONE
// ======================
function markDone(id) {
  if (confirm('Tandai request ini sebagai SELESAI?')) {
    const user = sessionStorage.getItem('username') || 'System';
    
    const fd = new FormData();
    fd.append('ID', id);
    fd.append('Status', 'done');
    fd.append('DoneBy', user);
    fd.append('action', 'move_to_done'); // Trigger untuk pindah sheet
    
    submit(fd);
  }
}

async function submit(fd) {
  try {
    showToast('Memproses...');
    const res = await fetch(API_URL, { method: 'POST', body: fd });
    if (!res.ok) throw new Error('Gagal update');
    
    showToast('Request ditandai SELESAI');
    if(window.dataCache) delete window.dataCache['main'];
    setTimeout(loadData, 500);
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ======================
// INIT
// ======================
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  document.getElementById('search')?.addEventListener('input', debounceSearch(onSearch, 300));
  document.getElementById('pageSize')?.addEventListener('change', (e) => {
    pageSize = Number(e.target.value);
    currentPage = 1;
    renderTable();
    renderPagination();
  });
});

// Export fungsi
window.markDone = markDone;