// ============================================
// DONE.JS - Purchase Request Done List
// ============================================

let allData = [];
let filteredData = [];
let currentPage = 1;
let pageSize = 100;
let sortColumn = '';
let sortDirection = 'asc';

// Inisialisasi
document.addEventListener('DOMContentLoaded', function() {
    console.log('Done page initializing...');

    // Cek Auth
    if (typeof AUTH !== 'undefined' && !AUTH.isLoggedIn()) {
        window.location.href = 'login.html';
        return;
    }

    // Load data awal
    loadDoneData();

    // Event Listener untuk Search
    const searchInput = document.getElementById('search');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            applySearch();
        });
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
});

// Fungsi untuk memuat data dari Spreadsheet
async function loadDoneData() {
    try {
        UI.showLoading();
        console.log('Loading done purchase requests...');

        // Panggil API - Sesuaikan 'getDoneRequests' dengan action di Google Apps Script Anda
        // Jika data PR berada di sheet yang sama dengan barang, mungkin perlu action berbeda
        const response = await API.get('getDoneRequests'); 
        
        console.log('Response:', response);

        // Asumsi response adalah array of objects
        allData = response || [];
        
        // Sort default (misal berdasarkan tanggal terbaru)
        if (allData.length > 0) {
            // Deteksi kolom tanggal jika ada
            if (allData[0].tanggal) {
                allData.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
            }
        }

        filteredData = [...allData];
        
        renderTable();
        UI.hideLoading();

    } catch (error) {
        console.error('Error loading done data:', error);
        UI.hideLoading();
        UI.showAlert('Gagal memuat data: ' + error.message, 'danger');
        
        // Render tabel kosong jika error
        allData = [];
        filteredData = [];
        renderTable();
    }
}

// Fungsi Refresh dipanggil dari HTML
function refreshDoneData() {
    loadDoneData();
}

// Fungsi Filter/Search
function applySearch() {
    const searchTerm = document.getElementById('search').value.toLowerCase();
    
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
        console.error('Element tabel tidak ditemukan');
        return;
    }

    // 1. Generate Header
    if (allData.length > 0) {
        const columns = Object.keys(allData[0]);
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
        tbody.innerHTML = `
            <tr>
                <td colspan="100%" style="text-align:center; padding: 20px; color: #888;">
                    Tidak ada data yang ditemukan.
                </td>
            </tr>`;
    } else {
        let html = '';
        pageData.forEach((row, index) => {
            const rowNum = startIdx + index + 1;
            html += '<tr>';
            html += `<td>${rowNum}</td>`;
            
            // Loop semua nilai kolom
            Object.values(row).forEach(val => {
                html += `<td>${val || '-'}</td>`;
            });
            
            html += '</tr>';
        });
        tbody.innerHTML = html;
    }

    // 4. Update Info Text
    if (infoText) {
        infoText.innerHTML = `Menampilkan ${startIdx + 1}-${endIdx} dari ${totalItems} data`;
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
    html += `<button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>« Prev</button>`;

    // Page Numbers (Simple logic)
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            html += `<button onclick="changePage(${i})" class="${i === currentPage ? 'active' : ''}">${i}</button>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            html += `<span style="padding: 5px;">...</span>`;
        }
    }

    // Next Button
    html += `<button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Next »</button>`;

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