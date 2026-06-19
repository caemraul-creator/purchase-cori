# Cara Deploy ke Cloudflare Pages

## Yang Diperbaiki (v4.1)

### 1. Menu Dashboard Kosong → FIX
Function renderMenu() filter pakai m.page (nama file) tapi PERMISSIONS
pakai m.id (ID logis). Diubah ke m.id agar menu muncul.

### 2. Menu "New Request" Tidak Connect → FIX
File index.html TIDAK ADA di upload sebelumnya. Sekarang sudah dibuat
lengkap dengan form permintaan pembelian (Department, Office, Items,
Qty, Unit, Price, dll + auto-calculate Nominal).

### 3. Kolom Spreadsheet Tidak Cocok → FIX
HIDDEN_COLUMNS & DISPLAY_NAMES disesuaikan dengan kolom spreadsheet
asli: Items, Description, Department, Office, PartOf, Priority, OrderBy.

### 4. Error Console (dari versi sebelumnya):
- app.js IIFE wrap → cegah "API_URL already declared"
- _headers CSP → cegah blok html2pdf
- meta mobile-web-app-capable → ganti apple-mobile deprecated

---

## Langkah Deploy

### 1. Upload SEMUA file ke GitHub (timpa yang lama):
  app.js, style.css, _headers
  index.html (BARU!), login.html, dashboard.html
  approval.html, done.html, rekap.html, rejected.html, print.html

### 2. Hapus file lama dari repo:
  auth.js, core.js, config.js, ui-helper.js, firebase-helper.js
  style-mobile.css, css.css, themes.css

### 3. Deploy di Cloudflare Pages:
  Framework preset: None (static site)
  Build command: (kosong)
  Build output: / (root)

### 4. Hard refresh: Ctrl+Shift+R

---

## Akun Login (dari spreadsheet Users):
  kukuh  / admin123   → staff_c (6 menu)
  yusuf  / 112233     → staff_c (6 menu)
  parni  / 112233     → staff_c (6 menu)
  viewer / viewer123  → viewer (2 menu)
  staffa / staffa123  → staff_a (4 menu)
  staffb / staffb123  → staff_b (5 menu)

## Data di Spreadsheet:
  Sheet1: 218 pending + 1 approved (active requests)
  Done: 277 completed
  Rejected: 5 rejected
