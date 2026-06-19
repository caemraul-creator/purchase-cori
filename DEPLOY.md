# Purchase Request System — v4.1.2

## 2 File yang HARUS di-update:

### 1. Code.gs → Google Apps Script (BACKEND)
- Buka https://script.google.com → project Purchase Request Anda
- Hapus SEMUA kode lama
- Copy-paste isi Code.gs (file di folder ini)
- Save (Ctrl+S)
- Deploy → New deployment → Web app
  - Execute as: Me
  - Who has access: Anyone
  - Deploy → copy URL baru
- Jika URL berubah, update API_URL di app.js (baris 19)

### 2. app.js + file HTML → Cloudflare Pages (FRONTEND)
- Upload ke root repo GitHub:
  app.js, Code.gs, index.html, style.css, _headers
  login.html, dashboard.html, approval.html
  done.html, rekap.html, rejected.html, print.html
- Hapus file lama: auth.js, core.js, style-mobile.css, dll
- Cloudflare auto-deploy → hard refresh (Ctrl+Shift+R)

---

## Yang Diperbaiki (v4.1.2)

### BUG #1: Approve/Reject/Done TIDAK BERFUNGSI
- app.js lama TIDAK kirim parameter 'action'
- GAS BUTUH 'action' untuk tahu mau lakukan apa
- FIX: app.js sekarang kirim action=approve/reject/done/partialDone

### BUG #2: Error GAS tidak terdeteksi
- GAS return 'Error: ...' dengan HTTP 200
- app.js lama cek res.ok (selalu true) → show success meski gagal
- FIX: app.js sekarang baca response text, cek 'Error' di awal

### BUG #3: DoneDate & RejectedDate kosong di spreadsheet
- GAS lama pakai 'DoneAt' & 'RejectedAt' (tidak ada di spreadsheet)
- Spreadsheet punya 'DoneDate' & 'RejectedDate'
- FIX: Code.gs diubah ke 'DoneDate' & 'RejectedDate'

### BUG #4 (dari versi sebelumnya):
- Menu dashboard kosong → FIX (filter pakai m.id)
- Tabel tidak muncul → FIX (strip callback() wrapper dari response GAS)
- index.html 404 → FIX (dibuat form New Request)
- CSP error html2pdf → FIX (_headers)
- API_URL redeclare → FIX (IIFE wrap)
- meta apple deprecated → FIX (mobile-web-app-capable)

---

## Akun Login:
  kukuh  / admin123   → staff_c (6 menu, semua akses)
  yusuf  / 112233     → staff_c
  parni  / 112233     → staff_c
  viewer / viewer123  → viewer (2 menu)
  staffa / staffa123  → staff_a (4 menu)
  staffb / staffb123  → staff_b (5 menu)

## Verifikasi:
Setelah deploy, buka Console (F12), login, klik Approve:
  POST response: Data berhasil disimpan  ← BERHASIL
  POST response: Error: ...              ← GAGAL (cek pesan)
