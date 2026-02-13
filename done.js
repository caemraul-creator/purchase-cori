// ============================================
// DONE.JS - Purchase Request Done List
// FIXED VERSION - No UI references
// ============================================

// Konstanta untuk kolom-kolom yang perlu di-hide atau format
const DONE_HIDDEN_COLUMNS = ['CreatedAt', 'RejectedBy', 'RejectedDate', 'RejectedReason'];
const NUMBER_COLUMNS = ['Qty'];
const CURRENCY_COLUMNS = ['Price', 'Nominal'];
const DATE_COLUMNS = ['LastBuyingDate', 'OrderDate'];
const DATETIME_COLUMNS = ['CreatedAt', 'SubmissionDate', 'ApprovedDate', 'DoneDate'];

let allData = [];
let filteredData = [];
let currentPage = 1;
let pageSize = 100;
let sortColumn = '';
let sortDirection = 'asc';

// Inisialisasi
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ Done page initializing...');

    // Cek Auth (jika ada AUTH module)
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = 'login.html';
        return;
    }

    // Load data awal
    loadDoneData();

    // Event Listener untuk Search dengan Debounce
    const searchInput = document.getElementById('search');
    if (searchInput) {
        if (typeof debounceSearch === 'function') {
            searchInput.addEventListener('input', debounceSearch(applySearch, 300));
        } else {
            searchInput.addEventListener('input', applySearch);
        }
    }

    // Event Listener untuk Page Size
    const pageSizeSelect = document.getElementById('pageSize');
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', function() {
            pageSize = parseInt(this.value);
            currentPage = 1;
            renderTable();
        });
    }
    
    // Auto-refresh data setiap 60 detik (optional)
    setInterval(() => {
        console.log('🔄 Auto-refreshing done data...');
        loadDoneData(true);
    }, 60000); // 60 detik
});

// Fungsi untuk memuat data dari Spreadsheet
function loadDoneData(forceRefresh = false) {
    try {
        // Clear cache jika force refresh
        if (forceRefresh && window.dataCache) {
            delete window.dataCache['done'];
            console.log('🔄 Cache cleared for done sheet, forcing data refresh');
        }

        // Show loading (gunakan showLoading dari ui-helper.js)
        if (typeof showLoading === 'function') {
            showLoading(true);
        }
        
        console.log('📦 Loading done purchase requests...');

        // Load dari sheet 'done' menggunakan loadDataOptimized
        loadDataOptimized((data) => {
            try {
                allData = data || [];
                
                console.log(`📊 Raw data received: ${allData.length} records`);
                
                // Sort default berdasarkan tanggal terbaru
                if (allData.length > 0) {
                    // Coba sort berdasarkan DoneDate, ApprovedDate, atau SubmissionDate
                    if (allData[0].DoneDate) {
                        allData.sort((a, b) => new Date(b.DoneDate) - new Date(a.DoneDate));
                    } else if (allData[0].ApprovedDate) {
                        allData.sort((a, b) => new Date(b.ApprovedDate) - new Date(a.ApprovedDate));
                    } else if (allData[0].SubmissionDate) {
                        allData.sort((a, b) => new Date(b.SubmissionDate) - new Date(a.SubmissionDate));
                    }
                }

                filteredData = [...allData];
                
                renderTable();
                
                console.log(`✅ Done data loaded successfully: ${allData.length} records`);
                
                if (forceRefresh && typeof showToast === 'function') {
                    showToast('Data diperbarui', 'success');
                }
            } catch (err) {
                console.error('❌ Error processing done data:', err);
                if (typeof showToast === 'function') {
                    showToast('Error memproses data: ' + err.message, 'error');
                }
            } finally {
                // Hide loading
                if (typeof showLoading === 'function') {
                    showLoading(false);
                }
            }
        }, 'done'); // Sheet name 'done'
        
    } catch (error) {
        console.error('❌ Error in loadDoneData:', error);
        
        // Hide loading on error
        if (typeof showLoading === 'function') {
            showLoading(false);
        }
        
        if (typeof showToast === 'function') {
            showToast('Gagal memuat data: ' + error.message, 'error');
        }
        
        // Render tabel kosong jika error
        allData = [];
        filteredData = [];
        renderTable();
    }
}

// Fungsi Refresh dipanggil dari HTML
function refreshDoneData() {
    console.log('🔄 Manual refresh triggered');
    loadDoneData(true);
}

// Fungsi Filter/Search
function applySearch() {
    const searchInput = document.getElementById('search');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.toLowerCase();
    
    if (!searchTerm) {
        filteredData = [...allData];
    } else {
        filteredData = allData.filter(row => {
            // Cari di semua nilai kolom
            return Object.values(row).some(val => 
                String(val).toLowerCase().includes(searchTerm)
            );
        });
    }
    
    currentPage = 1;
    renderTable();
}

// Render Tabel
function renderTable() {
    const thead = document.querySelector('thead');
    const tbody = document.querySelector('tbody');
    const infoText = document.getElementById('infoText');
    const paginationDiv = document.getElementById('pagination');

    if (!thead || !tbody) {
        console.error('❌ Element tabel tidak ditemukan');
        return;
    }

    // 1. Generate Header (filter kolom yang di-hide)
    if (allData.length > 0) {
        const columns = Object.keys(allData[0]).filter(col => !DONE_HIDDEN_COLUMNS.includes(col));
        thead.innerHTML = `<tr>
            <th>No</th>
            ${columns.map(col => `<th style="cursor:pointer" onclick="sortTable('${col}')">${formatHeader(col)}</th>`).join('')}
        </tr>`;
    } else {
        thead.innerHTML = '<tr><th>Data Kosong</th></tr>';
    }

    // 2. Pagination Logic
    const totalItems = filteredData.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, totalItems);
    const pageData = filteredData.slice(startIdx, endIdx);

    // 3. Generate Body
    if (pageData.length === 0) {
        const colCount = allData.length > 0 ? Object.keys(allData[0]).filter(col => !DONE_HIDDEN_COLUMNS.includes(col)).length + 1 : 1;
        tbody.innerHTML = `
            <tr>
                <td colspan="${colCount}" style="text-align:center; padding: 20px; color: #888;">
                    Tidak ada data yang ditemukan.
                </td>
            </tr>`;
    } else {
        const columns = Object.keys(allData[0]).filter(col => !DONE_HIDDEN_COLUMNS.includes(col));
        let rowsHtml = [];
        
        pageData.forEach((row, index) => {
            const rowNum = startIdx + index + 1;
            let html = '<tr>';
            html += `<td>${rowNum}</td>`;
            
            // Loop kolom (skip yang di-hide)
            columns.forEach(col => {
                let val = row[col] ?? '';
                let cls = '';
                
                // Format sesuai tipe kolom (gunakan formatter dari ui-helper.js)
                if (DATETIME_COLUMNS.includes(col)) { 
                    if (typeof formatDateTime === 'function') {
                        val = formatDateTime(val);
                    }
                    cls = 'text-center'; 
                }
                else if (DATE_COLUMNS.includes(col)) { 
                    if (typeof formatDate === 'function') {
                        val = formatDate(val);
                    }
                    cls = 'text-center'; 
                }
                
                if (NUMBER_COLUMNS.includes(col)) { 
                    if (typeof formatNumber === 'function') {
                        val = formatNumber(val);
                    }
                    cls = 'text-right'; 
                }
                if (CURRENCY_COLUMNS.includes(col)) { 
                    if (typeof formatRupiah === 'function') {
                        val = formatRupiah(val);
                    }
                    cls = 'text-right'; 
                }
                
                // Truncate untuk kolom tertentu
                if (col === 'Items' || col === 'Description') {
                    cls += ' truncate';
                }
                
                let cell = `<td class="${cls}" title="${val}">${val || '-'}</td>`;
                
                // Format khusus untuk Status
                if (col === 'Status') {
                    const statusClass = String(val).toLowerCase();
                    cell = `<td class="text-center"><span class="status ${statusClass}">${val}</span></td>`;
                }
                
                html += cell;
            });
            
            html += '</tr>';
            rowsHtml.push(html);
        });
        
        // Gunakan lazyRenderRows jika tersedia
        if (typeof lazyRenderRows === 'function') {
            lazyRenderRows(rowsHtml, tbody, 50);
        } else {
            tbody.innerHTML = rowsHtml.join('');
        }
    }

    // 4. Update Info Text
    if (infoText) {
        if (totalItems === 0) {
            infoText.innerHTML = 'Tidak ada data';
        } else {
            infoText.innerHTML = `Menampilkan ${startIdx + 1}–${endIdx} dari ${totalItems} data`;
        }
    }

    // 5. Render Pagination
    renderPagination(totalPages);
}

// Fungsi Format Header (snake_case atau camelCase jadi Title Case)
function formatHeader(str) {
    return str.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/\b\w/g, l => l.toUpperCase()).trim();
}

// Fungsi Sort
function sortTable(column) {
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = 'asc';
    }

    filteredData.sort((a, b) => {
        let valA = a[column];
        let valB = b[column];

        // Coba parse angka
        if (!isNaN(valA) && !isNaN(valB)) {
            return sortDirection === 'asc' ? valA - valB : valB - valA;
        }
        
        // String compare
        if (sortDirection === 'asc') {
            return String(valA).localeCompare(String(valB));
        } else {
            return String(valB).localeCompare(String(valA));
        }
    });

    renderTable();
}

// Render Pagination Buttons
function renderPagination(totalPages) {
    const div = document.getElementById('pagination');
    if (!div) return;

    if (totalPages <= 1) {
        div.innerHTML = '';
        return;
    }

    let html = '';
    
    // Prev Button
    html += `<button class="pagination-btn" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>« Prev</button>`;

    // Page Numbers (Simple logic)
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            html += `<span style="padding: 5px;">...</span>`;
        }
    }

    // Next Button
    html += `<button class="pagination-btn" onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Next »</button>`;

    div.innerHTML = html;
}

function changePage(page) {
    const totalPages = Math.ceil(filteredData.length / pageSize);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderTable();
}

// Export agar bisa diakses global
window.refreshDoneData = refreshDoneData;
window.sortTable = sortTable;
window.changePage = changePage;

console.log('✅ done.js loaded successfully');