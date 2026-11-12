import type { ChatbotResultItem, Kos } from './types';

/**
 * Standard polite responses in Bahasa Indonesia for Layer 1 & Layer 3 Guardrails.
 */
export const GUARDRAIL_INJECTION_REPLY =
  'Demi keamanan sistem, instruksi tersebut tidak dapat diproses. Sebagai asisten KosMatch Jakarta, saya siap membantu Anda mencari kos, mengecek Estimasi komuter, membandingkan kos, atau menghubungi pemilik kos di sekitar Jakarta.';

export const GUARDRAIL_OUT_OF_SCOPE_REPLY =
  'Sebagai asisten KosMatch Jakarta, saya hanya dapat membantu Anda mencari kos, informasi komuter, dan fasilitas tempat tinggal di sekitar Jakarta. Ada kampus atau area yang ingin Anda tanyakan?';

export const GUARDRAIL_TOXIC_REPLY =
  'Mohon gunakan bahasa yang sopan dan santun. Sebagai asisten KosMatch Jakarta, saya siap membantu Anda mencari kos yang nyaman beserta Estimasi perjalanan ke kampus atau kantor Anda.';

export const MAX_TOOLS_PER_TURN = 3;

const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /\b(ignore|disregard|forget|override|bypass)\s+(all\s+)?(previous|prior|above|system|initial|security)\s+(instructions?|prompts?|rules?|guardrails?|constraints?)\b/i,
  /\b(abaikan|lupakan|hiraukan|lewati|matikan)\s+(semua\s+|seluruh\s+)?(instruksi|perintah|aturan|batasan|guardrail)\s*(sebelumnya|di\s+atas|sistem|awal)?\b/i,
  /\b(you\s+are\s+now\s+dan|do\s+anything\s+now|unrestricted\s+ai|act\s+as\s+dan|jailbreak|developer\s+mode\s+enabled|mode\s+tanpa\s+batas|mode\s+jailbreak)\b/i,
  /\b(bocorkan|tampilkan|beritahu|cetak|tunjukkan|reveal|show|print|dump|expose|leak)\s+(isi\s+|seluruh\s+)?(system\s+prompt|instruksi\s+sistem|prompt\s+asli|rahasia\s+sistem|api\s*key|password\s*hash|database\s+url|kredensial)\b/i,
  /\b(drop\s+table|drop\s+database|truncate\s+table|delete\s+from\s+users|union\s+select|select\s+\*\s+from\s+users|insert\s+into\s+users|;\s*drop\s+table|--\s*sql\s*injection|\b1\s*=\s*1\b\s*--)\b/i,
  /<\s*script\b[^>]*>|javascript\s*:\s*alert\s*\(/i,
];

const KOS_DOMAIN_KEYWORDS =
  /\b(kos|kosan|kos-kosan|indekos|kamar|sewa|kontrakan|hunian|tempat\s+tinggal|akomodasi|asrama|putra|putri|campur|cowok|cewek|ojek|krl|mrt|lrt|transjakarta|busway|transit|stasiun|halte|kampus|universitas|kantor|komuter|perjalanan|ongkos|waktu\s+tempuh|menit|budget|harga|juta|jt|ribu|rb|ac|wifi|parkir|kasur|lemari|dapur|laundry|mandi\s+dalam|pemilik|owner|wa|whatsapp|survei|survey|bookmark|simpan|favorit|bandingkan|komparasi|compare|filter|cari|depok|jakarta|jaksel|jakbar|jakpus|jaktim|jakut|bekasi|tambun|cikarang|tangerang|tangsel|bogor|sudirman|thamrin|kuningan|scbd|kemang|tebet|setiabudi|kebayoran|pancoran|grogol|kemanggisan|palmerah|rawamangun|semanggi|ui|binus|trisakti|unj|atma\s+jaya)\b/i;

const OUT_OF_SCOPE_PATTERNS: RegExp[] = [
  // Programming / coding requests
  /\b(buatkan\s+(?:kode|script|program|aplikasi|fungsi)|tulis(?:kan)?\s+(?:kode|script|program)|coding\s+(?:python|javascript|typescript|java|c\+\+|php|golang|rust|html|css|sql)|fungsi\s+(?:python|javascript|rekursif)|algoritma\s+(?:sorting|binary\s+search|dijkstra|linked\s+list)|debug\s+kode|kode\s+python|script\s+python)\b/i,
  // Cooking / food recipes
  /\b(resep\s+(?:masakan|makanan|kue|ayam|nasi\s+goreng|soto|rendang|mie|minuman|sambal|seblak)|cara\s+(?:memasak|membuat\s+kue|bikin\s+nasi\s+goreng|membuat\s+rendang)|bumbu\s+(?:masakan|dapur|rendang|soto))\b/i,
  // Politics / elections / geopolitics
  /\b(partai\s+politik|kampanye\s+(?:politik|pemilu)|pilpres|pemilu|capres|cawapres|koalisi\s+partai|debat\s+capres|politik\s+indonesia|kebijakan\s+luar\s+negeri)\b/i,
  // Academic homework / math / science / essays / arithmetic calculations
  /\b(tugas\s+(?:kuliah|sekolah|matematika|fisika|kimia|biologi)|hitung(?:lah)?\s+(?:integral|turunan|matriks|determinan|persamaan\s+kuadrat|limit\s+fungsi|faktorial)|rumus\s+(?:fisika|kimia|matematika|relativitas|pythagoras|kuadrat)|kerjakan\s+soal\s+(?:matematika|fisika)|buatkan\s+(?:makalah|esai|skripsi|puisi|cerpen|pantun|lirik\s+lagu))\b/i,
  /(?:\b(?:kerjakan|hitung(?:lah|kan)?|berapa(?:\s+hasil(?:\s+dari)?)?|jawab(?:lah)?|selesaikan)\s+)?\b\d+\s*[+*^×÷]\s*\d+\b/i,
  /\b(?:kerjakan|hitung(?:lah|kan)?|berapa(?:\s+hasil(?:\s+dari)?)?|selesaikan)\s+\d+\s*[+\-*/^×÷]\s*\d+\b/i,
  // Word-based arithmetic (e.g. "satu tambah satu berapa?", "dua kali tiga", "sepuluh dibagi dua")
  /\b(?:satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|\d+)\s*(?:tambah|kurang|kali|bagi)\s*(?:satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|\d+)(?:\s*(?:berapa|hasilnya|sama\s*dengan|\?))?\b/i,
  /\b(?:berapa\s+hasil\s+(?:dari\s+)?|hitung(?:kan)?\s+)(?:satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|\d+)\b/i,
  // General knowledge / non-kos trivia questions without kos context
  /\b(siapa\s+(?:presiden|menteri|gubernur|pencipta|penemu)|ibukota\s+negara|cuaca\s+hari\s+ini|lirik\s+lagu|terjemahkan\s+ke\s+bahasa)\b/i,
  // Crypto / stocks / gambling / medical diagnosis / astrology
  /\b(trading\s+(?:crypto|forex|saham)|prediksi\s+(?:bitcoin|crypto|saham|ihsg)|judi\s+online|slot\s+gacor|diagnosa\s+penyakit|resep\s+obat\s+dokter|ramalan\s+(?:zodiak|bintang|tarot))\b/i,
];

const TOXIC_OR_SARA_PATTERNS: RegExp[] = [
  /\b(anjing\s+(?:lu|lo|kamu|kau)|bangsat\s+(?:lu|lo|kamu)|goblok\s+(?:lu|lo|kamu)|tolol\s+(?:lu|lo|kamu)|bajingan\s+tengik|tai\s+lu|kontol|memek|ngentot|jancok|asu\s+lu)\b/i,
  /\b(usir\s+(?:suku|etnis|agama)|benci\s+(?:suku|etnis|agama)|larang\s+umat\s+agama|rasis\s+terhadap)\b/i,
];

const OUTPUT_PROFANITY_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\b(anjing|bangsat|bajingan|kontol|memek|ngentot|jancok)\b/gi, replacement: '[***]' },
];

/**
 * Layer 1 Guardrail: Detects prompt injection, jailbreak, system prompt exfiltration, or SQL/XSS injection.
 */
export function detectPromptInjection(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return false;
  return PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Layer 1 Guardrail: Checks whether a user query is outside KosMatch's domain
 * (e.g. coding Python, cooking recipes, politics, math homework, gambling).
 */
export function isOutOfScope(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return false;

  // Check if the query explicitly asks for an out-of-scope topic
  const matchesOosTopic = OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(normalized));
  if (!matchesOosTopic) {
    return false;
  }

  // If the user is genuinely searching for a kos (e.g. "kos dekat UI untuk mahasiswa matematika"),
  // allow it unless they are explicitly asking to write code/recipes/homework without kos intent.
  if (KOS_DOMAIN_KEYWORDS.test(normalized)) {
    const explicitNonKosTask =
      /\b(buatkan\s+(?:kode|script|program|resep|puisi|makalah)|resep\s+masakan|coding\s+python|hitung(?:lah)?\s+integral|tugas\s+kuliah\s+matematika)\b/i.test(
        normalized,
      ) && !/\b(kos|kosan|kamar|sewa|hunian|kontrakan)\b/i.test(normalized);
    return explicitNonKosTask;
  }

  return true;
}

/**
 * Layer 1 Guardrail: Masks sensitive PII (NIK/KTP, passwords, PINs, bank accounts, credit cards)
 * before storing or forwarding user messages. Preserves normal rent budgets (e.g. 2000000).
 */
export function sanitizePII(text: string): string {
  if (!text) return text;
  let result = text;

  // 1. Explicit NIK / KTP label with 10-16 digits
  result = result.replace(
    /\b(nik|no\.?\s*ktp|nomor\s+ktp)\s*([:=-]?\s*)\d{10,16}\b/gi,
    '$1$2[NIK DISEMBUNYIKAN]',
  );

  // 2. Standalone 16-digit NIK / KTP number
  result = result.replace(/\b\d{16}\b/g, '[NIK DISEMBUNYIKAN]');

  // 3. Credit card format (4 groups of 4 digits separated by space or dash)
  result = result.replace(/\b(?:\d{4}[-\s]){3}\d{4}\b/g, '[KARTU KREDIT DISEMBUNYIKAN]');

  // 4. Bank account numbers preceded by rekening/bank keywords (8-16 digits)
  result = result.replace(
    /\b(no\.?\s*rek(?:ening)?|nomor\s+rekening|rekening(?:\s+(?:bca|mandiri|bni|bri|bsi|cimb|permata|danamon))?|norek)\s*([:=-]?\s*)\d{8,16}\b/gi,
    '$1$2[NOMOR REKENING DISEMBUNYIKAN]',
  );

  // 5. Passwords, PINs, or OTP codes
  result = result.replace(
    /\b(password|kata\s*sandi|sandi|pin(?:\s+atm)?|kode\s+otp)\s*(saya\s+(?:adalah\s+)?|adalah\s+|[:=]\s*)\S+/gi,
    '$1 $2[KATA SANDI DISEMBUNYIKAN]',
  );

  return result;
}

/**
 * Layer 1 & 3 Guardrail: Detects severe toxic language, harassment, or SARA discrimination.
 */
export function detectToxicOrSara(text: string): boolean {
  if (!text) return false;
  return TOXIC_OR_SARA_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Layer 3 Guardrail: Sanitizes any profanity and strips raw markdown symbols (** or ###) from LLM output text.
 */
export function sanitizeOutputText(text: string): string {
  if (!text) return text;
  // Remove raw markdown bold/italic asterisks and heading hashes first so chat bubbles stay clean
  let cleaned = text
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/(^|\s)\*([^*\n]+)\*(?=\s|[.,!?]|$)/g, '$1$2')
    .replace(/^#{1,6}\s+/gm, '');
  for (const { pattern, replacement } of OUTPUT_PROFANITY_REPLACEMENTS) {
    cleaned = cleaned.replace(pattern, replacement);
  }
  return cleaned;
}

/**
 * Layer 3 Guardrail: Ensures any reply mentioning commute times/costs or returning kos results
 * includes the mandatory "Estimasi" disclaimer label.
 */
export function enforceEstimateLabel(reply: string, hasCommuteOrResults = false): string {
  if (!reply) return reply;
  if (/estimasi/i.test(reply)) return reply;

  const mentionsCommute =
    /\b(\d+\s*(?:menit|mnt)|ojek|transit|krl|transjakarta|jalan\s+kaki|ongkos|biaya\s+perjalanan|rute\s+perjalanan)\b/i.test(
      reply,
    );

  if (hasCommuteOrResults || mentionsCommute) {
    return `${reply.trim()} (Estimasi waktu dan biaya perjalanan bersifat perkiraan, mohon verifikasi sebelum memutuskan.)`;
  }
  return reply;
}

/**
 * Layer 3 Guardrail: Verifies that all recommended Kos IDs exist in the database catalog,
 * prevents price/facility hallucination by grounding to canonical Kos entities,
 * and enforces `isEstimate: true` and `source: 'mock'` on all commute estimates.
 */
export function validateGroundedResults(
  results: ChatbotResultItem[],
  validKosMap: Map<string, Kos>,
): ChatbotResultItem[] {
  const grounded: ChatbotResultItem[] = [];
  for (const item of results) {
    const canonicalKos = validKosMap.get(item.kos.id);
    if (!canonicalKos) {
      // Drop any hallucinated Kos ID not present in the repository
      continue;
    }
    grounded.push({
      kos: canonicalKos,
      commute: item.commute.map((c) => ({
        ...c,
        isEstimate: true as const,
        source: 'mock' as const,
      })),
    });
  }
  return grounded;
}
