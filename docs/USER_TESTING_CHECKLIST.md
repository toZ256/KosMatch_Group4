# Lembar Pengujian Pengguna (User Acceptance Testing Checklist) — KosMatch Jakarta

Dokumen ini disusun sebagai instrumen pengujian fungsional dan penerimaan pengguna (*User Acceptance Testing* / UAT) untuk memastikan bahwa aplikasi **KosMatch Jakarta** dapat digunakan secara menyeluruh, andal, dan memenuhi spesifikasi kebutuhan perangkat lunak, baik dari sudut pandang **Calon Penyewa Kos (*Tenant*)** maupun **Pemilik Kos (*Owner*)**.

---

## 1. Panduan & Petunjuk Pengujian

1. **Akses Aplikasi:** Buka aplikasi melalui browser di `http://localhost:5173` (atau tautan deployment produksi).
2. **Koneksi Backend:** Pastikan backend API berjalan di `http://localhost:4000` (`status: ok`).
3. **Akun Pengujian (Demo Accounts):**
   - **Calon Penyewa (*Tenant*):** `tenant@kosmatch.test` / `password123` (atau klik tombol *"Masuk sebagai Demo Penyewa"*).
   - **Pemilik Kos (*Owner*):** `owner@kosmatch.test` / `password123` (atau klik tombol *"Masuk sebagai Demo Pemilik"*).
4. **Metode Pengujian:** Penguji (*evaluator* / user) melakukan langkah pengujian sesuai kolom **Langkah Pengujian**, memverifikasi apakah luaran sistem sesuai dengan **Hasil yang Diharapkan**, lalu memberi tanda centang (`[x]`) pada kolom **Status**.

---

## 2. Matriks Pengujian Fitur untuk Calon Penyewa Kos (Role: Tenant)

| No | Modul / Fitur | Skenario & Langkah Pengujian | Input / Aksi Pengguna | Hasil yang Diharapkan (*Expected Result*) | Status | Catatan |
|---|---|---|---|---|:---:|---|
| **T-01** | **Registrasi Akun Penyewa** | Pengguna baru mendaftar akun dengan peran Calon Penyewa. | Buka `/register`, isi Nama: `Rian Pratama`, Email baru, Password: `password123`, Role: `Calon Penyewa`, klik **Daftar**. | Akun berhasil dibuat, toast notifikasi sukses muncul, otomatis login dan diarahkan ke halaman beranda. | [ ] Lolos<br/>[ ] Gagal | |
| **T-02** | **Validasi Registrasi (Password Pendek)** | Pengguna mencoba mendaftar dengan password kurang dari 8 karakter. | Isi form registrasi dengan password `12345`. | Tombol submit menolak atau memunculkan pesan error *"Password minimal 8 karakter"*. | [ ] Lolos<br/>[ ] Gagal | |
| **T-03** | **Login Akun Penyewa** | Pengguna masuk menggunakan email dan password penyewa. | Buka `/login`, masukkan email penyewa dan password yang benar, klik **Masuk**. | Berhasil masuk, avatar/nama muncul di navbar, token sesi tersimpan di client. | [ ] Lolos<br/>[ ] Gagal | |
| **T-04** | **Pencarian Kos dengan Kata Kunci** | Mencari kos berdasarkan nama atau area di halaman pencarian. | Buka `/cari`, ketik `Depok` atau `Kuningan` pada search bar, tekan Enter. | Daftar kos terfilter secara real-time menampilkan kos yang berada di area terkait. | [ ] Lolos<br/>[ ] Gagal | |
| **T-05** | **Filter Rentang Harga Sewa** | Menyaring kos dengan batas harga sewa maksimal. | Di filter `/cari`, atur filter harga maksimal ke `Rp 2.500.000`. | Hanya kos dengan harga sewa $\le$ Rp 2.500.000 yang ditampilkan pada kartu kos. | [ ] Lolos<br/>[ ] Gagal | |
| **T-06** | **Filter Tipe Kos** | Menyaring kos berdasarkan kategori gender penghuni. | Pilih radio / dropdown tipe: `Putri` atau `Putra`. | Seluruh kartu kos yang tampil memiliki badge tipe sesuai filter yang dipilih. | [ ] Lolos<br/>[ ] Gagal | |
| **T-07** | **Filter Fasilitas Spesifik** | Menyaring kos yang memiliki fasilitas tertentu. | Centang filter fasilitas `AC` dan `WiFi`. | Daftar kos menampilkan kos yang memuat fasilitas AC dan WiFi pada spesifikasinya. | [ ] Lolos<br/>[ ] Gagal | |
| **T-08** | **Pencarian Kos Dekat Destinasi** | Menghitung jarak komuter ke kampus atau perkantoran. | Pilih dropdown destinasi: `Universitas Indonesia (Depok)`. | Setiap kartu kos memuat badge estimasi durasi (menit) dan perkiraan ongkos komuter ke UI Depok. | [ ] Lolos<br/>[ ] Gagal | |
| **T-09** | **Buka Halaman Detail Kos** | Melihat informasi komprehensif mengenai unit kos terpilih. | Klik salah satu kartu kos dari hasil pencarian (`/kos/:id`). | Menampilkan nama kos, galeri warna/foto, alamat lengkap, fasilitas, harga sewa, dan profil pemilik. | [ ] Lolos<br/>[ ] Gagal | |
| **T-10** | **Kalkulator Estimasi Komuter Multi-Moda** | Mengubah destinasi dan melihat variasi moda transportasi. | Di halaman detail kos, pilih destinasi `SCBD` dan ganti moda: `Ojek Online` vs `Transit Umum`. | Menampilkan rincian waktu tempuh dan tarif dengan label **"Estimasi"** (tidak klaim waktu pasti). | [ ] Lolos<br/>[ ] Gagal | |
| **T-11** | **Bookmark / Simpan Kos** | Menyimpan kos favorit agar mudah ditemukan kembali. | Klik tombol ikon bookmark (hati/pita) pada kartu atau detail kos. | Ikon bookmark aktif, toast notifikasi *"Kos disimpan"* muncul. | [ ] Lolos<br/>[ ] Gagal | |
| **T-12** | **Halaman Kos Tersimpan** | Memeriksa daftar kos yang telah disimpan sebelumnya. | Buka menu navbar **Tersimpan** (`/tersimpan`). | Menampilkan daftar seluruh kos yang telah di-bookmark oleh akun penyewa yang sedang aktif. | [ ] Lolos<br/>[ ] Gagal | |
| **T-13** | **Hapus Bookmark** | Menghapus unit kos dari daftar favorit. | Di halaman `/tersimpan`, klik tombol hapus bookmark pada unit kos. | Kos terhapus dari daftar; jika kosong, menampilkan empty state *"Belum ada kos tersimpan"*. | [ ] Lolos<br/>[ ] Gagal | |
| **T-14** | **Membuka AI Chatbot Assistant** | Mengaktifkan antarmuka chatbot interaktif. | Klik tombol melayang chatbot di pojok kanan bawah layar. | Slide-in drawer chatbot terbuka dengan sapaan pembuka dan kotak ketik pesan. | [ ] Lolos<br/>[ ] Gagal | |
| **T-15** | **Chatbot: Pencarian Bahasa Alami** | Menanyakan rekomendasi kos dengan bahasa percakapan sehari-hari. | Kirim pesan: *"Cari kos dekat UI Depok budget maksimal 2 juta yang ada AC"*. | Bot membalas ramah dan menampilkan kartu hasil kos yang cocok beserta tombol bookmark & link detail. | [ ] Lolos<br/>[ ] Gagal | |
| **T-16** | **Chatbot: Perbandingan Kos** | Meminta bot membandingkan dua kos yang diminati. | Kirim pesan: *"Bandingkan Kos Andalan UI dengan Kos Nyaman Kemang"*. | Bot menyajikan komparasi harga sewa, fasilitas unggulan, dan perkiraan waktu perjalanan. | [ ] Lolos<br/>[ ] Gagal | |
| **T-17** | **Chatbot: Guardrail Pertanyaan Luar Topik** | Menguji keamanan bot saat ditanya topik di luar kos Jakarta. | Kirim pesan: *"Siapa presiden pertama Amerika Serikat?"* atau *"Bikinkan resep nasi goreng"*. | Bot menolak secara santun dan mengarahkan kembali ke pencarian kos di wilayah Jakarta/Jabodetabek. | [ ] Lolos<br/>[ ] Gagal | |
| **T-18** | **Mulai Chat dengan Pemilik Kos** | Menghubungi pemilik kos langsung dari halaman detail kos. | Di halaman `/kos/:id`, klik tombol **Chat Pemilik**. | Membuka ruang percakapan `/chat/:ownerId` dengan nama pemilik kos di bagian header. | [ ] Lolos<br/>[ ] Gagal | |
| **T-19** | **Kirim & Terima Pesan Real-Time** | Mengirim pesan teks pertanyaan kepada pemilik kos. | Ketik: *"Halo Bu, apakah kamar kos masih tersedia untuk survei besok?"*, klik Kirim. | Pesan muncul seketika di ruang obrolan, status pesan terkirim, dan tersimpan di riwayat obrolan. | [ ] Lolos<br/>[ ] Gagal | |
| **T-20** | **Logout Akun Penyewa** | Mengakhiri sesi akun penyewa di perangkat. | Klik menu profil di kanan atas, pilih **Keluar**. | Token sesi terhapus, navbar kembali menampilkan tombol Masuk/Daftar, diarahkan ke Landing Page. | [ ] Lolos<br/>[ ] Gagal | |

---

## 3. Matriks Pengujian Fitur untuk Pemilik Kos (Role: Owner)

| No | Modul / Fitur | Skenario & Langkah Pengujian | Input / Aksi Pengguna | Hasil yang Diharapkan (*Expected Result*) | Status | Catatan |
|---|---|---|---|---|:---:|---|
| **O-01** | **Login Akun Pemilik Kos** | Pemilik kos masuk ke sistem menggunakan kredensial pemilik. | Buka `/login`, klik tombol cepat **"Masuk sebagai Demo Pemilik"** (atau email `owner@kosmatch.test`). | Berhasil login, navbar menampilkan menu khusus pemilik yaitu **Kelola Kos** (`/owner/kos`). | [ ] Lolos<br/>[ ] Gagal | |
| **O-02** | **Akses Dashboard Pemilik** | Membuka halaman manajemen listing properti kos. | Klik menu **Kelola Kos** pada navbar atas. | Menampilkan tabel/kartu daftar semua kos yang dimiliki oleh akun pemilik yang sedang login. | [ ] Lolos<br/>[ ] Gagal | |
| **O-03** | **Buka Formulir Tambah Kos Baru** | Mengakses halaman form pendaftaran kos baru. | Di halaman `/owner/kos`, klik tombol oranye **Tambah Kos**. | Diarahkan ke `/owner/kos/baru`, menampilkan formulir dengan validasi Zod lengkap. | [ ] Lolos<br/>[ ] Gagal | |
| **O-04** | **Validasi Form Tambah Kos (Harga Tidak Wajar)** | Menguji batas bawah validasi harga sewa. | Isi nama kos, area, lalu masukkan harga sewa `50000` (Rp 50.000). | Form menampilkan pesan error validasi: *"Harga minimal Rp 100.000"*. | [ ] Lolos<br/>[ ] Gagal | |
| **O-05** | **Simpan Kos Baru Berhasil** | Menambahkan listing properti kos baru ke sistem. | Isi Nama: `Kos Melati Suite Tebet`, Area: `Tebet`, Harga: `2500000`, Lat: `-6.226`, Lng: `106.858`, Tipe: `Putri`, Fasilitas: `AC`, `WiFi`, Deskripsi lengkap (>10 char), klik **Simpan Kos**. | Notifikasi toast sukses muncul, data tersimpan di database, otomatis redirect kembali ke daftar kos pemilik. | [ ] Lolos<br/>[ ] Gagal | |
| **O-06** | **Listing Baru Muncul di Publik** | Memverifikasi kos yang baru ditambahkan langsung dapat dicari penyewa. | Buka tab samaran (*incognito*) atau cari di `/cari` dengan kata kunci `Kos Melati Suite Tebet`. | Kos baru langsung muncul dalam daftar hasil pencarian publik lengkap dengan fasilitas dan harganya. | [ ] Lolos<br/>[ ] Gagal | |
| **O-07** | **Edit Informasi Kos** | Memperbarui tarif sewa atau fasilitas kos yang sudah terdaftar. | Di dashboard pemilik, klik tombol **Ubah** pada salah satu kos, ubah harga menjadi `Rp 2.700.000`, klik **Perbarui**. | Perubahan harga berhasil disimpan, toast sukses muncul, harga di dashboard dan publik terbarui. | [ ] Lolos<br/>[ ] Gagal | |
| **O-08** | **Modal Konfirmasi Hapus Kos** | Menguji keamanan penghapusan agar tidak tertekan tidak sengaja. | Di dashboard pemilik, klik tombol **Hapus** pada salah satu unit kos. | Muncul modal pop-up konfirmasi pembatalan/penghapusan kos (*"Apakah Anda yakin?"*). | [ ] Lolos<br/>[ ] Gagal | |
| **O-09** | **Eksekusi Hapus Kos** | Menghapus listing kos dari database. | Pada modal konfirmasi hapus, klik **Ya, Hapus**. | Listing kos hilang dari tabel pemilik dan tidak lagi ditemukan di hasil pencarian publik. | [ ] Lolos<br/>[ ] Gagal | |
| **O-10** | **Melihat Pesan Masuk dari Penyewa** | Menerima dan merespons pertanyaan calon penyewa. | Buka menu **Chat** (`/chat`). | Daftar percakapan memuat nama penyewa yang menghubungi beserta cuplikan pesan terakhir. | [ ] Lolos<br/>[ ] Gagal | |
| **O-11** | **Membalas Pesan Calon Penyewa Real-Time** | Menjawab ketersediaan kamar kepada calon penyewa. | Buka ruang chat penyewa, ketik: *"Kamar kos masih ada 1 kamar kosong, silakan datang survei"*, tekan Kirim. | Pesan terkirim secara real-time via Socket.IO dan langsung diterima oleh penyewa tanpa reload halaman. | [ ] Lolos<br/>[ ] Gagal | |

---

## 4. Matriks Pengujian Pengunjung Umum & Keamanan Akses (Security & Edge Cases)

| No | Modul / Fitur | Skenario & Langkah Pengujian | Input / Aksi Pengguna | Hasil yang Diharapkan (*Expected Result*) | Status | Catatan |
|---|---|---|---|---|:---:|---|
| **S-01** | **Akses Fitur Terproteksi Tanpa Login** | Pengunjung belum login mencoba mengakses halaman bookmark atau chat. | Buka langsung URL `http://localhost:5173/tersimpan` atau `http://localhost:5173/chat`. | Otomatis dialihkan (*redirect*) ke halaman `/login?redirect=...` dengan pesan agar masuk terlebih dahulu. | [ ] Lolos<br/>[ ] Gagal | |
| **S-02** | **Proteksi Hak Akses Role (RBAC)** | Akun Calon Penyewa mencoba membuka URL dashboard Pemilik Kos. | Login sebagai Penyewa, lalu ketik manual URL `/owner/kos` di browser. | Sistem menolak akses dan mengembalikan status **403 Forbidden** atau dialihkan ke halaman utama. | [ ] Lolos<br/>[ ] Gagal | |
| **S-03** | **Perlindungan Password Hash** | Memeriksa response network di Developer Tools browser. | Buka tab Network di Inspect Element saat Login atau memanggil endpoint `/api/auth/me`. | Properti `passwordHash` **sama sekali tidak dikirimkan** dalam respon JSON ke browser pengguna. | [ ] Lolos<br/>[ ] Gagal | |
| **S-04** | **Halaman Rute Tidak Ditemukan (404)** | Pengguna mengakses alamat URL yang tidak terdaftar di sistem. | Ketik alamat URL acak seperti `http://localhost:5173/halaman-ngawur`. | Menampilkan antarmuka ramah 404 (*"Halaman Tidak Ditemukan"*) disertai tombol kembali ke Beranda. | [ ] Lolos<br/>[ ] Gagal | |
| **S-05** | **Empty State Notifikasi** | Membuka fitur notifikasi yang belum memiliki data. | Klik menu **Notifikasi** (`/notifikasi`). | Tampil halaman rapi dengan ilustrasi dan teks *"Belum ada notifikasi baru"*, tanpa broken link. | [ ] Lolos<br/>[ ] Gagal | |

---

## 5. Ringkasan Hasil Pengujian Pengguna

- **Total Skenario Uji:** 36 Skenario
- **Skenario Penyewa (*Tenant*):** 20 Skenario
- **Skenario Pemilik (*Owner*):** 11 Skenario
- **Skenario Publik & Keamanan (*Security*):** 5 Skenario
- **Kesimpulan UAT:**
  - `[ ]` **DITERIMA TANPA REVISI:** Semua fitur esensial berfungsi sesuai kriteria penerimaan pengguna.
  - `[ ]` **DITERIMA DENGAN CATATAN MINOR:** Fitur utama berfungsi, terdapat catatan kecil pada UI/teks.
  - `[ ]` **DITOLAK:** Terdapat fungsionalitas kritis yang gagal beroperasi.

**Tanggal Pengujian:** ____________________  
**Nama Penguji / Mahasiswa:** ____________________  
**Tanda Tangan Penguji:** ____________________
