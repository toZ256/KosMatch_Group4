# KosMatch Jakarta

Web app untuk mencari dan membandingkan kos di Jakarta berdasarkan harga sewa dan **estimasi** waktu serta biaya perjalanan ke kampus/kantor.

## Tech Stack

| Layer | Teknologi |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Backend | Node.js + Express + Socket.IO + TypeScript |
| Shared | Zod schemas, TypeScript types |
| State | Zustand + TanStack Query |
| Mock AI | MockLlmProvider (lokal, tanpa API key) |
| Mock Commute | MockCommuteProvider (lokal, tanpa Maps API) |
| Persistence | InMemoryRepository (data hilang saat restart) |

## Menjalankan Lokal

### Prasyarat
- Node.js >= 20
- pnpm >= 9

### Langkah

```bash
# Install dependencies
pnpm install

# Jalankan API + Web secara bersamaan
pnpm dev
```

- **API**: http://localhost:3001/api/health
- **Web**: http://localhost:5173

### Variabel Lingkungan

API tidak membutuhkan `.env` khusus — semua mock diaktifkan otomatis.

| Variabel | Default | Keterangan |
|---|---|---|
| `PORT` | `3001` | Port server Express |
| `USE_MOCK_AI` | `true` | Aktifkan MockLlmProvider |
| `DATA_STORE` | `memory` | Aktifkan InMemoryRepository |
| `JWT_SECRET` | `dev-secret` | Secret JWT (ganti di produksi!) |

## Akun Demo

| Role | Email | Password |
|---|---|---|
| Penyewa | `tenant@kosmatch.test` | `password123` |
| Pemilik | `owner@kosmatch.test` | `password123` |

## Perintah Penting

```bash
pnpm lint        # ESLint seluruh monorepo
pnpm typecheck   # TypeScript check semua packages
pnpm test        # Vitest (unit + integrasi)
pnpm build       # Build production semua packages
```

## Struktur Monorepo

```
KosMatch_Group4/
├── apps/
│   ├── api/        # Express + Socket.IO backend
│   └── web/        # React + Vite frontend
├── packages/
│   └── shared/     # Zod schemas, TypeScript types, constants
├── docs/
│   ├── PRD.md      # Spesifikasi produk
│   └── ui/         # Screenshot desain
└── .github/
    └── workflows/
        └── ci.yml  # CI pipeline
```

## Fitur Utama

- 🔍 **Cari Kos** — filter berdasarkan budget, tipe, area, waktu tempuh
- 📍 **Estimasi Perjalanan** — ojek, transit, jalan kaki (selalu berlabel "Estimasi")
- 🤖 **AI Chatbot** — rekomendasi kos berbasis bahasa natural (mock)
- 🔖 **Simpan Kos** — bookmark kos favorit
- 💬 **Chat Real-time** — pesan langsung ke pemilik kos via Socket.IO
- 👤 **Dashboard Pemilik** — tambah, ubah, hapus listing kos
- 🔐 **Auth** — JWT login/register dengan demo account
