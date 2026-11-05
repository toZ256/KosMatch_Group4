# KosMatch Jakarta

Web app untuk mencari dan membandingkan kos di Jakarta berdasarkan harga sewa dan **estimasi** waktu serta biaya perjalanan ke kampus/kantor.

## Tech Stack

| Layer | Teknologi |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Backend | Node.js + Express + Socket.IO + TypeScript |
| Database & ORM | PostgreSQL (Neon Cloud) + Prisma ORM |
| Shared | Zod schemas, TypeScript types |
| State | Zustand + TanStack Query |
| Mock AI | MockLlmProvider (lokal, tanpa API key) |
| Mock Commute | MockCommuteProvider (lokal, tanpa Maps API) |
| Persistence | PrismaRepository (PostgreSQL) + InMemoryRepository (fallback offline) |

---

## Panduan Menjalankan di Laptop Baru

### 1. Prasyarat Sistem
Pastikan laptop sudah terpasang:
- **Node.js** >= 20 ([Unduh Node.js](https://nodejs.org/))
- **pnpm** >= 9 (Instal via terminal: `npm install -g pnpm@9.15.9`)
- **Git**

### 2. Langkah Setup (Cloning & Install)

Buka terminal (PowerShell / Command Prompt / Terminal Mac/Linux) dan jalankan:

```bash
# 1. Clone repository dari GitHub
git clone https://github.com/toZ256/KosMatch_Group4.git
cd KosMatch_Group4

# 2. Install dependensi seluruh monorepo
pnpm install

# 3. Setup file environment (.env)
# Salin template .env.example menjadi .env
cp .env.example .env
```

> [!TIP]
> Buka file `.env` yang baru dibuat, lalu isi variabel `DATABASE_URL` dengan connection string PostgreSQL (misal Neon Cloud kelompok Anda).
> Jika laptop sedang **offline** / tanpa internet, ubah `DATA_STORE=memory` di file `.env` agar aplikasi tetap berjalan menggunakan RAM sementara.

### 3. Generate Prisma Client & Database (Jika menggunakan PostgreSQL)

```bash
# Generate Prisma Client
pnpm db:generate

# Sinkronkan skema ke database (jika database baru)
pnpm db:push

# Masukkan 2.308 data kos dari CSV (jika database masih kosong)
pnpm db:seed
```

### 4. Jalankan Aplikasi

```bash
pnpm dev
```

Aplikasi akan otomatis menyala di dua port:
- **Frontend Web**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:4000/api/health](http://localhost:4000/api/health)

---

## Variabel Lingkungan (.env)

| Variabel | Default | Keterangan |
|---|---|---|
| `PORT` | `4000` | Port server Express |
| `USE_MOCK_AI` | `true` | Aktifkan MockLlmProvider |
| `DATA_STORE` | `postgres` | `postgres` (Prisma) atau `memory` (RAM) |
| `DATABASE_URL` | - | Connection string PostgreSQL (Neon/Localhost) |
| `JWT_SECRET` | `change-me-in-production` | Secret kunci JWT |
| `CORS_ORIGIN` | `http://localhost:5173` | Domain client yang diizinkan |

---

## Akun Demo Cepat

Di halaman login (`/login`) tersedia tombol otomatis, atau bisa diketik manual:

| Role | Email | Password |
|---|---|---|
| Calon Penyewa | `tenant@kosmatch.test` | `password123` |
| Pemilik Kos | `owner@kosmatch.test` | `password123` |

---

## Perintah Pengujian & Kualitas Kode

```bash
pnpm lint        # ESLint seluruh monorepo
pnpm typecheck   # TypeScript compiler check semua package
pnpm test        # Vitest (53 unit + integration test suite)
pnpm build       # Build production seluruh aplikasi
pnpm db:studio   # Buka Prisma Studio (GUI Database)
```

---

## Struktur Monorepo

```
KosMatch_Group4/
├── apps/
│   ├── api/        # Express + Socket.IO + PrismaRepository
│   └── web/        # React + Vite + Tailwind CSS frontend
├── packages/
│   └── shared/     # Zod schemas, TypeScript types, constants
├── prisma/
│   ├── schema.prisma # Skema relasional PostgreSQL
│   └── seed.js       # Script seeding pembaca kos_clean.csv
├── docs/           # PRD.md, PROGRESS.md, chapter4/
└── .github/
    └── workflows/  # ci.yml (GitHub Actions Pipeline)
```
