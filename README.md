# EMCee

Executive monitoring untuk seluruh arus uang Yukauto, Payment Gateway, wallet tenant, saldo bank, dan device. Aplikasi Next.js ini berdiri sendiri dan mengambil data dari API Yukauto. Nama tenant dan angka pada `/preview` hanya ilustrasi; preview tidak mengambil data API dan tidak memerlukan login.

## Menjalankan lokal

Gunakan **Node.js 24+** dan npm.

```bash
git clone https://github.com/evans2101/EMCee.git
cd EMCee
npm ci
cp .env.example .env.local
npm run dev
```

- Aplikasi: [http://127.0.0.1:3033](http://127.0.0.1:3033)
- Preview desain: [http://127.0.0.1:3033/preview](http://127.0.0.1:3033/preview)
- Login: akun Yukauto dengan permission `master:*`. Pemeriksaan izin akhir tetap dilakukan backend Yukauto.

Atur `YUKAUTO_API_URL` pada `.env.local` ke base API Yukauto yang sudah memuat endpoint EMCee, misalnya `http://127.0.0.1:8080/api/v1`. URL ini hanya digunakan di server, dan browser mengakses proxy same-origin EMCee. Opsional: `YUKAUTO_WEB_URL` untuk tautan ke dashboard Yukauto dan `NEXT_PUBLIC_TURNSTILE_SITE_KEY` jika login Yukauto mewajibkan CAPTCHA. Restart server setelah mengganti konfigurasi; variabel publik Turnstile juga harus tersedia saat build production.

Repository ini tidak berisi kredensial atau data transaksi asli. Jangan commit `.env.local`; file tersebut sudah diabaikan Git.

## Fitur

- Ringkasan uang masuk, uang keluar, arus bersih, dan tingkat keberhasilan.
- Grafik harian/kumulatif, komposisi channel, aktivitas tenant, serta status operasional.
- Filter tenant, channel, periode WIB; pencarian transaksi, status, arah, pagination, dan detail.
- Saldo merchant PG, saldo wallet tenant, dana reservasi, pendanaan, penarikan, biaya admin, serta margin PG.
- Saldo rekening tersamarkan dan indikator pembaruan saldo; status heartbeat device.
- Auto-refresh monitoring 30 detik dan saldo merchant 60 detik; unduh ringkasan tenant dan CSV halaman transaksi.
- Login/logout dan pembaruan sesi memakai cookie **HttpOnly**, Secure pada production, dan SameSite Strict. Token tidak disimpan di localStorage dan tidak dikirim dalam respons JSON ke browser.

## Integrasi Yukauto

Data keuangan dibaca melalui **GET** ke tiga endpoint berikut:

| Endpoint Yukauto | Kegunaan |
| --- | --- |
| `/api/v1/master/monitoring/finance` | Agregat arus uang, grafik, tenant, bank, dan device |
| `/api/v1/master/monitoring/finance/transactions` | Daftar transaksi gabungan dengan pagination |
| `/api/v1/master/tenants/financial-overview` | Saldo merchant PG dan wallet tenant; memerlukan `master:tenant_management` |

Proxy aplikasi hanya mengizinkan tiga jalur GET tersebut. Perubahan data keuangan tidak tersedia. Login, refresh, dan logout menggunakan POST autentikasi Yukauto. Endpoint monitoring baru beserta SQL, tes, dan patch pendaftaran route tersedia di [integrations/yukauto-backend](integrations/yukauto-backend/README.md). Pasang dan deploy perubahan tersebut pada backend Yukauto sebelum memakai data live.

Filter tanggal menggunakan waktu pencatatan transaksi, tanggal WIB inklusif, default 30 hari terakhir, maksimal 366 hari. Uang masuk/keluar hanya menghitung nominal pokok transaksi berhasil. Pending, gagal/batal, dan biaya admin dipisahkan. Mutasi scraped/connector serta pasangan debit/payout dideduplikasi agar satu pergerakan uang tidak dihitung dua kali.

Saldo bank, wallet tenant, dan merchant adalah snapshot terkini, terpisah dari filter periode. Saldo merchant dan wallet tidak dijumlahkan. Margin PG terkonfirmasi hanya mencakup transaksi berhasil dengan biaya provider yang sudah diketahui. Pendanaan wallet merupakan perpindahan dana internal dan tidak ditambahkan sebagai uang masuk eksternal baru.

## Pemeriksaan dan production

```bash
npm run check
npm run build
npm start
```

`npm run check` menjalankan TypeScript dan Vitest. CI menjalankan pemeriksaan serta build pada setiap push/PR ke `main`. Production berjalan di port 3033; sediakan HTTPS di reverse proxy agar cookie Secure dapat digunakan. `YUKAUTO_API_URL` dibaca oleh route server pada runtime. Aplikasi ini memerlukan server Node.js dan tidak diekspor sebagai HTML statis.

Struktur utama: `app/` untuk halaman dan route proxy, `components/emcee/` untuk dashboard, `contexts/` untuk sesi pengguna, `lib/emcee/` untuk kontrak data/format/preview, `lib/server/` untuk koneksi backend, dan `integrations/` untuk pemasangan endpoint Yukauto.
