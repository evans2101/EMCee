# Endpoint monitoring EMCee untuk Yukauto

Folder ini berisi modul Rust/Axum yang ditambahkan ke backend Yukauto. Modul bukan backend mandiri: ia memakai `AppState`, koneksi PostgreSQL, envelope `ApiResponse`, error handler, dan middleware master Yukauto yang sudah ada. Tidak ada migrasi database baru.

## Pemasangan

Pada checkout backend Yukauto yang belum memiliki endpoint EMCee, salin **seluruh isi folder `finance/`** ke `src/modules/monitoring/finance/`, lalu jalankan patch pendaftaran route dari root backend:

```bash
git apply --check /path/to/EMCee/integrations/yukauto-backend/register-routes.patch
git apply /path/to/EMCee/integrations/yukauto-backend/register-routes.patch
```

Patch menambahkan `pub mod finance`, dua GET route ke `monitoring::master_router`, dan dua handler ke daftar OpenAPI. Route harus tetap berada di bawah middleware JWT dan `master_only_middleware` yang sudah melindungi `/api/v1/master/monitoring`. Jika modul/route sudah terpasang, jangan menerapkan patch kedua kali. Jika konteks file backend berubah, terapkan penambahan yang sama secara manual setelah meninjau patch.

Setelah build dan deploy backend, arahkan `YUKAUTO_API_URL` EMCee ke API tersebut.

## Kontrak

`GET /api/v1/master/monitoring/finance` menerima `from_date`, `to_date` (`YYYY-MM-DD`, tanggal WIB inklusif), `tenant_id` opsional, dan `source=all|device|gateway`. Default periode: 30 hari terakhir. Batas rentang: 366 hari.

`GET /api/v1/master/monitoring/finance/transactions` memakai filter yang sama dan menerima `search` (maksimal 200 byte), `status=all|success|pending|failed`, `direction=all|incoming|outgoing`, `limit=1..200` (default 20), serta `offset>=0`.

SQL hanya melakukan SELECT dan memakai parameter binding. Nomor rekening disamarkan oleh query. Tidak ada credential bank/PG atau kontrol transaksi yang dikembalikan. Saldo PG live dibaca melalui endpoint `master/tenants/financial-overview` Yukauto yang sudah tersedia.

## Pengujian backend

Dari root backend Yukauto:

```bash
cargo test modules::monitoring::finance
EMCEE_TEST_DATABASE_URL=postgres://user:password@localhost/test_db cargo test modules::monitoring::finance -- --include-ignored
```

Gunakan database pengujian terpisah. Tes integrasi menggunakan tabel sementara khusus koneksinya dan memeriksa deduplikasi, nominal masuk/keluar, status, isolasi tenant/channel, masking rekening, snapshot wallet, pagination, dan tanggal WIB.
