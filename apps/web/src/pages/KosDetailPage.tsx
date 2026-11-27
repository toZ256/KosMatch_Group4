import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ExternalLink, Footprints, MapPin, MessageCircle, Navigation, Star, Train, Bike } from 'lucide-react';
import { resolveLocationQuery, type CommuteEstimate, type TransportMode } from '@kosmatch/shared';
import { useDestinations, useKos } from '../api/hooks';
import { BookmarkButton } from '../components/kos/BookmarkButton';
import { DestinationPicker, type SelectedDestination } from '../components/kos/DestinationPicker';
import { Button } from '../components/ui/Button';
import { Badge, Card, Skeleton } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { MODE_LABELS, formatRating, formatRupiah, photoGradient } from '../lib/format';
import { useAuthStore } from '../stores/authStore';

const MODE_ICON: Record<TransportMode, React.ReactNode> = {
  ojek: <Bike size={18} />,
  transit: <Train size={18} />,
  jalan_kaki: <Footprints size={18} />,
};

function CommuteRow({ e }: { e: CommuteEstimate }) {
  return (
    <li className="flex items-center gap-3.5 rounded-[22px] border border-line/60 bg-bg/60 p-3.5 transition hover:border-accent/40 hover:bg-bg" data-testid={`commute-${e.mode}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent shadow-inner">{MODE_ICON[e.mode]}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink">{MODE_LABELS[e.mode]}</p>
        <p className="text-[11px] text-muted">
          Estimasi · {e.distanceKm} km
          {e.mode === 'transit' && ` · ${e.transitTransfers} transfer`}
        </p>
      </div>
      <div className="rounded-2xl bg-surface px-3 py-1.5 text-right shadow-sm">
        <p className="text-sm font-extrabold text-ink">{e.durationMin} mnt</p>
        <p className="text-[11px] font-medium text-primary">{e.costRp === 0 ? 'Gratis' : formatRupiah(e.costRp)}</p>
      </div>
    </li>
  );
}

export function KosDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const destinationId = params.get('destinationId') ?? '';
  const rawLat = params.get('destLat');
  const rawLng = params.get('destLng');
  const destLat = rawLat !== null && rawLat !== '' && Number.isFinite(Number(rawLat)) ? Number(rawLat) : undefined;
  const destLng = rawLng !== null && rawLng !== '' && Number.isFinite(Number(rawLng)) ? Number(rawLng) : undefined;
  const destNameParam = params.get('destName') ?? '';
  const { data: kos, isLoading, isError } = useKos(id, {
    destinationId: destinationId || undefined,
    destLat,
    destLng,
    destName: destNameParam || undefined,
  });
  const { data: destinations = [] } = useDestinations();
  const user = useAuthStore((s) => s.user);

  if (isLoading) {
    return (
      <div className="page-container space-y-4 py-8">
        <Skeleton className="aspect-[16/7] w-full" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (isError || !kos) {
    return (
      <div className="page-container py-12">
        <EmptyState
          title="Kos tidak ditemukan"
          description="Kos yang kamu cari mungkin sudah dihapus."
          action={<Button onClick={() => navigate('/cari')}>Cari Kos Lain</Button>}
        />
      </div>
    );
  }

  const isOwnKos = user?.id === kos.ownerId;
  const defaultDraft = `Halo Bapak/Ibu Pemilik ${kos.namaKos}, saya menemukan kos Anda melalui KosMatch Jakarta. Saya tertarik dan ingin menanyakan apakah kamar tipe ${kos.tipe} masih tersedia untuk periode sewa bulan depan? Terima kasih.`;
  const ownerWaNumber = (() => {
    let hash = 0;
    for (let i = 0; i < kos.id.length; i++) {
      hash = (hash * 31 + kos.id.charCodeAt(i)) % 9000;
    }
    const suffix = String(1000 + Math.abs(hash)).padStart(4, '0');
    return `628120000${suffix}`;
  })();
  const waOwnerUrl = `https://wa.me/${ownerWaNumber}?text=${encodeURIComponent(defaultDraft)}`;
  const inAppChatUrl = `/chat/${kos.ownerId}?draft=${encodeURIComponent(defaultDraft)}`;
  const chatOwner = () => {
    if (!user) navigate(`/login?redirect=${encodeURIComponent(inAppChatUrl)}`);
    else navigate(inAppChatUrl);
  };
  const hasWalking = kos.commute?.some((c) => c.mode === 'jalan_kaki');
  const selectedDest =
    destinations.find((d) => d.id === destinationId) ??
    (destinationId ? resolveLocationQuery(destinationId)?.virtualDestination : undefined) ??
    (destLat !== undefined && destLng !== undefined
      ? {
          id: `custom:${destLat},${destLng}`,
          nama: destNameParam || 'Lokasi Tujuan',
          latitude: destLat,
          longitude: destLng,
        }
      : undefined);
  const pickerValue: SelectedDestination | null = selectedDest
    ? {
        label: selectedDest.nama,
        destinationId: destinationId || undefined,
        latitude: selectedDest.latitude,
        longitude: selectedDest.longitude,
      }
    : null;

  const handleSelectDest = (dest: SelectedDestination | null) => {
    const next = new URLSearchParams(params);
    next.delete('destinationId');
    next.delete('destLat');
    next.delete('destLng');
    next.delete('destName');
    if (dest) {
      if (dest.destinationId) {
        next.set('destinationId', dest.destinationId);
      } else if (dest.latitude !== undefined && dest.longitude !== undefined) {
        next.set('destLat', String(dest.latitude));
        next.set('destLng', String(dest.longitude));
        next.set('destName', dest.label);
      }
    }
    setParams(next, { replace: true });
  };
  const googleMapsUrl =
    kos.googleMapsUrl?.trim() ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${kos.latitude},${kos.longitude}`)}`;
  const googleMapsDirUrl = selectedDest
    ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${kos.latitude},${kos.longitude}`)}&destination=${encodeURIComponent(`${selectedDest.latitude},${selectedDest.longitude}`)}`
    : null;

  return (
    <div className="page-container pb-24 pt-5 sm:py-8">
      <div className="rounded-[24px] border border-line/70 bg-surface p-2 shadow-card sm:rounded-[32px] sm:p-2.5">
        <div
          className="relative aspect-[16/9] w-full overflow-hidden rounded-[18px] sm:aspect-[16/7] sm:rounded-[24px]"
          style={{ background: photoGradient(kos.fotoColor) }}
          role="img"
          aria-label={`Foto ilustrasi ${kos.namaKos}`}
        >
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-1 text-xs font-extrabold text-ink shadow-sm backdrop-blur-sm sm:left-4 sm:top-4 sm:px-3.5 sm:py-1.5">
            <Star size={13} className="fill-primary text-primary" /> {formatRating(kos.rating)}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-5 sm:mt-6 sm:gap-6 lg:grid-cols-[1fr_390px]">
        <Card className="min-w-0 p-4 sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <h1 className="text-xl font-extrabold tracking-tight text-ink sm:text-3xl">{kos.namaKos}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-xs font-medium text-muted sm:gap-3 sm:text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={15} className="shrink-0 text-accent" /> {kos.area}
                </span>
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-3 py-0.5 text-xs font-bold text-accent transition hover:bg-accent hover:text-surface"
                >
                  Buka di Google Maps <ExternalLink size={12} />
                </a>
              </div>
            </div>
            <div className="w-fit rounded-2xl bg-primary/10 px-4 py-2 text-left sm:text-right">
              <span className="text-xl font-extrabold text-primary sm:text-2xl">{formatRupiah(kos.hargaSewa)}</span>{' '}
              <span className="text-xs font-medium text-muted">/bulan</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5 sm:mt-5 sm:gap-2">
            <Badge tone="primary" className="capitalize">Kos {kos.tipe}</Badge>
            {kos.fasilitas.map((f) => (
              <Badge key={f} tone="accent">{f}</Badge>
            ))}
          </div>

          <div className="mt-5 rounded-[20px] bg-bg/60 p-4 sm:mt-6 sm:rounded-[22px] sm:p-5">
            <h2 className="mb-1.5 text-sm font-bold text-ink">Deskripsi Kos</h2>
            <p className="text-sm leading-relaxed text-muted">{kos.deskripsi}</p>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-2.5 sm:mt-6 sm:flex sm:flex-wrap sm:gap-3">
            <BookmarkButton kos={kos} variant="labeled" className="w-full sm:w-auto" />
            {!isOwnKos && (
              <>
                <Button size="lg" id="chat-owner" onClick={chatOwner} className="w-full sm:w-auto">
                  <MessageCircle size={17} /> Chat di Aplikasi
                </Button>
                <a href={waOwnerUrl} target="_blank" rel="noopener noreferrer" data-testid="detail-whatsapp-link" className="w-full sm:w-auto">
                  <Button size="lg" variant="accent" type="button" className="w-full sm:w-auto">
                    <MessageCircle size={17} /> Chat via WhatsApp <ExternalLink size={14} />
                  </Button>
                </a>
              </>
            )}
            <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" type="button" className="w-full sm:w-auto">
                <MapPin size={16} /> Lihat Lokasi Maps
              </Button>
            </a>
            {isOwnKos && (
              <Link to={`/owner/kos/${kos.id}/edit`} className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">Ubah Kos</Button>
              </Link>
            )}
          </div>
        </Card>

        <Card className="h-fit min-w-0 p-4 sm:p-6" aria-labelledby="commute-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="commute-heading" className="text-base font-semibold">Estimasi Perjalanan</h2>
            <Badge>Estimasi</Badge>
          </div>
          <DestinationPicker
            id="detail-destination-picker"
            label="Tujuan (Gedung, Mall, Kampus, atau Area)"
            placeholder="Cari tujuan bebas... (mis. Senayan City, GBK, UI)"
            value={pickerValue}
            onSelect={handleSelectDest}
          />
          {kos.commute ? (
            <>
              <ul className="mt-4 space-y-2">
                {kos.commute.map((c) => (
                  <CommuteRow key={c.mode} e={c} />
                ))}
              </ul>
              {!hasWalking && <p className="mt-2 text-[11px] text-muted">Jalan kaki tidak tersedia (jarak lebih dari 1,5 km).</p>}
              {googleMapsDirUrl && selectedDest && (
                <a
                  href={googleMapsDirUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-bold text-accent transition hover:bg-accent hover:text-surface"
                >
                  <Navigation size={13} /> Lihat Rute ke {selectedDest.nama} di Google Maps
                </a>
              )}
            </>
          ) : (
            <p className="mt-4 text-sm text-muted">Pilih tujuan untuk melihat estimasi waktu dan biaya perjalanan.</p>
          )}
          <p className="mt-4 text-[11px] text-muted">Estimasi dapat berubah. Mohon verifikasi sebelum memutuskan.</p>
        </Card>
      </div>
    </div>
  );
}
