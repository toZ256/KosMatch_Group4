import {
  ChatParamsSchema,
  MAX_TOOLS_PER_TURN,
  resolveLocationQuery,
  type ChatParams,
  type Destination,
  type Kos,
  type WhatsAppIntent,
} from '@kosmatch/shared';
import type { LlmProvider, ProposedToolCall, RagContext, ToolDetectionContext } from './LlmProvider';

const formatRp = (n: number) => `Rp${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const COST_KEYWORDS = /(ojek|ongkos|transport|biaya perjalanan|biaya|transit|krl|kereta|bus)/;
const UNIT_MULTIPLIER: Record<string, number> = {
  juta: 1_000_000,
  jt: 1_000_000,
  ribu: 1_000,
  rb: 1_000,
  k: 1_000,
};
const RENT_THRESHOLD = 500_000;

const FACILITY_EXTRACTORS: Array<{ pattern: RegExp; label: string }> = [
  {
    pattern: /\b(kamar mandi dal[ae]m|km dal[ae]m|k\.\s*mandi dal[ae]m|wc dal[ae]m|mandi sendiri|mandi di dal[ae]m)\b/i,
    label: 'Kamar Mandi Dalam',
  },
  { pattern: /\b(ac|ber-ac|dingin)\b/i, label: 'AC' },
  { pattern: /\b(wifi|wi-fi|internet|wfh)\b/i, label: 'WiFi' },
  { pattern: /\b(parkir|parkiran|bawa motor|bawa mobil)\b/i, label: 'Parkir' },
  { pattern: /\b(kasur|tempat tidur)\b/i, label: 'Kasur' },
  { pattern: /\blemari\b/i, label: 'Lemari' },
  { pattern: /\bmeja(?!\s+(?:biliar|billiard|pingpong|tenis|karambol|makan))\b/i, label: 'Meja' },
  { pattern: /\b(dapur|masak)\b/i, label: 'Dapur' },
];

const OUT_OF_SCOPE_EXTRACTORS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(meja\s+makan|dining\s+table)\b/i, label: 'Meja Makan' },
  { pattern: /\b(kursi\s+pij[ae]t|massage\s+chair)\b/i, label: 'Kursi Pijat' },
  { pattern: /\b(meja\s+(?:biliar|billiard|pingpong|tenis|karambol)|biliar|billiard|tenis meja|pingpong)\b/i, label: 'Meja Biliar' },
  { pattern: /\b(pemancingan|tempat mancing|kolam mancing|kolam pemancingan|mancing)\b/i, label: 'Pemancingan' },
  { pattern: /\b(kolam\s+renang(?:\s+pribadi)?|private\s+pool|swimming\s+pool)\b/i, label: 'Kolam Renang' },
  { pattern: /\b(gym|fitness center|tempat gym|fitness)\b/i, label: 'Gym' },
  { pattern: /\b(lapangan(?:\s+(?:sepak\s*bola|bola|futsal|tenis|basket|badminton))?|futsal|tenis|basket|badminton)\b/i, label: 'Fasilitas Olahraga' },
  { pattern: /\b(balkon|balcony)\b/i, label: 'Balkon' },
  { pattern: /\b(rooftop|roof top)\b/i, label: 'Rooftop' },
  { pattern: /\b(sauna|steam room)\b/i, label: 'Sauna' },
  { pattern: /\b(bathtub|bath tub)\b/i, label: 'Bathtub' },
  { pattern: /\b(ps5|ps 5|playstation|playstation 5)\b/i, label: 'PS5' },
  { pattern: /\b(helipad|heliport|landasan heli)\b/i, label: 'Helipad' },
  { pattern: /\b(jacuzzi|whirlpool)\b/i, label: 'Jacuzzi' },
  { pattern: /\b(lift pribadi|private lift)\b/i, label: 'Lift Pribadi' },
  { pattern: /\b(bioskop pribadi|private cinema)\b/i, label: 'Bioskop Pribadi' },
  { pattern: /\b(pelayan pribadi|butler)\b/i, label: 'Pelayan Pribadi' },
  { pattern: /\b(hewan buas|binatang buas)\b/i, label: 'Hewan Buas' },
];

const NON_CATALOG_DESTINATIONS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(itb|institut\s+teknologi\s+bandung)\b/i, label: 'Kampus ITB' },
  { pattern: /\b(ugm|universitas\s+gad[jh]ah\s+mada)\b/i, label: 'Kampus UGM' },
  { pattern: /\b(undip|universitas\s+diponegoro)\b/i, label: 'Kampus UNDIP' },
  { pattern: /\b(unair|universitas\s+airlangga)\b/i, label: 'Kampus UNAIR' },
  { pattern: /\b(its|institut\s+teknologi\s+sepuluh\s+nopember)\b/i, label: 'Kampus ITS' },
  { pattern: /\b(unpad|universitas\s+padjadjaran)\b/i, label: 'Kampus UNPAD' },
  { pattern: /\b(ipb|institut\s+pertanian\s+bogor)\b/i, label: 'Kampus IPB' },
  { pattern: /\b(kampus\s+paramadina|paramadina)\b/i, label: 'Kampus Paramadina' },
  { pattern: /\b(upn|upn\s+veteran)\b/i, label: 'Kampus UPN Veteran' },
  { pattern: /\b(mercu\s*buana)\b/i, label: 'Universitas Mercu Buana' },
  { pattern: /\b(gunadarma|gundar)\b/i, label: 'Universitas Gunadarma' },
  { pattern: /\b(uin\s+(?:syarif|jakarta)?)\b/i, label: 'UIN Syarif Hidayatullah' },
  { pattern: /\b(moestopo)\b/i, label: 'Universitas Moestopo' },
  { pattern: /\b(al\s*azhar|uai)\b/i, label: 'Universitas Al Azhar Indonesia' },
  { pattern: /\b(telkom\s+(?:jakarta|jkt|bandung)?)\b/i, label: 'Telkom University' },
  { pattern: /\b(tarumanagara|untar)\b/i, label: 'Universitas Tarumanagara' },
  { pattern: /\b(esa\s*unggul)\b/i, label: 'Universitas Esa Unggul' },
  { pattern: /\b(perbanas)\b/i, label: 'Perbanas Institute' },
  { pattern: /\b(bakrie)\b/i, label: 'Universitas Bakrie' },
  { pattern: /\b(unpam)\b/i, label: 'Universitas Pamulang' },
];

const UNSUPPORTED_POI_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(rumah sakit|rs(?:u|ud|ia)?|hospital)\b/i, label: 'Titik Rumah Sakit' },
  { pattern: /\b(bandara|airport|soekarno\s*hatta|soetta|halim)\b/i, label: 'Titik Bandara' },
  { pattern: /\b(mall|plaza|grand indonesia|central park)\b/i, label: 'Titik Mall' },
  { pattern: /\b(terminal(?:\s+bus)?)\b/i, label: 'Titik Terminal Bus' },
  { pattern: /\b(pelabuhan|tanjung\s*priok)\b/i, label: 'Titik Pelabuhan' },
];

const SUB_AREA_PATTERNS: Array<{ pattern: RegExp; keywords: string[] }> = [
  {
    pattern: /\b(tb\.?\s*simatupang|simatupang|cilandak|fatmawati|lebak\s*bulus|pondok\s*labu|cipete)\b/i,
    keywords: ['TB Simatupang', 'Cilandak', 'Pasar Minggu', 'Fatmawati', 'Lebak Bulus', 'Jakarta Selatan', 'Kebayoran'],
  },
  {
    pattern: /\b(pasar\s*minggu|pejaten|ampera|ragunan|tanjung\s*barat)\b/i,
    keywords: ['Pasar Minggu', 'Cilandak', 'Pejaten', 'TB Simatupang', 'Jakarta Selatan', 'Pancoran'],
  },
  {
    pattern: /\b(jagakarsa|lenteng\s*agung|ciganjur|srengseng\s*sawah)\b/i,
    keywords: ['Jagakarsa', 'Pasar Minggu', 'Jakarta Selatan', 'Depok'],
  },
  {
    pattern: /\b(mampang(?:\s+prapatan)?|tendean|warung\s*buncit|antasari)\b/i,
    keywords: ['Mampang Prapatan', 'Kemang', 'Jakarta Selatan'],
  },
  {
    pattern: /\b(kemang|bangka)\b/i,
    keywords: ['Kemang', 'Mampang Prapatan', 'Kebayoran Baru', 'Jakarta Selatan'],
  },
  {
    pattern: /\b(gatot\s*subroto|gatsu|rasuna\s*said|mega\s*kuningan|setiabudi|karet)\b/i,
    keywords: ['Setiabudi', 'Kuningan', 'Pancoran', 'Jakarta Selatan'],
  },
  {
    pattern: /\b(kebayoran(?:\s+(?:baru|lama))?|blok\s*m|senopati|senayan|gandaria|radio\s*dalam|pondok\s*indah|permata\s*hijau|pesanggrahan)\b/i,
    keywords: ['Kebayoran Baru', 'Kebayoran Lama', 'Pesanggrahan', 'Kebayoran', 'Jakarta Selatan'],
  },
  {
    pattern: /\b(pancoran|kalibata|duren\s*tiga|cikoko|mt\.?\s*haryono)\b/i,
    keywords: ['Pancoran', 'Tebet', 'Jakarta Selatan'],
  },
  {
    pattern: /\b(tebet|manggarai|kasablanka|kokas|bukit\s*duri)\b/i,
    keywords: ['Tebet', 'Jakarta Selatan'],
  },
  {
    pattern: /\b(tanah\s*abang|benhil|bendungan\s*hilir|kebon\s*melati)\b/i,
    keywords: ['Tanah Abang', 'Jakarta Pusat'],
  },
  {
    pattern: /\b(menteng|cikini|gondangdia|sabang)\b/i,
    keywords: ['Menteng', 'Tanah Abang', 'Jakarta Pusat'],
  },
  {
    pattern: /\b(senen|salemba|kramat|kwitang|cempaka\s*putih|johar\s*baru|kemayoran|sawah\s*besar|gambir|harmoni|pasar\s*baru)\b/i,
    keywords: ['Senen', 'Cempaka Putih', 'Kemayoran', 'Gambir', 'Sawah Besar', 'Johar Baru', 'Jakarta Pusat'],
  },
  {
    pattern: /\b(kebon\s*jeruk|kembangan|puri\s*indah|meruya|kedoya)\b/i,
    keywords: ['Kebon Jeruk', 'Kembangan', 'Jakarta Barat', 'Grogol'],
  },
  {
    pattern: /\b(grogol(?:\s+petamburan)?|tanjung\s*duren|tomang|slipi|palmerah|kemanggisan)\b/i,
    keywords: ['Grogol Petamburan', 'Palmerah', 'Grogol', 'Kemanggisan', 'Jakarta Barat'],
  },
  {
    pattern: /\b(cengkareng|kalideres|daan\s*mogot|taman\s*sari|tambora|glodok|mangga\s*besar)\b/i,
    keywords: ['Cengkareng', 'Kalideres', 'Taman Sari', 'Tambora', 'Jakarta Barat'],
  },
  {
    pattern: /\b(kelapa\s*gading|sunter|tanjung\s*priok|koja|cilincing)\b/i,
    keywords: ['Kelapa Gading', 'Tanjung Priok', 'Koja', 'Cilincing', 'Jakarta Utara'],
  },
  {
    pattern: /\b(pluit|muara\s*karang|pik|pantai\s*indah\s*kapuk|penjaringan|pademangan|ancol|mangga\s*dua)\b/i,
    keywords: ['Penjaringan', 'Pademangan', 'Jakarta Utara'],
  },
  {
    pattern: /\b(rawamangun|pulo\s*gadung|pulomas|matraman|jatinegara|kampung\s*melayu)\b/i,
    keywords: ['Pulo Gadung', 'Matraman', 'Jatinegara', 'Rawamangun', 'Jakarta Timur'],
  },
  {
    pattern: /\b(cawang|kramat\s*jati|cililitan|makasar|duren\s*sawit|klender|pondok\s*bambu|cakung|ciracas|pasar\s*rebo|cipayung|cibubur)\b/i,
    keywords: ['Kramat Jati', 'Duren Sawit', 'Cakung', 'Ciracas', 'Pasar Rebo', 'Cipayung', 'Makasar', 'Jakarta Timur'],
  },
  {
    pattern: /\b(bsd|serpong(?:\s+utara)?|alam\s*sutera|gading\s*serpong)\b/i,
    keywords: ['Serpong', 'Serpong Utara', 'Tangerang'],
  },
  {
    pattern: /\b(bintaro|pondok\s*aren|ciputat(?:\s+timur)?|pamulang|setu)\b/i,
    keywords: ['Pondok Aren', 'Ciputat', 'Ciputat Timur', 'Pamulang', 'Tangerang'],
  },
  {
    pattern: /\b(karawaci|kelapa\s*dua|ciledug|cipondoh|pinang)\b/i,
    keywords: ['Karawaci', 'Kelapa Dua', 'Ciledug', 'Cipondoh', 'Tangerang'],
  },
];

const AREA_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(tambun(?:\s+(?:selatan|utara))?)\b/i, label: 'Tambun' },
  { pattern: /\b(cikarang(?:\s+(?:pusat|barat|utara|selatan|timur))?)\b/i, label: 'Cikarang' },
  { pattern: /\b(cibitung)\b/i, label: 'Cibitung' },
  { pattern: /\b(bekasi(?:\s+(?:timur|barat|utara|selatan))?)\b/i, label: 'Bekasi' },
  { pattern: /\b(depok(?:\s+(?:timur|utara|selatan))?|beji|kukusan|margonda|sukmajaya|cinere|sawangan|limo|cimanggis)\b/i, label: 'Depok' },
  { pattern: /\b(bogor|babakan\s*madang|sentul|dramaga|cibinong|bojonggede|cileungsi)\b/i, label: 'Bogor' },
  { pattern: /\b(tangerang(?:\s+selatan)?|tangsel|bintaro|serpong|bsd|ciputat|pamulang|alam\s*sutera|karawaci|ciledug)\b/i, label: 'Tangerang' },
  { pattern: /\b(jakarta\s+selatan|jaksel|tebet|kuningan|kemang|mampang|senayan|blok\s*m|cilandak|pasar\s*minggu|simatupang|fatmawati|lebak\s*bulus|jagakarsa|pancoran|kalibata|setiabudi|kebayoran|pondok\s*indah|gatot\s*subroto|rasuna\s*said)\b/i, label: 'Jakarta Selatan' },
  { pattern: /\b(jakarta\s+barat|jakbar|kemanggisan|grogol|palmerah|tomang|kebon\s*jeruk|kembangan|puri\s*indah|tanjung\s*duren|slipi|cengkareng|kalideres)\b/i, label: 'Jakarta Barat' },
  { pattern: /\b(jakarta\s+pusat|jakpus|sudirman|thamrin|menteng|salemba|tanah\s*abang|benhil|bendungan\s*hilir|cikini|senen|kemayoran|cempaka\s*putih|gambir)\b/i, label: 'Jakarta Pusat' },
  { pattern: /\b(jakarta\s+timur|jaktim|rawamangun|matraman|pulo\s*gadung|jatinegara|cawang|kramat\s*jati|duren\s*sawit|cakung|ciracas|pasar\s*rebo|cipayung|cibubur)\b/i, label: 'Jakarta Timur' },
  { pattern: /\b(jakarta\s+utara|jakut|kelapa\s*gading|pluit|sunter|pik|pantai\s*indah\s*kapuk|muara\s*karang|tanjung\s*priok|pademangan|penjaringan|ancol)\b/i, label: 'Jakarta Utara' },
];

export function extractAreaKeywords(text: string): string[] {
  const foundAreas: string[] = [];
  const addUnique = (kw: string) => {
    const clean = kw.trim();
    if (clean && !foundAreas.some((existing) => existing.toLowerCase() === clean.toLowerCase())) {
      foundAreas.push(clean);
    }
  };

  // 1. Resolve via Greater Jakarta Gazetteer first so specific corridor/hub name & surrounding sub-areas lead
  const resolved = resolveLocationQuery(text);
  if (resolved && !resolved.hub.id.startsWith('wilayah-jakarta-')) {
    const primaryLabel = resolved.hub.name.split('/')[0]!.split('&')[0]!.split(',')[0]!.trim();
    addUnique(primaryLabel);
    for (const kw of resolved.areaKeywords) {
      addUnique(kw);
    }
  }

  // 2. Match sub-area and city patterns
  for (const { pattern, keywords } of SUB_AREA_PATTERNS) {
    if (pattern.test(text)) {
      for (const kw of keywords) {
        addUnique(kw);
      }
    }
  }
  for (const { pattern, label } of AREA_PATTERNS) {
    if (pattern.test(text)) {
      addUnique(label);
    }
  }
  return foundAreas;
}

export function isExplicitUnsupportedDestination(text: string): boolean {
  return (
    NON_CATALOG_DESTINATIONS.some(({ pattern }) => pattern.test(text)) ||
    UNSUPPORTED_POI_PATTERNS.some(({ pattern }) => pattern.test(text))
  );
}

const WHATSAPP_TRIGGER_PATTERN =
  /\b(wa\b|whatsapp|hubungi(?:\s+pemilik)?|chat\s+(?:wa|whatsapp|pemilik|langsung|aplikasi|owner)|kirim\s+(?:wa|pesan(?:\s+wa|\s+ke\s+pemilik)?)|tanya\s+pemilik|nomor\s+(?:wa|whatsapp|telepon|hp)|draf(?:t)?\s+(?:wa|whatsapp|chat|pesan)|jadwal(?:kan)?\s+survei|mau\s+survei|nego(?:siasi)?\s+harga)\b/i;

const BOOKMARK_TRIGGER_PATTERN =
  /\b(bookmark|simpan(?:\s+kos|\s+ke|\s+nomor|\s+no\.?|\s+pilihan|\s+daftar|\s+ini|\s+semua)?|masukkan\s+ke\s+(?:favorit|bookmark|tersimpan|daftar)|tambah(?:kan)?\s+ke\s+(?:bookmark|favorit|tersimpan|daftar)|tandai\s+kos)\b/i;

const COMPARE_TRIGGER_PATTERN =
  /\b(bandingkan|bandingin|komparasi|compare|perbandingan|bedakan|bedain|lebih\s+bagus\s+mana|beda(?:nya)?\s+kos|pilih\s+mana\s+antara)\b/i;

const SEARCH_REDIRECT_TRIGGER_PATTERN =
  /\b(terapkan\s+filter|buka\s+(?:halaman\s+)?pencarian|arahkan\s+ke\s+(?:halaman\s+)?cari|lihat\s+(?:semua\s+)?di\s+(?:halaman\s+)?pencarian|halaman\s+cari|filter\s+pencarian)\b/i;

function parseNumber(raw: string): number {
  return Number(raw.replace(',', '.'));
}

function buildProactiveFollowUp(params: ChatParams): string {
  if (!params.tipe && (!params.fasilitas || params.fasilitas.length === 0)) {
    return 'Ngomong-ngomong Kak, lagi cari kos khusus putra, putri, atau campur nih? Kalau ada fasilitas wajib seperti AC atau Kamar Mandi Dalam, atau mau aku bantu bandingkan kos & buatkan draf chat ke pemiliknya, bilang aja ya!';
  }
  if (!params.tipe) {
    return 'Ngomong-ngomong Kak, untuk kosnya lebih pilih khusus putra, putri, atau campur? Kalau ada yang cocok, aku juga bisa bantu bandingkan kosnya atau buatkan draf chat ke pemilik kos lho!';
  }
  if (!params.maxBudgetMonthly && !params.minBudgetMonthly) {
    return 'Kira-kira budget sewa per bulannya mau di kisaran berapa nih, Kak? Biar aku bantu saring yang paling pas, atau kalau mau langsung bandingkan kos di bawah juga boleh banget!';
  }
  return 'Ada kos di bawah yang menarik perhatian Kakak? Bilang aja ya kalau mau aku bantu bandingkan kosnya, simpan ke favorit, atau buatkan draf chat ke pemilik kos!';
}

export function detectWhatsAppIntent(message: string): WhatsAppIntent {
  const lower = message.toLowerCase();
  if (/\b(survei|survey|lihat\s+kamar|kunjungan|cek\s+lokasi|datang\s+langsung)\b/.test(lower)) {
    return 'jadwal_survei';
  }
  if (/\b(nego|negosiasi|diskon|kurangin\s+harga|potongan|tawar)\b/.test(lower)) {
    return 'negosiasi_harga';
  }
  if (/\b(tanya\s+fasilitas|detail\s+fasilitas|aturan\s+kos|jam\s+malam)\b/.test(lower)) {
    return 'tanya_fasilitas';
  }
  return 'tanya_ketersediaan';
}

export function extractMentionedKosIds(message: string, allKos: Kos[]): string[] {
  const lower = message.toLowerCase();
  const matched: Kos[] = [];

  // 1. Try explicit comparison pair regex first: 'bandingkan [antara] [kos] X dengan/dan/sama [kos] Y'
  const pairMatch =
    /(?:bandingkan|bandingin|komparasi|bedakan|bedain|compare)\s+(?:antara\s+)?(?:kost?\s+)?(.+?)\s+(?:dengan|dan|sama|vs)\s+(?:kost?\s+)?(.+?)(?:\s+(?:dong|lengkap|ya|nih|banget)|$|[?.!])/i.exec(
      lower,
    );
  if (pairMatch) {
    const rawT1 = pairMatch[1]!.replace(/^(?:kost?|rumah kontrakan)\s+/i, '').trim();
    const rawT2 = pairMatch[2]!.replace(/^(?:kost?|rumah kontrakan)\s+/i, '').trim();
    for (const raw of [rawT1, rawT2]) {
      if (!raw || raw.length < 2) continue;
      // Exact substring match
      const direct = allKos.find((k) => k.namaKos.toLowerCase().includes(raw));
      if (direct && !matched.some((m) => m.id === direct.id)) {
        matched.push(direct);
        continue;
      }
      // Token-based match (e.g. "bu budi", "abun tipe a")
      const toks = raw.split(/\s+/).filter((t) => t.length > 1 && !/^(dan|sama|dengan|tipe|yang|kos|kost)$/i.test(t));
      if (toks.length > 0) {
        const tokMatch = allKos.find((k) => toks.every((tok) => k.namaKos.toLowerCase().includes(tok)));
        if (tokMatch && !matched.some((m) => m.id === tokMatch.id)) {
          matched.push(tokMatch);
        }
      }
    }
    if (matched.length >= 2) return matched.map((m) => m.id);
  }

  // 2. Scan each kos by full name or extracted brand
  for (const kos of allKos) {
    const fullName = kos.namaKos.toLowerCase();
    const brand = fullName
      .replace(/^(?:kost?|rumah kontrakan)\s+/i, '')
      .replace(/^(?:putra|putri|campur)\s+/i, '')
      .split(/\s+tipe\b|\s+lt\d|\s+lt\.\d/i)[0]!
      .trim();

    if (lower.includes(fullName)) {
      if (!matched.some((m) => m.id === kos.id)) {
        matched.push(kos);
      }
    } else if (brand.length >= 3 && !/^(kost?|rumah|tipe|\d+)$/i.test(brand)) {
      if (lower.includes(brand)) {
        if (!matched.some((m) => m.id === kos.id)) {
          matched.push(kos);
        }
      }
    }
  }

  return matched.map((m) => m.id);
}

export function extractMentionedIndices(message: string): number[] {
  const indices: number[] = [];
  const blockRegex =
    /\b(?:nomor|no\.?|urutan|pilihan|kos)\s*[-#]?\s*(\d{1,2}(?:\s*(?:,|dan|&|serta|atau)\s*(?:nomor\s*|no\.?\s*|kos\s*)?\d{1,2})*)/gi;

  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = blockRegex.exec(message)) !== null) {
    const segment = blockMatch[1] ?? '';
    const numMatches = segment.match(/\d{1,2}/g) ?? [];
    for (const rawNum of numMatches) {
      const n = Number(rawNum);
      if (n >= 1 && n <= 20 && !indices.includes(n)) {
        indices.push(n);
      }
    }
  }
  return indices;
}

export function hasExplicitAgentToolIntent(message: string): boolean {
  return (
    WHATSAPP_TRIGGER_PATTERN.test(message) ||
    BOOKMARK_TRIGGER_PATTERN.test(message) ||
    COMPARE_TRIGGER_PATTERN.test(message) ||
    SEARCH_REDIRECT_TRIGGER_PATTERN.test(message)
  );
}

/** Rule-based (regex) parser, tool detector & RAG fallback composer. Deterministic, no network access. */
export class MockLlmProvider implements LlmProvider {
  getLastAiMode(): 'gemini' | 'mock' {
    return 'mock';
  }

  async extractParams(message: string, destinations: Destination[]): Promise<ChatParams> {
    const text = message.toLowerCase();
    const params: ChatParams = {};

    // 1. Commute time ("30 menit"). Blank it out so the number is not read as money.
    let work = text;
    const timeMatch = /(\d+)\s*(menit|mnt|min)\b/.exec(work);
    if (timeMatch?.[1]) {
      params.maxCommuteMin = Number(timeMatch[1]);
      work = work.replace(timeMatch[0], ' '.repeat(timeMatch[0].length));
    }

    // 2a. Budget range ("1-2 juta", "1 - 2 jt", "1 sampai 2 juta", "800rb - 1,5 juta", "900 rb ampe 1,5 juta").
    const rangeRegex =
      /(\d+(?:[.,]\d+)?)\s*(juta|jt|ribu|rb|k)?\s*(?:-|–|sampai|sampe|ampe|s\/d|sd|hingga)\s*(\d+(?:[.,]\d+)?)\s*(juta|jt|ribu|rb|k)\b/;
    const rangeMatch = rangeRegex.exec(work);
    if (rangeMatch) {
      const [whole, lowRaw, lowUnit, highRaw, highUnit] = rangeMatch;
      if (lowRaw && highRaw && highUnit) {
        const effectiveLowUnit = lowUnit ?? highUnit;
        const minVal = Math.round(parseNumber(lowRaw) * (UNIT_MULTIPLIER[effectiveLowUnit] ?? 1));
        const maxVal = Math.round(parseNumber(highRaw) * (UNIT_MULTIPLIER[highUnit] ?? 1));
        if (minVal > 0 && maxVal >= minVal) {
          params.minBudgetMonthly = minVal;
          params.maxBudgetMonthly = maxVal;
          work = work.replace(whole, ' '.repeat(whole.length));
        }
      }
    }

    // 2b. Explicit minimum budget ("minimal 1 juta", "di atas 1,2 jt", "mulai 1 juta").
    const minRegex = /(?:minimal|min|di atas|lebih dari|mulai dari|mulai)\s*(\d+(?:[.,]\d+)?)\s*(juta|jt|ribu|rb|k)\b/;
    const minMatch = minRegex.exec(work);
    if (minMatch) {
      const [whole, num, unit] = minMatch;
      if (num && unit) {
        const val = Math.round(parseNumber(num) * (UNIT_MULTIPLIER[unit] ?? 1));
        if (val >= 100_000) {
          params.minBudgetMonthly ??= val;
          work = work.replace(whole, ' '.repeat(whole.length));
        }
      }
    }

    // 2c. Money with units ("2 juta", "15rb", "10k").
    const unitRegex = /(\d+(?:[.,]\d+)?)\s*(juta|jt|ribu|rb|k)\b/g;
    let match: RegExpExecArray | null;
    let rent: number | undefined = params.maxBudgetMonthly;
    let cost: number | undefined;
    while ((match = unitRegex.exec(work)) !== null) {
      const [whole, num, unit] = match;
      if (!num || !unit) continue;
      const value = Math.round(parseNumber(num) * (UNIT_MULTIPLIER[unit] ?? 1));
      const isMillionUnit = unit === 'juta' || unit === 'jt';
      const context = work.slice(Math.max(0, match.index - 20), match.index + whole.length + 15);
      if (isMillionUnit || value >= RENT_THRESHOLD) {
        rent ??= value;
      } else if (COST_KEYWORDS.test(context)) {
        cost ??= value;
      } else {
        // Small amount without transport keywords: treat as monthly rent budget.
        rent ??= value;
      }
      work = work.replace(whole, ' '.repeat(whole.length));
      unitRegex.lastIndex = 0;
    }

    // 3. Plain large numbers ("3000000", "1.500.000").
    const plain = /\b(\d{1,3}(?:\.\d{3})+|\d{6,})\b/.exec(work);
    if (plain?.[1]) {
      const value = Number(plain[1].replace(/\./g, ''));
      if (value >= RENT_THRESHOLD) rent ??= value;
    }

    if (rent !== undefined && rent > 0) params.maxBudgetMonthly = rent;
    if (cost !== undefined && cost > 0) params.maxCommuteCostRp = cost;

    // 4. Destination: longest matching alias wins.
    let bestLen = 0;
    for (const dest of destinations) {
      for (const alias of dest.aliases) {
        const a = alias.toLowerCase();
        const re = new RegExp(`(?<![a-z0-9])${escapeRegex(a)}(?![a-z0-9])`);
        if (re.test(text) && a.length > bestLen) {
          bestLen = a.length;
          params.destinationId = dest.id;
        }
      }
    }

    // 5. Transport mode.
    if (/\bojek\b/.test(text)) params.preferredMode = 'ojek';
    else if (/\b(krl|kereta|transit|bus|transjakarta)\b/.test(text)) params.preferredMode = 'transit';
    else if (/jalan kaki/.test(text)) params.preferredMode = 'jalan_kaki';

    // 6. Kos type.
    if (/\b(putra|cowok|laki|laki-laki|pria)\b/.test(text)) params.tipe = 'putra';
    else if (/\b(putri|cewek|perempuan|wanita)\b/.test(text)) params.tipe = 'putri';
    else if (/\bcampur\b/.test(text)) params.tipe = 'campur';

    // 7. Out-of-Scope (OOS) requests isolated first & consumed from text
    const foundOos: string[] = [];
    for (const { pattern, label } of OUT_OF_SCOPE_EXTRACTORS) {
      const match = pattern.exec(work);
      if (match) {
        foundOos.push(label);
        work = work.replace(pattern, ' '.repeat(match[0].length));
      }
    }

    // 8. Non-Catalog Campus & POI extraction (when destinationId is null)
    if (!params.destinationId) {
      for (const { pattern, label } of NON_CATALOG_DESTINATIONS) {
        if (pattern.test(work)) {
          foundOos.push(label);
        }
      }
      for (const { pattern, label } of UNSUPPORTED_POI_PATTERNS) {
        if (pattern.test(work)) {
          foundOos.push(label);
        }
      }
      const foundAreas = extractAreaKeywords(work);
      if (foundAreas.length > 0) {
        params.areaKeywords = foundAreas;
      }
    }

    // 9. Required facilities ("kamar mandi dalam", "AC", "WiFi", etc.) from remaining work text
    const foundFacilities: string[] = [];
    for (const { pattern, label } of FACILITY_EXTRACTORS) {
      if (pattern.test(work)) {
        foundFacilities.push(label);
      }
    }
    if (foundFacilities.length > 0) {
      params.fasilitas = foundFacilities;
    }

    // 10. Electricity included ("termasuk listrik", "free listrik", "include listrik")
    if (/\b(termasuk\s+listrik|free\s+listrik|gratis\s+listrik|include\s+listrik|sudah\s+(?:sama\s+)?listrik|udah\s+(?:sama\s+)?listrik)\b/i.test(text)) {
      params.listrikTermasuk = true;
    }

    if (foundOos.length > 0) {
      params.unsupportedRequests = foundOos;
    }

    return ChatParamsSchema.parse(params);
  }

  async detectToolCalls(message: string, context: ToolDetectionContext): Promise<ProposedToolCall[]> {
    const tools: ProposedToolCall[] = [];
    const mentionedIds = extractMentionedKosIds(message, context.allKos);
    const mentionedIndices = extractMentionedIndices(message);
    const candidateKos = context.results.length > 0 ? context.results.map((r) => r.kos) : context.allKos;

    const resolveTargetIds = (defaultCount: number, allowAllKosFallback = true): string[] => {
      if (mentionedIds.length > 0) {
        return mentionedIds;
      }
      if (mentionedIndices.length > 0) {
        const byIdx = mentionedIndices
          .map((idx) => candidateKos[idx - 1]?.id)
          .filter((id): id is string => typeof id === 'string');
        if (byIdx.length > 0) return byIdx;
      }
      if (context.results.length > 0) {
        return context.results.slice(0, defaultCount).map((r) => r.kos.id);
      }
      return allowAllKosFallback ? candidateKos.slice(0, defaultCount).map((k) => k.id) : [];
    };

    // 1. WhatsApp Draft Tool
    if (WHATSAPP_TRIGGER_PATTERN.test(message)) {
      const targetIds = resolveTargetIds(1);
      if (targetIds.length > 0) {
        tools.push({
          tool: 'whatsapp_draft',
          kosIds: [targetIds[0]!],
          intent: detectWhatsAppIntent(message),
        });
      }
    }

    // 2. Multi-Bookmark Tool
    if (BOOKMARK_TRIGGER_PATTERN.test(message)) {
      const targetIds = resolveTargetIds(1);
      if (targetIds.length > 0) {
        tools.push({
          tool: 'bookmark_kos',
          kosIds: targetIds.slice(0, 5),
          kosIndices: mentionedIndices.length > 0 ? mentionedIndices : undefined,
        });
      }
    }

    // 3. Compare Kos Tool
    if (COMPARE_TRIGGER_PATTERN.test(message)) {
      let targetIds = resolveTargetIds(2, false);
      if (targetIds.length === 1 && context.results.length >= 2) {
        const second = context.results.map((r) => r.kos).find((k) => k.id !== targetIds[0]);
        if (second) targetIds = [targetIds[0]!, second.id];
      }
      if (targetIds.length >= 2) {
        tools.push({
          tool: 'compare_kos',
          kosIds: targetIds.slice(0, 3),
          destinationId: context.params.destinationId,
        });
      }
    }

    // 4. Search Filter & Navigation Tool
    const hasSearchCriteria = Boolean(
      context.params.destinationId ||
        context.params.maxBudgetMonthly ||
        context.params.minBudgetMonthly ||
        context.params.tipe ||
        (context.params.fasilitas && context.params.fasilitas.length > 0) ||
        (context.params.areaKeywords && context.params.areaKeywords.length > 0),
    );
    if (
      SEARCH_REDIRECT_TRIGGER_PATTERN.test(message) ||
      (hasSearchCriteria && context.results.length > 0 && tools.length < MAX_TOOLS_PER_TURN)
    ) {
      tools.push({
        tool: 'search_redirect',
        destinationId: context.params.destinationId,
      });
    }

    return tools.slice(0, MAX_TOOLS_PER_TURN);
  }

  async composeReply(params: ChatParams, resultCount: number, context?: RagContext): Promise<string> {
    if (
      !params.destinationId &&
      !params.maxBudgetMonthly &&
      !params.minBudgetMonthly &&
      (!params.fasilitas || params.fasilitas.length === 0) &&
      (!params.areaKeywords || params.areaKeywords.length === 0) &&
      (!params.unsupportedRequests || params.unsupportedRequests.length === 0)
    ) {
      return 'Halo Kak! Aku KosMatch AI yang siap bantu carikan kos paling pas buat kamu. Mau ke kampus atau kantor mana, dan berapa budget sewa per bulan yang Kakak incar? Boleh sebutkan juga ya kalau cari kos putra/putri atau fasilitas tertentu seperti AC dan Kamar Mandi Dalam!';
    }
    const criteria: string[] = [];
    if (context?.destination) {
      criteria.push(`dekat ${context.destination.nama}`);
    } else if (params.areaKeywords && params.areaKeywords.length > 0) {
      const shownAreas = params.areaKeywords.slice(0, 4).join(', ');
      const extraNote = params.areaKeywords.length > 4 ? ' & sekitarnya' : '';
      criteria.push(`di area ${shownAreas}${extraNote}`);
    }
    if (params.minBudgetMonthly && params.maxBudgetMonthly) {
      criteria.push(`budget ${formatRp(params.minBudgetMonthly)}–${formatRp(params.maxBudgetMonthly)}/bulan`);
    } else if (params.maxBudgetMonthly) {
      criteria.push(`budget maksimal ${formatRp(params.maxBudgetMonthly)}/bulan`);
    } else if (params.minBudgetMonthly) {
      criteria.push(`budget minimal ${formatRp(params.minBudgetMonthly)}/bulan`);
    }
    if (params.maxCommuteMin) criteria.push(`waktu tempuh maksimal ${params.maxCommuteMin} menit`);
    if (params.maxCommuteCostRp) {
      const mode = params.preferredMode === 'ojek' ? 'ojek' : 'biaya perjalanan';
      criteria.push(`${mode} di bawah ${formatRp(params.maxCommuteCostRp)}`);
    }
    if (params.tipe) criteria.push(`kos ${params.tipe}`);
    if (params.fasilitas && params.fasilitas.length > 0) {
      criteria.push(`fasilitas ${params.fasilitas.join(', ')}`);
    }
    const suffix = criteria.length ? ` (${criteria.join(', ')})` : '';

    // Handle Fallback & Trade-off reply
    if (context?.isFallback) {
      let explanation = `Maaf, belum ada kos yang persis memenuhi seluruh kriteria kamu${suffix}`;
      if (context.fallbackReason === 'budget_terlalu_rendah' && params.maxBudgetMonthly) {
        explanation = `Saat ini belum ada kos dengan budget maksimal ${formatRp(params.maxBudgetMonthly)}/bulan`;
      } else if (context.fallbackReason === 'waktu_tempuh_terlalu_singkat') {
        explanation = 'Saat ini belum ada kos dengan waktu tempuh sesingkat itu ke lokasi tujuan';
      } else if (context.fallbackReason === 'area_belum_tersedia' && params.areaKeywords && params.areaKeywords.length > 0) {
        explanation = `Saat ini belum ada kos yang terdaftar di area ${params.areaKeywords.join(', ')}`;
      } else if (context.fallbackReason === 'fasilitas_terlalu_ketat') {
        explanation = 'Saat ini belum ada kos yang memiliki seluruh kombinasi fasilitas yang diminta';
      }

      let oosNote = '';
      if (context.unsupportedRequests && context.unsupportedRequests.length > 0) {
        oosNote = ` (catatan: fasilitas "${context.unsupportedRequests.join(', ')}" tidak tersedia di database kos kami)`;
      }

      const alternatives =
        context.results && context.results.length > 0
          ? ` Namun, sebagai alternatif terdekat, berikut beberapa opsi yang tersedia: ${context.results
              .slice(0, 2)
              .map((r) => `${r.kos.namaKos} (${formatRp(r.kos.hargaSewa)}/bln)`)
              .join(' dan ')}. Klik "Lihat Estimasi Transportasi" pada kartu kos untuk mengecek rute.`
          : '';

      return `${explanation}${oosNote}.${alternatives}`;
    }

    let oosPrefix = '';
    if (context?.unsupportedRequests && context.unsupportedRequests.length > 0) {
      const poiReqs = context.unsupportedRequests.filter(
        (u) =>
          u.startsWith('Titik ') ||
          u.startsWith('Kampus ') ||
          u.startsWith('Kampus/Titik ') ||
          u.startsWith('Universitas ') ||
          u.includes('Institute'),
      );
      const otherReqs = context.unsupportedRequests.filter((u) => !poiReqs.includes(u));
      const parts: string[] = [];
      if (poiReqs.length > 0) {
        parts.push(`${poiReqs.map((p) => p.replace('Titik ', '')).join(', ')} belum terdaftar dalam 11 destinasi transit utama kami`);
      }
      if (otherReqs.length > 0) {
        parts.push(`fasilitas "${otherReqs.join(', ')}" tidak tersedia di kos standar kami`);
      }
      oosPrefix = `Mohon dicatat bahwa ${parts.join(' dan ')}. `;
    }

    if (resultCount === 0) {
      if (context?.unsupportedRequests && context.unsupportedRequests.length > 0) {
        return `${oosPrefix}Silakan pilih salah satu dari 11 destinasi transit yang kami dukung (seperti UI, Binus, Trisakti, UNJ, SCBD, Stasiun Sudirman, dll.) atau sebutkan area Jabodetabek yang Anda inginkan.`;
      }
      return `${oosPrefix}Maaf, belum ada kos yang cocok dengan permintaanmu${suffix}. Coba naikkan budget, perpanjang waktu tempuh, atau pilih lokasi tujuan lain.`;
    }

    // If retrieved context is available, include top recommendations directly in the reply without transport numbers
    const followUp = buildProactiveFollowUp(params);
    if (context?.results && context.results.length > 0) {
      const highlights = context.results
        .slice(0, 2)
        .map((r) => `${r.kos.namaKos} (${formatRp(r.kos.hargaSewa)}/bln)`)
        .join(' dan ');
      return `${oosPrefix}Halo Kak! Aku menemukan ${resultCount} kos yang cocok${suffix}, di antaranya ${highlights}. Kakak bisa klik tombol "Lihat Estimasi Transportasi" di kartu kos untuk cek Estimasi waktu dan ongkos perjalanannya ya.\n\n${followUp}`;
    }

    return `${oosPrefix}Halo Kak! Aku menemukan ${resultCount} kos yang cocok${suffix}. Estimasi waktu dan biaya perjalanan bersifat perkiraan ya.\n\n${followUp}`;
  }
}
