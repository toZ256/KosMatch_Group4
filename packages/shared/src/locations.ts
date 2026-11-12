import type { Destination } from './types';

export interface LocationHub {
  id: string;
  name: string;
  region: string;
  category: 'koridor' | 'kawasan' | 'kota';
  latitude: number;
  longitude: number;
  radiusKm: number;
  /** Lowercase aliases / street names / landmarks that map to this location hub */
  aliases: string[];
  /** Surrounding administrative districts (kecamatan) and popular sub-areas */
  nearbyAreas: string[];
}

export interface ResolvedLocation {
  hub: LocationHub;
  matchedAlias: string;
  displayName: string;
  region: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  /** Surrounding neighborhoods/districts for UI chips and query expansion */
  nearbyAreas: string[];
  /** Lowercase search tokens for matching kos name, area, kecamatan, or description */
  searchTerms: string[];
  /** Canonical area keywords for AI Chatbot params.areaKeywords */
  areaKeywords: string[];
  /** Virtual Destination object so CommuteProvider (OSRM / Haversine) can compute route estimates */
  virtualDestination: Destination;
}

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle Haversine distance in kilometers between two coordinates. */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if ((lat1 === 0 && lon1 === 0) || (lat2 === 0 && lon2 === 0)) {
    return Infinity;
  }
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Comprehensive Gazetteer of major Jakarta & Jabodetabek corridors, business districts,
 * neighborhoods, and cities with anchor coordinates, search radius, and surrounding sub-areas.
 */
export const JAKARTA_LOCATION_HUBS: LocationHub[] = [
  {
    id: 'koridor-tb-simatupang',
    name: 'TB Simatupang',
    region: 'Jakarta Selatan',
    category: 'koridor',
    latitude: -6.292,
    longitude: 106.812,
    radiusKm: 5.0,
    aliases: [
      'tb simatupang',
      'tb. simatupang',
      'simatupang',
      'jl tb simatupang',
      'jalan tb simatupang',
      'koridor simatupang',
      'cilandak',
      'fatmawati',
      'lebak bulus',
      'pondok labu',
      'cipete',
      'ampera',
      'pejaten',
      'ragunan',
      'tanjung barat',
    ],
    nearbyAreas: [
      'Cilandak',
      'Pasar Minggu',
      'Fatmawati',
      'Lebak Bulus',
      'Jagakarsa',
      'Kebayoran',
      'Pejaten',
      'Ampera',
      'Tanjung Barat',
      'Pondok Labu',
      'Cipete',
      'Jakarta Selatan',
    ],
  },
  {
    id: 'kawasan-pasar-minggu',
    name: 'Pasar Minggu & Pejaten',
    region: 'Jakarta Selatan',
    category: 'kawasan',
    latitude: -6.283,
    longitude: 106.842,
    radiusKm: 4.5,
    aliases: [
      'pasar minggu',
      'pejaten',
      'pejaten village',
      'jatipadang',
      'kebagusan',
      'ragunan',
      'tanjung barat',
      'poltangan',
    ],
    nearbyAreas: [
      'Pasar Minggu',
      'Cilandak',
      'Jagakarsa',
      'Pancoran',
      'Mampang Prapatan',
      'TB Simatupang',
      'Jakarta Selatan',
    ],
  },
  {
    id: 'kawasan-jagakarsa',
    name: 'Jagakarsa & Lenteng Agung',
    region: 'Jakarta Selatan',
    category: 'kawasan',
    latitude: -6.332,
    longitude: 106.825,
    radiusKm: 4.5,
    aliases: [
      'jagakarsa',
      'lenteng agung',
      'ciganjur',
      'srengseng sawah',
      'cipedak',
      'moh kahfi',
    ],
    nearbyAreas: [
      'Jagakarsa',
      'Pasar Minggu',
      'Cilandak',
      'Beji',
      'Cinere',
      'Jakarta Selatan',
      'Depok',
    ],
  },
  {
    id: 'kawasan-mampang-kemang',
    name: 'Kemang, Mampang & Antasari',
    region: 'Jakarta Selatan',
    category: 'kawasan',
    latitude: -6.261,
    longitude: 106.815,
    radiusKm: 4.0,
    aliases: [
      'kemang',
      'bangka',
      'mampang',
      'mampang prapatan',
      'tendean',
      'kapten tendean',
      'warung buncit',
      'antasari',
      'pangeran antasari',
      'prapanca',
      'duren tiga',
    ],
    nearbyAreas: [
      'Kemang',
      'Mampang Prapatan',
      'Kebayoran Baru',
      'Cilandak',
      'Pancoran',
      'Kebayoran',
      'Jakarta Selatan',
    ],
  },
  {
    id: 'koridor-gatsu-kuningan',
    name: 'Gatot Subroto, Kuningan & Setiabudi',
    region: 'Jakarta Selatan',
    category: 'koridor',
    latitude: -6.228,
    longitude: 106.828,
    radiusKm: 4.2,
    aliases: [
      'gatot subroto',
      'gatsu',
      'jl gatot subroto',
      'rasuna said',
      'hr rasuna said',
      'mega kuningan',
      'kuningan',
      'setiabudi',
      'karet',
      'karet kuningan',
      'semanggi',
      'scbd',
    ],
    nearbyAreas: [
      'Setiabudi',
      'Kuningan',
      'Semanggi',
      'Pancoran',
      'Tebet',
      'Mampang Prapatan',
      'Tanah Abang',
      'Jakarta Selatan',
    ],
  },
  {
    id: 'kawasan-blok-m-kebayoran',
    name: 'Blok M, Senopati & Kebayoran',
    region: 'Jakarta Selatan',
    category: 'kawasan',
    latitude: -6.244,
    longitude: 106.799,
    radiusKm: 4.5,
    aliases: [
      'kebayoran baru',
      'kebayoran lama',
      'kebayoran',
      'blok m',
      'melawai',
      'senopati',
      'gunawarman',
      'senayan',
      'gandaria',
      'radio dalam',
      'pondok indah',
      'permata hijau',
      'pesanggrahan',
      'cipulir',
      'pondok pinang',
      'panglima polim',
      'wijaya',
    ],
    nearbyAreas: [
      'Kebayoran Baru',
      'Kebayoran Lama',
      'Pesanggrahan',
      'Kebayoran',
      'Cilandak',
      'Kemang',
      'Palmerah',
      'Jakarta Selatan',
    ],
  },
  {
    id: 'kawasan-pancoran-tebet',
    name: 'Tebet, Pancoran & MT Haryono',
    region: 'Jakarta Selatan',
    category: 'kawasan',
    latitude: -6.235,
    longitude: 106.85,
    radiusKm: 4.0,
    aliases: [
      'tebet',
      'pancoran',
      'kalibata',
      'cikoko',
      'mt haryono',
      'mt. haryono',
      'manggarai',
      'kasablanka',
      'kokas',
      'kota kasablanka',
      'bukit duri',
      'pengadegan',
    ],
    nearbyAreas: [
      'Tebet',
      'Pancoran',
      'Setiabudi',
      'Kuningan',
      'Mampang Prapatan',
      'Jatinegara',
      'Kramat Jati',
      'Jakarta Selatan',
    ],
  },
  {
    id: 'koridor-sudirman-tanah-abang',
    name: 'Sudirman, Thamrin & Tanah Abang',
    region: 'Jakarta Pusat',
    category: 'koridor',
    latitude: -6.203,
    longitude: 106.818,
    radiusKm: 4.0,
    aliases: [
      'tanah abang',
      'benhil',
      'bendungan hilir',
      'kebon melati',
      'kebon kacang',
      'karet tengsin',
      'sudirman',
      'thamrin',
      'mh thamrin',
      'dukuh atas',
      'bundaran hi',
      'petamburan',
    ],
    nearbyAreas: [
      'Tanah Abang',
      'Menteng',
      'Gambir',
      'Setiabudi',
      'Semanggi',
      'Palmerah',
      'Jakarta Pusat',
    ],
  },
  {
    id: 'kawasan-menteng-cikini-salemba',
    name: 'Menteng, Cikini & Salemba',
    region: 'Jakarta Pusat',
    category: 'kawasan',
    latitude: -6.192,
    longitude: 106.842,
    radiusKm: 4.2,
    aliases: [
      'menteng',
      'cikini',
      'gondangdia',
      'sabang',
      'kebon sirih',
      'senen',
      'salemba',
      'kramat',
      'kwitang',
      'cempaka putih',
      'johar baru',
      'kemayoran',
      'sawah besar',
      'gambir',
      'harmoni',
      'pasar baru',
      'monas',
    ],
    nearbyAreas: [
      'Menteng',
      'Senen',
      'Cempaka Putih',
      'Kemayoran',
      'Gambir',
      'Sawah Besar',
      'Johar Baru',
      'Tanah Abang',
      'Matraman',
      'Jakarta Pusat',
    ],
  },
  {
    id: 'kawasan-grogol-palmerah-kemanggisan',
    name: 'Grogol, Kemanggisan & Palmerah',
    region: 'Jakarta Barat',
    category: 'kawasan',
    latitude: -6.185,
    longitude: 106.788,
    radiusKm: 4.2,
    aliases: [
      'grogol',
      'grogol petamburan',
      'tanjung duren',
      'tomang',
      'slipi',
      'palmerah',
      'kemanggisan',
      'rawa belong',
      'jelambar',
      'central park',
    ],
    nearbyAreas: [
      'Grogol Petamburan',
      'Palmerah',
      'Grogol',
      'Kemanggisan',
      'Kebon Jeruk',
      'Tanah Abang',
      'Jakarta Barat',
    ],
  },
  {
    id: 'kawasan-kebon-jeruk-puri',
    name: 'Kebon Jeruk & Puri Indah',
    region: 'Jakarta Barat',
    category: 'kawasan',
    latitude: -6.19,
    longitude: 106.755,
    radiusKm: 4.5,
    aliases: [
      'kebon jeruk',
      'kembangan',
      'puri indah',
      'meruya',
      'kedoya',
      'srengseng',
      'joglo',
    ],
    nearbyAreas: [
      'Kebon Jeruk',
      'Kembangan',
      'Palmerah',
      'Grogol Petamburan',
      'Grogol',
      'Cengkareng',
      'Jakarta Barat',
    ],
  },
  {
    id: 'kawasan-cengkareng-kalideres',
    name: 'Cengkareng, Kalideres & Daan Mogot',
    region: 'Jakarta Barat',
    category: 'kawasan',
    latitude: -6.15,
    longitude: 106.73,
    radiusKm: 5.0,
    aliases: [
      'cengkareng',
      'kalideres',
      'daan mogot',
      'taman sari',
      'tambora',
      'glodok',
      'mangga besar',
      'duri kosambi',
      'rawa buaya',
    ],
    nearbyAreas: [
      'Cengkareng',
      'Kalideres',
      'Taman Sari',
      'Tambora',
      'Kebon Jeruk',
      'Grogol Petamburan',
      'Jakarta Barat',
    ],
  },
  {
    id: 'kawasan-kelapa-gading-sunter',
    name: 'Kelapa Gading, Sunter & Tanjung Priok',
    region: 'Jakarta Utara',
    category: 'kawasan',
    latitude: -6.152,
    longitude: 106.895,
    radiusKm: 4.8,
    aliases: [
      'kelapa gading',
      'sunter',
      'tanjung priok',
      'koja',
      'cilincing',
      'pegangsaan dua',
      'moi',
      'artha gading',
    ],
    nearbyAreas: [
      'Kelapa Gading',
      'Tanjung Priok',
      'Koja',
      'Cilincing',
      'Pulo Gadung',
      'Cempaka Putih',
      'Jakarta Utara',
    ],
  },
  {
    id: 'kawasan-pik-pluit',
    name: 'PIK, Pluit & Muara Karang',
    region: 'Jakarta Utara',
    category: 'kawasan',
    latitude: -6.12,
    longitude: 106.775,
    radiusKm: 5.0,
    aliases: [
      'pik',
      'pantai indah kapuk',
      'pluit',
      'muara karang',
      'penjaringan',
      'pademangan',
      'ancol',
      'mangga dua',
    ],
    nearbyAreas: [
      'Penjaringan',
      'Pademangan',
      'Tanjung Priok',
      'Cengkareng',
      'Jakarta Utara',
    ],
  },
  {
    id: 'kawasan-rawamangun-pulogadung',
    name: 'Rawamangun, Pulo Gadung & Jatinegara',
    region: 'Jakarta Timur',
    category: 'kawasan',
    latitude: -6.195,
    longitude: 106.883,
    radiusKm: 4.5,
    aliases: [
      'rawamangun',
      'pulo gadung',
      'pulogadung',
      'pulomas',
      'matraman',
      'jatinegara',
      'kampung melayu',
      'utan kayu',
      'cipinang',
    ],
    nearbyAreas: [
      'Pulo Gadung',
      'Matraman',
      'Jatinegara',
      'Rawamangun',
      'Duren Sawit',
      'Cempaka Putih',
      'Jakarta Timur',
    ],
  },
  {
    id: 'kawasan-cawang-kramatjati',
    name: 'Cawang, Kramat Jati & Duren Sawit',
    region: 'Jakarta Timur',
    category: 'kawasan',
    latitude: -6.255,
    longitude: 106.87,
    radiusKm: 5.5,
    aliases: [
      'cawang',
      'kramat jati',
      'cililitan',
      'makasar',
      'duren sawit',
      'klender',
      'pondok bambu',
      'cakung',
      'ciracas',
      'pasar rebo',
      'cipayung',
      'cibubur',
      'condet',
    ],
    nearbyAreas: [
      'Kramat Jati',
      'Duren Sawit',
      'Cakung',
      'Ciracas',
      'Pasar Rebo',
      'Cipayung',
      'Makasar',
      'Jatinegara',
      'Pancoran',
      'Jakarta Timur',
    ],
  },
  {
    id: 'kawasan-bsd-serpong',
    name: 'BSD, Alam Sutera & Serpong',
    region: 'Tangerang Selatan',
    category: 'kawasan',
    latitude: -6.285,
    longitude: 106.665,
    radiusKm: 6.0,
    aliases: [
      'bsd',
      'bsd city',
      'serpong',
      'serpong utara',
      'alam sutera',
      'alsut',
      'gading serpong',
      'cisauk',
    ],
    nearbyAreas: [
      'Serpong',
      'Serpong Utara',
      'Cisauk',
      'Setu',
      'Pondok Aren',
      'Pinang',
      'Tangerang',
      'Tangerang Selatan',
    ],
  },
  {
    id: 'kawasan-bintaro-ciputat',
    name: 'Bintaro, Ciputat & Pamulang',
    region: 'Tangerang Selatan',
    category: 'kawasan',
    latitude: -6.285,
    longitude: 106.74,
    radiusKm: 5.5,
    aliases: [
      'bintaro',
      'pondok aren',
      'ciputat',
      'ciputat timur',
      'pamulang',
      'setu',
      'tangerang selatan',
      'tangsel',
    ],
    nearbyAreas: [
      'Pondok Aren',
      'Ciputat',
      'Ciputat Timur',
      'Pamulang',
      'Setu',
      'Pesanggrahan',
      'Kebayoran Lama',
      'Cinere',
      'Tangerang',
      'Tangerang Selatan',
    ],
  },
  {
    id: 'kawasan-karawaci-tangerang',
    name: 'Karawaci, Ciledug & Tangerang',
    region: 'Tangerang',
    category: 'kota',
    latitude: -6.21,
    longitude: 106.63,
    radiusKm: 6.0,
    aliases: [
      'karawaci',
      'kelapa dua',
      'ciledug',
      'cipondoh',
      'pinang',
      'karangtengah',
      'larangan',
      'benda',
      'neglasari',
      'jatiuwung',
      'cibodas',
      'periuk',
      'tangerang',
    ],
    nearbyAreas: [
      'Karawaci',
      'Kelapa Dua',
      'Ciledug',
      'Cipondoh',
      'Pinang',
      'Karangtengah',
      'Larangan',
      'Benda',
      'Neglasari',
      'Jatiuwung',
      'Cibodas',
      'Periuk',
      'Tangerang',
    ],
  },
  {
    id: 'kota-depok-margonda',
    name: 'Depok, Margonda & Cinere',
    region: 'Depok',
    category: 'kota',
    latitude: -6.365,
    longitude: 106.827,
    radiusKm: 5.5,
    aliases: [
      'depok',
      'depok timur',
      'depok utara',
      'depok selatan',
      'beji',
      'kukusan',
      'margonda',
      'pondok cina',
      'sukmajaya',
      'cinere',
      'sawangan',
      'limo',
      'cimanggis',
      'bojongsari',
      'tapos',
    ],
    nearbyAreas: [
      'Depok',
      'Beji',
      'Cinere',
      'Limo',
      'Cimanggis',
      'Sukmajaya',
      'Bojongsari',
      'Tapos',
      'Jagakarsa',
    ],
  },
  {
    id: 'kota-bekasi-cikarang-tambun',
    name: 'Bekasi, Tambun & Cikarang',
    region: 'Bekasi',
    category: 'kota',
    latitude: -6.28,
    longitude: 107.12,
    radiusKm: 8.0,
    aliases: [
      'tambun',
      'tambun selatan',
      'tambun utara',
      'cikarang',
      'cikarang pusat',
      'cikarang barat',
      'cikarang utara',
      'cikarang selatan',
      'cikarang timur',
      'cibitung',
      'bekasi',
      'bekasi timur',
      'bekasi barat',
      'bekasi utara',
      'bekasi selatan',
      'jatisampurna',
    ],
    nearbyAreas: [
      'Bekasi',
      'Tambun',
      'Tambun Selatan',
      'Cibitung',
      'Cikarang',
      'Cikarang Barat',
      'Cikarang Selatan',
      'Cikarang Utara',
      'Cikarang Timur',
      'Cikarang Pusat',
      'Jatisampurna',
    ],
  },
  {
    id: 'kota-bogor-sentul',
    name: 'Bogor, Sentul & Cibinong',
    region: 'Bogor',
    category: 'kota',
    latitude: -6.55,
    longitude: 106.82,
    radiusKm: 8.0,
    aliases: [
      'bogor',
      'babakan madang',
      'sentul',
      'dramaga',
      'cibinong',
      'bojonggede',
      'cileungsi',
      'gunung putri',
      'ciawi',
      'ciampea',
      'caringin',
      'sukaraja',
      'citeureup',
    ],
    nearbyAreas: [
      'Bogor',
      'Babakan Madang',
      'Dramaga',
      'Cibinong',
      'Bojonggede',
      'Cileungsi',
      'Gunung Putri',
      'Ciawi',
      'Ciampea',
      'Caringin',
      'Sukaraja',
      'Citeureup',
    ],
  },
  {
    id: 'wilayah-jakarta-selatan',
    name: 'Jakarta Selatan',
    region: 'Jakarta Selatan',
    category: 'kota',
    latitude: -6.261,
    longitude: 106.81,
    radiusKm: 7.0,
    aliases: ['jakarta selatan', 'jaksel'],
    nearbyAreas: [
      'Jakarta Selatan',
      'Kebayoran Baru',
      'Kebayoran Lama',
      'Cilandak',
      'Pasar Minggu',
      'Jagakarsa',
      'Mampang Prapatan',
      'Pancoran',
      'Tebet',
      'Setiabudi',
      'Pesanggrahan',
      'Kemang',
      'Kuningan',
      'Kebayoran',
    ],
  },
  {
    id: 'wilayah-jakarta-barat',
    name: 'Jakarta Barat',
    region: 'Jakarta Barat',
    category: 'kota',
    latitude: -6.18,
    longitude: 106.765,
    radiusKm: 6.5,
    aliases: ['jakarta barat', 'jakbar'],
    nearbyAreas: [
      'Jakarta Barat',
      'Palmerah',
      'Grogol Petamburan',
      'Kebon Jeruk',
      'Kembangan',
      'Cengkareng',
      'Kalideres',
      'Taman Sari',
      'Tambora',
      'Kemanggisan',
      'Grogol',
    ],
  },
  {
    id: 'wilayah-jakarta-pusat',
    name: 'Jakarta Pusat',
    region: 'Jakarta Pusat',
    category: 'kota',
    latitude: -6.186,
    longitude: 106.834,
    radiusKm: 5.5,
    aliases: ['jakarta pusat', 'jakpus'],
    nearbyAreas: [
      'Jakarta Pusat',
      'Tanah Abang',
      'Menteng',
      'Senen',
      'Cempaka Putih',
      'Kemayoran',
      'Gambir',
      'Sawah Besar',
      'Johar Baru',
    ],
  },
  {
    id: 'wilayah-jakarta-timur',
    name: 'Jakarta Timur',
    region: 'Jakarta Timur',
    category: 'kota',
    latitude: -6.225,
    longitude: 106.9,
    radiusKm: 7.0,
    aliases: ['jakarta timur', 'jaktim'],
    nearbyAreas: [
      'Jakarta Timur',
      'Pulo Gadung',
      'Matraman',
      'Jatinegara',
      'Kramat Jati',
      'Duren Sawit',
      'Cakung',
      'Ciracas',
      'Pasar Rebo',
      'Cipayung',
      'Makasar',
      'Rawamangun',
    ],
  },
  {
    id: 'wilayah-jakarta-utara',
    name: 'Jakarta Utara',
    region: 'Jakarta Utara',
    category: 'kota',
    latitude: -6.138,
    longitude: 106.86,
    radiusKm: 7.0,
    aliases: ['jakarta utara', 'jakut'],
    nearbyAreas: [
      'Jakarta Utara',
      'Kelapa Gading',
      'Tanjung Priok',
      'Penjaringan',
      'Pademangan',
      'Koja',
      'Cilincing',
    ],
  },
];

function toTitleCaseWords(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => {
      const upper = w.toUpperCase();
      if (['TB', 'TB.', 'MT', 'MT.', 'HR', 'SCBD', 'PIK', 'BSD', 'UI', 'UNJ', 'KRL', 'MRT'].includes(upper)) {
        return upper.replace(/\.$/, '');
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Resolves a free-text query or chat message against the Greater Jakarta Location Gazetteer.
 * Returns surrounding sub-areas (`nearbyAreas`), anchor coordinates, radius, and a virtual Destination.
 */
export function resolveLocationQuery(rawQuery: string): ResolvedLocation | null {
  const normalized = rawQuery.trim().toLowerCase().replace(/\s+/g, ' ');
  if (normalized.length < 3) return null;

  let bestHub: LocationHub | null = null;
  let bestAlias = '';
  let bestScore = -1;

  const exactById = JAKARTA_LOCATION_HUBS.find((h) => h.id.toLowerCase() === normalized);
  if (exactById) {
    bestHub = exactById;
    bestAlias = exactById.aliases[0] ?? exactById.name.toLowerCase();
    bestScore = 1000;
  }

  if (!bestHub) {
    for (const hub of JAKARTA_LOCATION_HUBS) {
      for (const alias of hub.aliases) {
        const a = alias.toLowerCase();
        const pattern = new RegExp(`(?<![a-z0-9])${escapeRegex(a)}(?![a-z0-9])`, 'i');
        if (pattern.test(normalized)) {
          // Exact full-string match gets highest priority, then longer specific corridor/district aliases over broad city names
          const isExact = normalized === a;
          const categoryBonus = hub.category === 'koridor' ? 10 : hub.category === 'kawasan' ? 5 : 0;
          const score = (isExact ? 100 : 0) + a.length * 2 + categoryBonus;
          if (score > bestScore) {
            bestScore = score;
            bestHub = hub;
            bestAlias = a;
          }
        }
      }
    }
  }

  if (!bestHub) return null;

  const aliasLabel = toTitleCaseWords(bestAlias);
  const displayName =
    bestHub.name.toLowerCase().includes(bestAlias) || bestAlias.includes(bestHub.name.toLowerCase())
      ? bestHub.name
      : `${aliasLabel} (${bestHub.name})`;

  // Build ordered areaKeywords so both specific alias (e.g. 'Tambun', 'Depok', 'TB Simatupang')
  // and surrounding kecamatan ('Cilandak', 'Pasar Minggu', 'Jakarta Selatan') are included.
  const areaKeywords: string[] = [];
  const addKw = (kw: string) => {
    const clean = kw.trim();
    if (clean && !areaKeywords.some((x) => x.toLowerCase() === clean.toLowerCase())) {
      areaKeywords.push(clean);
    }
  };

  for (const area of bestHub.nearbyAreas) {
    addKw(area);
  }
  addKw(aliasLabel);
  addKw(bestHub.region);

  const searchTerms = Array.from(
    new Set([
      bestAlias,
      bestHub.name.toLowerCase(),
      ...bestHub.nearbyAreas.map((a) => a.toLowerCase()),
    ]),
  );

  const virtualDestination: Destination = {
    id: bestHub.id,
    nama: displayName,
    kategori: bestHub.category === 'koridor' ? 'kantor' : 'kantor',
    latitude: bestHub.latitude,
    longitude: bestHub.longitude,
    aliases: bestHub.aliases,
  };

  return {
    hub: bestHub,
    matchedAlias: bestAlias,
    displayName,
    region: bestHub.region,
    latitude: bestHub.latitude,
    longitude: bestHub.longitude,
    radiusKm: bestHub.radiusKm,
    nearbyAreas: bestHub.nearbyAreas,
    searchTerms,
    areaKeywords,
    virtualDestination,
  };
}

/**
 * Evaluates whether a Kos belongs to or is in the surrounding area of a ResolvedLocation
 * using both expanded sub-area keywords and coordinate radius (Haversine).
 */
export function matchKosToLocation(
  kos: {
    namaKos: string;
    area: string;
    deskripsi?: string;
    latitude: number;
    longitude: number;
    region?: string;
    kecamatan?: string;
  },
  loc: ResolvedLocation,
): {
  matches: boolean;
  isPrimaryMatch: boolean;
  isNearbyAreaMatch: boolean;
  isWithinRadius: boolean;
  distanceKm: number;
  relevanceScore: number;
} {
  const hayPrimary = `${kos.namaKos} ${kos.area} ${kos.kecamatan ?? ''}`.toLowerCase();
  const hayFull = `${hayPrimary} ${kos.region ?? ''} ${kos.deskripsi ?? ''}`.toLowerCase();

  const aliasClean = loc.matchedAlias.replace(/\./g, '').trim();
  const isPrimaryMatch =
    hayFull.includes(loc.matchedAlias) ||
    hayFull.includes(aliasClean) ||
    (aliasClean.includes('simatupang') && hayFull.includes('simatupang'));

  // Exclude generic city names like "Jakarta Selatan" from counting as a specific sub-area keyword match
  // unless the user specifically searched for "Jakarta Selatan" / "Jaksel"
  const specificNearby = loc.nearbyAreas.filter(
    (a) =>
      !a.toLowerCase().startsWith('jakarta ') ||
      loc.hub.id.startsWith('wilayah-jakarta-'),
  );

  const isNearbyAreaMatch = specificNearby.some((areaName) =>
    hayPrimary.includes(areaName.toLowerCase()),
  );

  const distanceKm = calculateDistanceKm(
    kos.latitude,
    kos.longitude,
    loc.latitude,
    loc.longitude,
  );
  const isWithinRadius = distanceKm <= loc.radiusKm;

  const matches = isPrimaryMatch || isNearbyAreaMatch || isWithinRadius;

  // Lower relevanceScore = higher priority in sorting
  // 1. Direct name/corridor match comes first (-50 bonus)
  // 2. Specific nearby sub-area match comes second (-15 bonus)
  // 3. Sorted by physical coordinate proximity (distanceKm)
  const safeDist = Number.isFinite(distanceKm) ? distanceKm : 25;
  const relevanceScore =
    safeDist - (isPrimaryMatch ? 50 : 0) - (isNearbyAreaMatch ? 15 : 0);

  return {
    matches,
    isPrimaryMatch,
    isNearbyAreaMatch,
    isWithinRadius,
    distanceKm,
    relevanceScore,
  };
}

export interface LocationSuggestion {
  id: string;
  label: string;
  region: string;
  categoryLabel: string;
  queryValue: string;
  nearbyPreview: string;
}

/**
 * Returns popular or matching location suggestions for the Search Bar autocomplete dropdown.
 */
export function getLocationSuggestions(query: string, limit = 6): LocationSuggestion[] {
  const q = query.trim().toLowerCase();

  const mapped: LocationSuggestion[] = JAKARTA_LOCATION_HUBS.map((hub) => {
    const specificAreas = hub.nearbyAreas.filter((a) => !a.startsWith('Jakarta ')).slice(0, 4);
    return {
      id: hub.id,
      label: hub.name,
      region: hub.region,
      categoryLabel:
        hub.category === 'koridor'
          ? 'Koridor Utama'
          : hub.category === 'kawasan'
            ? 'Kawasan Populer'
            : 'Kota / Wilayah',
      queryValue: hub.name.split('/')[0]!.split('&')[0]!.trim(),
      nearbyPreview: specificAreas.join(', '),
    };
  });

  if (!q) {
    return mapped.slice(0, limit);
  }

  return mapped
    .filter((item, idx) => {
      const hub = JAKARTA_LOCATION_HUBS[idx]!;
      return (
        item.label.toLowerCase().includes(q) ||
        item.region.toLowerCase().includes(q) ||
        hub.aliases.some((a) => a.includes(q)) ||
        hub.nearbyAreas.some((a) => a.toLowerCase().includes(q))
      );
    })
    .slice(0, limit);
}
