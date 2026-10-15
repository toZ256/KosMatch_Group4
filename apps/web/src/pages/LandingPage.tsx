import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useKosList } from '../api/hooks';
import { KosCard, KosCardSkeleton, KosGrid } from '../components/kos/KosCard';
import { SearchBar } from '../components/kos/SearchBar';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuthStore } from '../stores/authStore';
import { useChatbotStore } from '../stores/chatbotStore';
import { CHATBOT_REDIRECT } from '../lib/redirect';
import { toSearchString } from '../lib/search';

export function LandingPage() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const openChatbot = useChatbotStore((s) => s.openPanel);
  const { data, isLoading, isError, refetch } = useKosList({});

  const popular = useMemo(() => [...(data ?? [])].sort((a, b) => b.rating - a.rating).slice(0, 4), [data]);

  const onChatbotClick = () => {
    if (!token) navigate(`/login?redirect=${encodeURIComponent(CHATBOT_REDIRECT)}`);
    else openChatbot();
  };

  return (
    <div className="page-container pb-16 pt-12 sm:pt-16">
      <section className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
          Cari Kos Impian, <span className="text-primary">Hemat Waktu Perjalanan</span>
        </h1>
        <p className="mt-4 max-w-[560px] text-sm text-muted sm:text-base">
          Temukan tempat tinggal ideal di Jakarta berdasarkan budget dan estimasi waktu tempuh ke kampus atau kantor.
        </p>
        <Button id="open-chatbot" variant="accent" size="lg" className="mt-6" onClick={onChatbotClick}>
          <Sparkles size={16} />
          Cari Kos dengan AI Chatbot
        </Button>
      </section>

      <div className="mt-8">
        <SearchBar
          onSubmit={(values) => navigate(`/cari${toSearchString(values)}`)}
        />
      </div>

      <section className="mt-14" aria-labelledby="popular-heading">
        <h2 id="popular-heading" className="mb-5 text-xl font-semibold text-ink">
          Rekomendasi Kos Populer
        </h2>
        {isError ? (
          <EmptyState
            title="Gagal memuat kos"
            description="Terjadi kesalahan saat mengambil data. Coba lagi sebentar."
            action={<Button onClick={() => void refetch()}>Coba Lagi</Button>}
          />
        ) : (
          <KosGrid>
            {isLoading
              ? Array.from({ length: 4 }, (_, i) => <KosCardSkeleton key={i} />)
              : popular.map((k) => <KosCard key={k.id} kos={k} />)}
          </KosGrid>
        )}
      </section>
    </div>
  );
}
