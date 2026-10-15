import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Footprints, MapPin, MessageCircle, Star, Train, Bike } from 'lucide-react';
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
    <li className="flex items-center gap-3 rounded-2xl border border-line p-3" data-testid={`commute-${e.mode}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">{MODE_ICON[e.mode]}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{MODE_LABELS[e.mode]}</p>
        <p className="text-[11px] text-muted">
          Estimasi · {e.distanceKm} km
          {e.mode === 'transit' && ` · ${e.transitTransfers} transfer`}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold">{e.durationMin} mnt</p>
        <p className="text-[11px] text-muted">{e.costRp === 0 ? 'Gratis' : formatRupiah(e.costRp)}</p>
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

  return (
    <div className="page-container py-8">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-card shadow-card sm:aspect-[16/7]" style={{ background: photoGradient(kos.fotoColor) }} role="img" aria-label={`Foto ilustrasi ${kos.namaKos}`}>
        <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-surface/90 px-3 py-1 text-xs font-semibold">
          <Star size={12} className="fill-primary text-primary" /> {formatRating(kos.rating)}
        </span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <section>
          <h1 className="text-2xl font-extrabold sm:text-3xl">{kos.namaKos}</h1>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted">
            <MapPin size={14} /> {kos.area}
          </p>
          <p className="mt-4">
            <span className="text-2xl font-bold text-primary">{formatRupiah(kos.hargaSewa)}</span>{' '}
            <span className="text-sm text-muted">/bulan</span>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="primary" className="capitalize">Kos {kos.tipe}</Badge>
            {kos.fasilitas.map((f) => (
              <Badge key={f} tone="accent">{f}</Badge>
            ))}
          </div>
          <h2 className="mb-1 mt-6 text-base font-semibold">Deskripsi</h2>
          <p className="text-sm leading-relaxed text-muted">{kos.deskripsi}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            <BookmarkButton kos={kos} variant="labeled" />
            {!isOwnKos && (
              <Button size="lg" id="chat-owner" onClick={chatOwner}>
                <MessageCircle size={16} /> Chat Pemilik
              </Button>
            )}
            {isOwnKos && (
              <Link to={`/owner/kos/${kos.id}/edit`}>
                <Button size="lg" variant="outline">Ubah Kos</Button>
              </Link>
            )}
          </div>
        </section>

        <Card className="h-fit p-5" aria-labelledby="commute-heading">
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
