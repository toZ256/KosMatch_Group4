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
  { pattern: /\bmeja\b/i, label: 'Meja' },
  { pattern: /\b(dapur|masak)\b/i, label: 'Dapur' },
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

    // 2a. Budget range ("1-2 juta", "1 - 2 jt", "1 sampai 2 juta", "800rb - 1,5 juta").
    const rangeRegex =
      /(\d+(?:[.,]\d+)?)\s*(juta|jt|ribu|rb|k)?\s*(?:-|–|sampai|s\/d|sd|hingga)\s*(\d+(?:[.,]\d+)?)\s*(juta|jt|ribu|rb|k)\b/;
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

    // 7. Required facilities ("kamar mandi dalam", "AC", "WiFi", etc.).
    const foundFacilities: string[] = [];
    for (const { pattern, label } of FACILITY_EXTRACTORS) {
      if (pattern.test(text)) {
        foundFacilities.push(label);
      }
    }
    if (foundFacilities.length > 0) {
      params.fasilitas = foundFacilities;
    }

    return ChatParamsSchema.parse(params);
  }

  async composeReply(params: ChatParams, resultCount: number, context?: RagContext): Promise<string> {
    if (!params.destinationId && !params.maxBudgetMonthly && !params.minBudgetMonthly) {
      return 'Mau ke kampus atau kantor mana, dan berapa budget sewa per bulan?';
    }
    const criteria: string[] = [];
    if (context?.destination) {
      criteria.push(`dekat ${context.destination.nama}`);
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

    if (resultCount === 0) {
      return `Maaf, belum ada kos yang cocok dengan permintaanmu${suffix}. Coba naikkan budget, perpanjang waktu tempuh, atau pilih lokasi tujuan lain.`;
    }

    // If retrieved context is available, include top recommendations directly in the reply without transport numbers
    if (context?.results && context.results.length > 0) {
      const highlights = context.results
        .slice(0, 2)
        .map((r) => `${r.kos.namaKos} (${formatRp(r.kos.hargaSewa)}/bln)`)
        .join(' dan ');
      return `Saya menemukan ${resultCount} kos yang cocok${suffix}, antara lain ${highlights}. Klik tombol "Lihat Estimasi Transportasi" pada kartu kos untuk mengecek Estimasi waktu dan biaya perjalanan.`;
    }

    return `Saya menemukan ${resultCount} kos yang cocok${suffix}. Estimasi ini bersifat perkiraan, mohon verifikasi sebelum memutuskan.`;
  }
}
