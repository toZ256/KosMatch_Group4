import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useKosList } from '../api/hooks';
import { KosCard, KosCardSkeleton, KosGrid } from '../components/kos/KosCard';
import { SearchBar } from '../components/kos/SearchBar';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { useChatbotStore } from '../stores/chatbotStore';
import { toSearchString } from '../lib/search';

export function LandingPage() {
  const navigate = useNavigate();
  const openChatbot = useChatbotStore((s) => s.openPanel);
  const { data, isLoading, isError, refetch } = useKosList({});

  const popular = useMemo(() => [...(data ?? [])].sort((a, b) => b.rating - a.rating).slice(0, 4), [data]);

  const onChatbotClick = () => {
    openChatbot();
  };

  return (
    <div className="page-container pb-20 pt-8 sm:pt-12">
      <section className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <h1 className="text-3xl font-extrabold leading-[1.18] tracking-tight text-ink sm:text-5xl">
          Cari Kos Impian,{' '}
          <span className="relative inline-block">
            <span className="relative z-10 inline-block -rotate-1 rounded-2xl bg-primary/15 px-3 py-0.5 text-primary">
              Hemat Waktu Perjalanan
            </span>
            <svg
              aria-hidden
              viewBox="0 0 240 16"
              fill="none"
              className="mx-auto -mt-1 h-3.5 w-full max-w-[260px] text-primary"
            >
              <path
                d="M4 11C62 3 158 2 236 10"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </h1>

        <p className="mt-4 max-w-[560px] text-sm leading-relaxed text-muted sm:text-base">
          Temukan tempat tinggal ideal di Jakarta berdasarkan budget dan estimasi waktu tempuh ke kampus atau kantor — jadi kamu fokus kuliah dan kerja tanpa tua di jalan.
        </p>

        <div className="relative mt-7 flex flex-col items-center sm:flex-row sm:gap-5">
          <Button id="open-chatbot" variant="accent" size="lg" onClick={onChatbotClick}>
            <Sparkles size={17} />
            Cari Kos dengan AI Chatbot
          </Button>

          <div aria-hidden className="mt-3 flex items-center gap-1.5 text-left sm:mt-0">
            <svg width="38" height="26" viewBox="0 0 42 28" fill="none" className=" hidden text-primary sm:block">
              <path
                d="M39 22C27 25 18 19 21 10C23 4 31 6 28 13C25 19 14 17 4 9M4 9L11 7M4 9L8 16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="-rotate-2 text-xs font-bold leading-tight text-primary">
              cukup ketik bahasa alami,
              <br />
              <span className="text-muted">langsung dapat rekomendasi!</span>
            </p>
          </div>
        </div>
      </section>

      <div className="mt-10">
        <SearchBar
          onSubmit={(values) => navigate(`/cari${toSearchString(values)}`)}
        />
      </div>

      <section className="mt-16" aria-labelledby="popular-heading">
        <div className="mb-6 flex items-center justify-between">
          <h2 id="popular-heading" className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
            Rekomendasi Kos Populer
          </h2>
          <span className="hidden rounded-full border border-line/70 bg-surface px-3.5 py-1 text-xs font-semibold text-muted sm:inline-block">
            Rating Tertinggi
          </span>
        </div>
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
