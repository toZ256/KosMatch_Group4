import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import csv from 'csv-parser';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

// Helper untuk parsing float opsional (menangani null, undefined, string kosong, dan NaN)
function parseOptionalFloat(val) {
  if (val === undefined || val === null) return null;
  const str = String(val).trim();
  if (str === '' || str.toLowerCase() === 'nan' || str.toLowerCase() === 'null') return null;
  const parsed = parseFloat(str);
  return Number.isNaN(parsed) ? null : parsed;
}

// Helper untuk parsing integer opsional
function parseOptionalInt(val, fallback = 0) {
  if (val === undefined || val === null) return fallback;
  const str = String(val).trim();
  if (str === '' || str.toLowerCase() === 'nan') return fallback;
  const parsed = parseInt(str, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

// Helper untuk konversi tipe boolean dari teks CSV
function parseBoolean(val) {
  if (typeof val === 'boolean') return val;
  if (!val) return false;
  const s = String(val).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'ya' || s === 'yes';
}

async function seedKosFromCsv() {
  const csvFilePath = path.resolve(__dirname, '../kos_clean.csv');

  if (!fs.existsSync(csvFilePath)) {
    throw new Error(`File dataset kos tidak ditemukan di: ${csvFilePath}`);
  }

  console.log(`[1/3] Membaca dataset dari: ${csvFilePath}...`);
  const records = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (row) => {
        records.push({
          id: String(row.id || '').trim(),
          namaKos: String(row.namaKos || '').trim(),
          area: String(row.area || '').trim(),
          region: String(row.region || '').trim(),
          kecamatan: String(row.kecamatan || '').trim(),
          tipe: String(row.tipe || 'campur').trim(),
          fasilitas: String(row.fasilitas || '').trim(),
          hargaSewa: parseOptionalInt(row.hargaSewa, 0),
          lat: parseFloat(row.lat) || 0.0,
          lng: parseFloat(row.lng) || 0.0,
          luasM2: parseOptionalFloat(row.luasM2),
          rating: parseOptionalFloat(row.rating),
          sisaKamar: parseOptionalFloat(row.sisaKamar),
          jumlahUlasan: parseOptionalInt(row.jumlahUlasan, 0),
          transaksiBerhasil: parseOptionalInt(row.transaksiBerhasil, 0),
          deskripsi: row.deskripsi ? String(row.deskripsi).trim() : null,
          fotoColor: row.fotoColor ? String(row.fotoColor).trim() : '#B8C4D6',
          listrikTermasuk: parseBoolean(row.listrikTermasuk),
          dalamJakarta: parseBoolean(row.dalamJakarta),
        });
      })
      .on('end', resolve)
      .on('error', reject);
  });

  console.log(`[2/3] Berhasil memproses ${records.length} data properti kos dari CSV.`);
  console.log('Menyimpan ke database PostgreSQL menggunakan batch createMany...');

  const batchSize = 100;
  let totalInserted = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const chunk = records.slice(i, i + batchSize);
    await prisma.kos.createMany({
      data: chunk,
      skipDuplicates: true,
    });
    totalInserted += chunk.length;
    if (totalInserted % 500 === 0 || totalInserted === records.length) {
      console.log(`  -> Berhasil memasukkan ${totalInserted}/${records.length} data kos...`);
    }
  }

  console.log(`✅ ${records.length} data kos berhasil disimpan ke tabel "Kos".`);
}

async function seedDemoUsersAndDestinations() {
  console.log('[3/3] Memeriksa akun demo dan destinasi komuter...');

  const passwordHash = bcrypt.hashSync('password123', 8);

  const users = [
    { nama: 'Demo Penyewa', email: 'tenant@kosmatch.test', passwordHash, role: 'tenant' },
    { nama: 'Demo Penyewa 2', email: 'tenant2@kosmatch.test', passwordHash, role: 'tenant' },
    { nama: 'Bu Sari (Pemilik)', email: 'owner@kosmatch.test', passwordHash, role: 'owner' },
    { nama: 'Pak Budi (Pemilik)', email: 'owner2@kosmatch.test', passwordHash, role: 'owner' },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: user,
    });
  }

  const destinations = [
    { id: 'universitas-indonesia', nama: 'Universitas Indonesia (Depok)', kategori: 'kampus', latitude: -6.362, longitude: 106.827, aliases: JSON.stringify(['ui', 'universitas indonesia']) },
    { id: 'binus-kemanggisan', nama: 'Binus Kemanggisan', kategori: 'kampus', latitude: -6.201, longitude: 106.782, aliases: JSON.stringify(['binus', 'kemanggisan']) },
    { id: 'universitas-trisakti', nama: 'Universitas Trisakti', kategori: 'kampus', latitude: -6.168, longitude: 106.792, aliases: JSON.stringify(['trisakti', 'grogol']) },
    { id: 'unj-rawamangun', nama: 'UNJ Rawamangun', kategori: 'kampus', latitude: -6.195, longitude: 106.883, aliases: JSON.stringify(['unj', 'rawamangun']) },
    { id: 'atma-jaya-semanggi', nama: 'Atma Jaya Semanggi', kategori: 'kampus', latitude: -6.219, longitude: 106.816, aliases: JSON.stringify(['atma jaya', 'semanggi']) },
    { id: 'scbd', nama: 'SCBD', kategori: 'kantor', latitude: -6.227, longitude: 106.81, aliases: JSON.stringify(['scbd']) },
    { id: 'sudirman-thamrin', nama: 'Sudirman / Thamrin', kategori: 'kantor', latitude: -6.203, longitude: 106.823, aliases: JSON.stringify(['sudirman', 'thamrin']) },
    { id: 'kuningan', nama: 'Kuningan', kategori: 'kantor', latitude: -6.233, longitude: 106.83, aliases: JSON.stringify(['kuningan']) },
    { id: 'stasiun-sudirman', nama: 'Stasiun Sudirman', kategori: 'stasiun', latitude: -6.2025, longitude: 106.823, aliases: JSON.stringify(['stasiun sudirman']) },
    { id: 'stasiun-tebet', nama: 'Stasiun Tebet', kategori: 'stasiun', latitude: -6.226, longitude: 106.858, aliases: JSON.stringify(['stasiun tebet']) },
    { id: 'stasiun-palmerah', nama: 'Stasiun Palmerah', kategori: 'stasiun', latitude: -6.208, longitude: 106.798, aliases: JSON.stringify(['stasiun palmerah', 'palmerah']) },
  ];

  for (const dest of destinations) {
    await prisma.destination.upsert({
      where: { id: dest.id },
      update: {},
      create: dest,
    });
  }

  console.log('✅ Akun demo dan destinasi komuter siap digunakan.');
}

async function main() {
  console.log('==============================================');
  console.log('🌱 Memulai Seeding Database KosMatch Jakarta');
  console.log('==============================================');

  await seedKosFromCsv();
  await seedDemoUsersAndDestinations();

  console.log('==============================================');
  console.log('🎉 Seeding database berhasil diselesaikan!');
  console.log('==============================================');
}

main()
  .catch((e) => {
    console.error('❌ Terjadi kesalahan saat melakukan seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
