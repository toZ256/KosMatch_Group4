export const ROLES = ['tenant', 'owner'] as const;
export const TIPE_KOS = ['putra', 'putri', 'campur'] as const;
export const KATEGORI_DESTINASI = ['kampus', 'kantor', 'stasiun'] as const;
export const TRANSPORT_MODES = ['ojek', 'transit', 'jalan_kaki'] as const;
export const FASILITAS_OPTIONS = [
  'AC',
  'WiFi',
  'Kamar Mandi Dalam',
  'Dapur Bersama',
  'Parkir',
  'Laundry',
] as const;

export const MESSAGE_MAX_LENGTH = 1000;
export const CHATBOT_MAX_RESULTS = 5;

export const MODE_LABEL: Record<(typeof TRANSPORT_MODES)[number], string> = {
  ojek: 'Ojek',
  transit: 'Transit',
  jalan_kaki: 'Jalan Kaki',
};
