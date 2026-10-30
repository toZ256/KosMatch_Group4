# Aturan untuk Agent — KosMatch Jakarta

Baca `docs/PRD.md` sebelum mengerjakan tugas apa pun. Aturan keras di bawah ini WAJIB dipatuhi.

1. DILARANG memakai Google Maps API atau LLM API sungguhan. Jangan instal SDK-nya, jangan buat
   request ke domain luar, jangan minta API key. Gunakan `MockLlmProvider` dan `MockCommuteProvider`.
2. FASE M2: PostgreSQL dan Prisma ORM diizinkan untuk persistensi data.
   Gunakan skema Prisma yang memetakan dataset (termasuk `kos_clean.csv`) dan letakkan implementasi
   di balik interface `Repository` (mis. `PrismaRepository`). `InMemoryRepository` tetap dipertahankan
   sebagai fallback saat pengujian/development offline.
3. Service hanya boleh bergantung pada interface (`Repository`, `LlmProvider`, `CommuteProvider`),
   bukan implementasi konkret. Implementasi dipilih lewat factory berdasarkan env
   (`USE_MOCK_AI=true`, `DATA_STORE=postgres` atau `DATA_STORE=memory`). Nilai lain: lempar error "Provider belum diimplementasikan".
4. Semua teks UI dalam BAHASA INDONESIA. Kode, nama variabel, komentar dalam Inggris.
5. Jangan ada tombol/link dummy tanpa handler. Fitur di luar cakupan (mis. Notifikasi) tetap bisa
   diklik dan menampilkan empty state yang rapi.
6. TypeScript strict. Hindari `any` (jika terpaksa, beri komentar alasan).
7. Jangan pernah mengirim `passwordHash` ke client.
8. Semua input API divalidasi Zod. Skema Zod dan tipe dibagi lewat `packages/shared`.
9. Tampilan komuter SELALU berlabel "Estimasi". Respons API memuat `isEstimate: true` dan `source: "mock"`.
10. Palet warna hanya dari design tokens Tailwind (bg, surface, ink, muted, accent, primary, line;
    sukses/bahaya hanya untuk toast/validasi).
11. Setelah tiap fase: jalankan `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
    dan perbaiki sampai hijau. Commit kecil dengan Conventional Commits (feat:, fix:, chore:, test:).
