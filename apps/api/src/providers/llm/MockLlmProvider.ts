import { ChatParamsSchema, type ChatParams, type Destination } from '@kosmatch/shared';
import type { LlmProvider, RagContext } from './LlmProvider';

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

const AREA_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(tambun(?:\s+(?:selatan|utara))?)\b/i, label: 'Tambun' },
  { pattern: /\b(cikarang(?:\s+(?:pusat|barat|utara|selatan|timur))?)\b/i, label: 'Cikarang' },
  { pattern: /\b(cibitung)\b/i, label: 'Cibitung' },
  { pattern: /\b(bekasi(?:\s+(?:timur|barat|utara|selatan))?)\b/i, label: 'Bekasi' },
  { pattern: /\b(depok(?:\s+(?:timur|utara|selatan))?|beji|kukusan|margonda|sukmajaya|cinere|sawangan)\b/i, label: 'Depok' },
  { pattern: /\b(bogor)\b/i, label: 'Bogor' },
  { pattern: /\b(tangerang(?:\s+selatan)?|tangsel|bintaro|serpong|bsd|ciputat|pamulang)\b/i, label: 'Tangerang' },
  { pattern: /\b(jakarta\s+selatan|jaksel|tebet|kuningan|kemang|mampang|senayan|blok\s*m|cilandak|pasar\s*minggu)\b/i, label: 'Jakarta Selatan' },
  { pattern: /\b(jakarta\s+barat|jakbar|kemanggisan|grogol|palmerah|tomang|kebon\s*jeruk)\b/i, label: 'Jakarta Barat' },
  { pattern: /\b(jakarta\s+pusat|jakpus|sudirman|thamrin|menteng|salemba|tanah\s*abang)\b/i, label: 'Jakarta Pusat' },
  { pattern: /\b(jakarta\s+timur|jaktim|rawamangun|matraman|pulo\s*gadung)\b/i, label: 'Jakarta Timur' },
  { pattern: /\b(jakarta\s+utara|jakut|kelapa\s*gading|pluit|sunter)\b/i, label: 'Jakarta Utara' },
];

function parseNumber(raw: string): number {
  return Number(raw.replace(',', '.'));
}

/** Rule-based (regex) parser & RAG fallback composer. Deterministic, no network access. */
export class MockLlmProvider implements LlmProvider {
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
      const foundAreas: string[] = [];
      for (const { pattern, label } of AREA_PATTERNS) {
        if (pattern.test(work)) {
          if (!foundAreas.includes(label)) foundAreas.push(label);
        }
      }
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

    if (foundOos.length > 0) {
      params.unsupportedRequests = foundOos;
    }

    return ChatParamsSchema.parse(params);
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
      return 'Mau ke kampus atau kantor mana, dan berapa budget sewa per bulan?';
    }
    const criteria: string[] = [];
    if (context?.destination) {
      criteria.push(`dekat ${context.destination.nama}`);
    } else if (params.areaKeywords && params.areaKeywords.length > 0) {
      criteria.push(`di area ${params.areaKeywords.join(', ')}`);
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
      const poiReqs = context.unsupportedRequests.filter((u) => u.startsWith('Titik ') || u.startsWith('Kampus ') || u.startsWith('Universitas ') || u.includes('Institute'));
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
    if (context?.results && context.results.length > 0) {
      const highlights = context.results
        .slice(0, 2)
        .map((r) => `${r.kos.namaKos} (${formatRp(r.kos.hargaSewa)}/bln)`)
        .join(' dan ');
      return `${oosPrefix}Saya menemukan ${resultCount} kos yang cocok${suffix}, antara lain ${highlights}. Klik tombol "Lihat Estimasi Transportasi" pada kartu kos untuk mengecek Estimasi waktu dan biaya perjalanan.`;
    }

    return `${oosPrefix}Saya menemukan ${resultCount} kos yang cocok${suffix}. Estimasi ini bersifat perkiraan, mohon verifikasi sebelum memutuskan.`;
  }
}
