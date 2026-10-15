import bcrypt from 'bcryptjs';
import type { Destination, Kos } from '@kosmatch/shared';
import type { Repository } from './repository';

export const DEMO_PASSWORD = 'password123';

type DestSeed = Omit<Destination, 'id'> & { id: string };

export const DESTINATION_SEED: DestSeed[] = [
  { id: 'universitas-indonesia', nama: 'Universitas Indonesia (Depok)', kategori: 'kampus', latitude: -6.362, longitude: 106.827, aliases: ['ui', 'universitas indonesia'] },
  { id: 'binus-kemanggisan', nama: 'Binus Kemanggisan', kategori: 'kampus', latitude: -6.201, longitude: 106.782, aliases: ['binus', 'kemanggisan'] },
  { id: 'universitas-trisakti', nama: 'Universitas Trisakti', kategori: 'kampus', latitude: -6.168, longitude: 106.792, aliases: ['trisakti', 'grogol'] },
  { id: 'unj-rawamangun', nama: 'UNJ Rawamangun', kategori: 'kampus', latitude: -6.195, longitude: 106.883, aliases: ['unj', 'rawamangun'] },
  { id: 'atma-jaya-semanggi', nama: 'Atma Jaya Semanggi', kategori: 'kampus', latitude: -6.219, longitude: 106.816, aliases: ['atma jaya', 'semanggi'] },
  { id: 'scbd', nama: 'SCBD', kategori: 'kantor', latitude: -6.227, longitude: 106.81, aliases: ['scbd'] },
  { id: 'sudirman-thamrin', nama: 'Sudirman / Thamrin', kategori: 'kantor', latitude: -6.203, longitude: 106.823, aliases: ['sudirman', 'thamrin'] },
  { id: 'kuningan', nama: 'Kuningan', kategori: 'kantor', latitude: -6.233, longitude: 106.83, aliases: ['kuningan'] },
  { id: 'stasiun-sudirman', nama: 'Stasiun Sudirman', kategori: 'stasiun', latitude: -6.2025, longitude: 106.823, aliases: ['stasiun sudirman'] },
  { id: 'stasiun-tebet', nama: 'Stasiun Tebet', kategori: 'stasiun', latitude: -6.226, longitude: 106.858, aliases: ['stasiun tebet'] },
  { id: 'stasiun-palmerah', nama: 'Stasiun Palmerah', kategori: 'stasiun', latitude: -6.208, longitude: 106.798, aliases: ['stasiun palmerah', 'palmerah'] },
];

type KosSeed = Omit<Kos, 'id' | 'ownerId'>;

export const KOS_SEED: KosSeed[] = [
  { namaKos: 'Kos Andalan UI', area: 'Depok', hargaSewa: 1800000, latitude: -6.364, longitude: 106.832, tipe: 'campur', fasilitas: ['AC', 'WiFi', 'Kamar Mandi Dalam', 'Parkir'], deskripsi: 'Kos nyaman berjarak dekat dari kampus UI dengan lingkungan yang tenang. Cocok untuk mahasiswa yang ingin fokus belajar.', rating: 4.8, fotoColor: '#E8B4A0' },
  { namaKos: 'Kos Eksekutif Sudirman', area: 'Tanah Abang', hargaSewa: 4500000, latitude: -6.223, longitude: 106.819, tipe: 'campur', fasilitas: ['AC', 'WiFi', 'Kamar Mandi Dalam', 'Dapur Bersama', 'Parkir', 'Laundry'], deskripsi: 'Kos eksekutif dengan fasilitas lengkap di jantung distrik bisnis. Akses mudah ke stasiun dan halte transportasi umum.', rating: 4.9, fotoColor: '#B8C4D6' },
  { namaKos: 'Kos Nyaman Kemang', area: 'Kemang', hargaSewa: 3200000, latitude: -6.261, longitude: 106.813, tipe: 'putri', fasilitas: ['AC', 'WiFi', 'Kamar Mandi Dalam', 'Laundry'], deskripsi: 'Kos putri yang asri di kawasan Kemang dengan keamanan 24 jam. Banyak kafe dan tempat makan di sekitarnya.', rating: 4.7, fotoColor: '#D9C7A3' },
  { namaKos: 'Kos Harmoni Kuningan', area: 'Kuningan', hargaSewa: 3800000, latitude: -6.23, longitude: 106.83, tipe: 'campur', fasilitas: ['AC', 'WiFi', 'Kamar Mandi Dalam', 'Dapur Bersama', 'Parkir'], deskripsi: 'Kos modern dengan desain minimalis di area Kuningan. Dekat dengan perkantoran dan pusat perbelanjaan.', rating: 4.6, fotoColor: '#A9C7C5' },
  { namaKos: 'Kos Melati Kemanggisan', area: 'Kemanggisan', hargaSewa: 2200000, latitude: -6.201, longitude: 106.784, tipe: 'putri', fasilitas: ['AC', 'WiFi', 'Laundry'], deskripsi: 'Kos putri bersih dan aman yang hanya berjarak beberapa menit dari Binus. Tersedia layanan laundry mingguan.', rating: 4.5, fotoColor: '#E3B7C8' },
  { namaKos: 'Kos Rawamangun Asri', area: 'Rawamangun', hargaSewa: 1700000, latitude: -6.195, longitude: 106.882, tipe: 'putra', fasilitas: ['WiFi', 'Kamar Mandi Dalam', 'Parkir'], deskripsi: 'Kos putra hemat di dekat UNJ dengan lingkungan yang bersahabat. Parkir motor luas dan mudah.', rating: 4.4, fotoColor: '#C5D3A8' },
  { namaKos: 'Kos Tebet Hijau', area: 'Tebet', hargaSewa: 2500000, latitude: -6.226, longitude: 106.857, tipe: 'campur', fasilitas: ['AC', 'WiFi', 'Dapur Bersama', 'Parkir'], deskripsi: 'Kos dengan banyak tanaman dan area bersama yang teduh. Hanya beberapa langkah dari Stasiun Tebet.', rating: 4.3, fotoColor: '#9FBFA3' },
  { namaKos: 'Kos Semanggi Pratama', area: 'Semanggi', hargaSewa: 3000000, latitude: -6.219, longitude: 106.808, tipe: 'putra', fasilitas: ['AC', 'WiFi', 'Kamar Mandi Dalam', 'Laundry'], deskripsi: 'Kos putra strategis dekat Atma Jaya dan kawasan Sudirman. Kamar luas dengan pencahayaan yang baik.', rating: 4.2, fotoColor: '#B5B9E0' },
  { namaKos: 'Kos Grogol Prima', area: 'Grogol', hargaSewa: 2000000, latitude: -6.166, longitude: 106.79, tipe: 'putra', fasilitas: ['AC', 'WiFi', 'Parkir'], deskripsi: 'Kos putra ekonomis dekat Universitas Trisakti. Akses mudah ke angkutan umum dan tempat makan.', rating: 4.1, fotoColor: '#E6C79C' },
  { namaKos: 'Kos Setiabudi Residence', area: 'Setiabudi', hargaSewa: 3500000, latitude: -6.215, longitude: 106.83, tipe: 'campur', fasilitas: ['AC', 'WiFi', 'Kamar Mandi Dalam', 'Dapur Bersama', 'Laundry'], deskripsi: 'Residence modern di Setiabudi dengan dapur bersama yang lengkap. Hanya sebentar ke Stasiun Sudirman dan Kuningan.', rating: 4.0, fotoColor: '#C9B1D9' },
  { namaKos: 'Kos Kebayoran Cozy', area: 'Kebayoran', hargaSewa: 2900000, latitude: -6.244, longitude: 106.799, tipe: 'putri', fasilitas: ['AC', 'WiFi', 'Kamar Mandi Dalam'], deskripsi: 'Kos putri cozy dengan suasana hangat seperti rumah sendiri. Dekat Stasiun Palmerah dan SCBD.', rating: 3.9, fotoColor: '#F0B9A8' },
  { namaKos: 'Kos Pancoran Mandiri', area: 'Pancoran', hargaSewa: 2400000, latitude: -6.244, longitude: 106.845, tipe: 'putra', fasilitas: ['WiFi', 'Parkir', 'Dapur Bersama', 'Laundry'], deskripsi: 'Kos putra mandiri di Pancoran dengan akses cepat ke Kuningan dan Tebet. Penghuni bebas memasak di dapur bersama.', rating: 3.8, fotoColor: '#A8C3D9' },
];

/** Loads demo accounts, destinations, kos, bookmarks and chats. Called on every server start. */
export async function seedRepository(repo: Repository): Promise<void> {
  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 8);

  const tenant = await repo.users.create({ nama: 'Demo Penyewa', email: 'tenant@kosmatch.test', passwordHash, role: 'tenant' });
  await repo.users.create({ nama: 'Demo Penyewa 2', email: 'tenant2@kosmatch.test', passwordHash, role: 'tenant' });
  const owner = await repo.users.create({ nama: 'Bu Sari (Pemilik)', email: 'owner@kosmatch.test', passwordHash, role: 'owner' });
  const owner2 = await repo.users.create({ nama: 'Pak Budi (Pemilik)', email: 'owner2@kosmatch.test', passwordHash, role: 'owner' });

  for (const d of DESTINATION_SEED) await repo.destinations.create(d);

  const created: Kos[] = [];
  for (const [index, k] of KOS_SEED.entries()) {
    created.push(await repo.kos.create({ ...k, ownerId: index % 2 === 0 ? owner.id : owner2.id }));
  }

  // Bookmarks for the demo tenant (Kos Andalan UI and Kos Nyaman Kemang).
  const [first, , third] = created;
  if (first) await repo.bookmarks.add(tenant.id, first.id);
  if (third) await repo.bookmarks.add(tenant.id, third.id);

  // Initial conversation (kos at index 0 belongs to `owner`).
  const base = Date.now() - 60 * 60 * 1000;
  const at = (minutes: number) => new Date(base + minutes * 60 * 1000).toISOString();
  await repo.chats.add({ senderId: tenant.id, receiverId: owner.id, pesan: 'Halo Bu, apakah Kos Andalan UI masih ada kamar kosong?', sentAt: at(0) });
  await repo.chats.add({ senderId: owner.id, receiverId: tenant.id, pesan: 'Halo! Masih ada 2 kamar kosong, silakan datang untuk melihat langsung.', sentAt: at(5) });
  await repo.chats.add({ senderId: tenant.id, receiverId: owner.id, pesan: 'Baik Bu, terima kasih. Besok sore saya mampir ya.', sentAt: at(9) });
}
