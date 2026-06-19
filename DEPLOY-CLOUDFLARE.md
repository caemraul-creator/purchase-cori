# Cara Deploy ke Cloudflare Pages

## Langkah 1 — Upload ke GitHub
1. Buat repo baru di GitHub (atau pakai repo lama)
2. Upload SEMUA file di folder ini ke root repo:
   - app.js, style.css, _headers
   - login.html, dashboard.html, approval.html, done.html
   - rekap.html, rejected.html, print.html
3. Commit & push

## Langkah 2 — Hapus File Lama di Repo (PENTING!)
Hapus file-file lama yang SUDAH TIDAK DIPAKAI agar error hilang:
```
auth.js
core.js
config.js
ui-helper.js
firebase-helper.js
style-mobile.css
css.css
themes.css
index.html          ← jika ada, ini sumber error style-mobile.css
```

## Langkah 3 — Deploy di Cloudflare Pages
1. Login Cloudflare → Pages → Create a project → Connect to Git
2. Pilih repo Anda
3. Framework preset: **None** (static site)
4. Build command: (kosongkan)
5. Build output directory: **/** (root)
6. Deploy!

## Langkah 4 — Hard Refresh
Setelah deploy, buka situs Anda lalu tekan **Ctrl+Shift+R** (atau Cmd+Shift+R di Mac)
untuk menghapus cache browser dari file JS lama.

---

## Yang Diperbaiki (v4.1)

| Error | Fix |
|---|---|
| `style-mobile.css` MIME error | Hapus index.html lama (Langkah 2) |
| `API_URL` already declared | app.js dibungkus IIFE — aman dari collision |
| CSP blok html2pdf map | _headers: connect-src + cdnjs.cloudflare.com |
| apple-mobile-web-app-capable deprecated | Semua HTML: meta mobile-web-app-capable |
