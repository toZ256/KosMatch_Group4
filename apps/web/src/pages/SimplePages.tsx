import { useNavigate } from 'react-router-dom';
import { Bell, Bookmark, Compass } from 'lucide-react';
import { useBookmarks } from '../api/hooks';
import { KosCard, KosCardSkeleton, KosGrid } from '../components/kos/KosCard';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';

export function BookmarkPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useBookmarks();
  return (
    <div className="page-container py-8">
      <h1 className="mb-5 text-2xl font-bold">Kos Tersimpan</h1>
      {isError ? (
        <EmptyState
          title="Gagal memuat kos tersimpan"
          action={<Button onClick={() => void refetch()}>Coba Lagi</Button>}
        />
      ) : isLoading ? (
        <KosGrid>
          {Array.from({ length: 4 }, (_, i) => (
            <KosCardSkeleton key={i} />
          ))}
        </KosGrid>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<Bookmark size={26} />}
          title="Belum ada kos tersimpan"
          description="Simpan kos favoritmu dengan menekan ikon bookmark, lalu bandingkan nanti."
          action={
            <Button onClick={() => navigate('/cari')}>
              <Compass size={16} /> Cari Kos
            </Button>
          }
        />
      ) : (
        <KosGrid>
          {data.map((k) => (
            <KosCard key={k.id} kos={k} />
          ))}
        </KosGrid>
      )}
    </div>
  );
}

export function NotificationsPage() {
  return (
    <div className="page-container py-8">
      <h1 className="mb-5 text-2xl font-bold">Notifikasi</h1>
      <EmptyState
        icon={<Bell size={26} />}
        title="Belum ada notifikasi"
        description="Kabar terbaru tentang kos dan pesanmu akan muncul di sini."
      />
    </div>
  );
}

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="page-container py-16">
      <EmptyState
        title="Halaman tidak ditemukan"
        description="Alamat yang kamu buka tidak tersedia atau sudah dipindahkan."
        action={<Button onClick={() => navigate('/')}>Kembali ke Beranda</Button>}
      />
    </div>
  );
}
