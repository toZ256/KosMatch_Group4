import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ExternalLink, Footprints, MapPin, MessageCircle, Navigation, Star, Train, Bike } from 'lucide-react';
import type { CommuteEstimate, TransportMode } from '@kosmatch/shared';
import { useDestinations, useKos } from '../api/hooks';
import { BookmarkButton } from '../components/kos/BookmarkButton';
import { Button } from '../components/ui/Button';
import { Badge, Card, Skeleton } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Select } from '../components/ui/Input';
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
  const { data: kos, isLoading, isError } = useKos(id, destinationId || undefined);
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
  const chatOwner = () => {
    if (!user) navigate(`/login?redirect=${encodeURIComponent(`/kos/${kos.id}`)}`);
    else navigate(`/chat/${kos.ownerId}`);
  };
  const hasWalking = kos.commute?.some((c) => c.mode === 'jalan_kaki');
  const selectedDest = destinations.find((d) => d.id === destinationId);
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${kos.latitude},${kos.longitude}`)}`;
  const googleMapsDirUrl = selectedDest
    ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${kos.latitude},${kos.longitude}`)}&destination=${encodeURIComponent(`${selectedDest.latitude},${selectedDest.longitude}`)}`
    : null;

  return (
    <div className="page-container py-8">
      <div className="rounded-[32px] border border-line/70 bg-surface p-2.5 shadow-card">
        <div
          className="relative aspect-[16/9] w-full overflow-hidden rounded-[24px] sm:aspect-[16/7]"
          style={{ background: photoGradient(kos.fotoColor) }}
          role="img"
          aria-label={`Foto ilustrasi ${kos.namaKos}`}
        >
          <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-surface/95 px-3.5 py-1.5 text-xs font-extrabold text-ink shadow-sm backdrop-blur-sm">
            <Star size={13} className="fill-primary text-primary" /> {formatRating(kos.rating)}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_390px]">
        <Card className="p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{kos.namaKos}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm font-medium text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={15} className="text-accent" /> {kos.area}
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
            <div className="rounded-2xl bg-primary/10 px-4 py-2 text-right">
              <span className="text-xl font-extrabold text-primary sm:text-2xl">{formatRupiah(kos.hargaSewa)}</span>{' '}
              <span className="text-xs font-medium text-muted">/bulan</span>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Badge tone="primary" className="capitalize">Kos {kos.tipe}</Badge>
            {kos.fasilitas.map((f) => (
              <Badge key={f} tone="accent">{f}</Badge>
            ))}
          </div>

          <div className="mt-6 rounded-[22px] bg-bg/60 p-4 sm:p-5">
            <h2 className="mb-1.5 text-sm font-bold text-ink">Deskripsi Kos</h2>
            <p className="text-sm leading-relaxed text-muted">{kos.deskripsi}</p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <BookmarkButton kos={kos} variant="labeled" />
            {!isOwnKos && (
              <Button size="lg" id="chat-owner" onClick={chatOwner}>
                <MessageCircle size={17} /> Chat Pemilik
              </Button>
            )}
            <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" type="button">
                <MapPin size={16} /> Lihat Lokasi Maps
              </Button>
            </a>
            {isOwnKos && (
              <Link to={`/owner/kos/${kos.id}/edit`}>
                <Button size="lg" variant="outline">Ubah Kos</Button>
              </Link>
            )}
          </div>
        </Card>

        <Card className="h-fit p-6" aria-labelledby="commute-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="commute-heading" className="text-base font-semibold">Estimasi Perjalanan</h2>
            <Badge>Estimasi</Badge>
          </div>
          <Select
            label="Tujuan"
            value={destinationId}
            onChange={(e) => {
              const next = new URLSearchParams(params);
              if (e.target.value) next.set('destinationId', e.target.value);
              else next.delete('destinationId');
              setParams(next, { replace: true });
            }}
          >
            <option value="">Pilih kampus / kantor / stasiun</option>
            {destinations.map((d) => (
              <option key={d.id} value={d.id}>{d.nama}</option>
            ))}
          </Select>
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
