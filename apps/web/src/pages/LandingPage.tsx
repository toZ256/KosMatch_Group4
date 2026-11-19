import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Building, Edit2, Eye, MessageCircle, Plus, Sparkles, Store } from 'lucide-react';
import { useConversations, useKosList, useOwnerKos } from '../api/hooks';
import { KosCard, KosCardSkeleton, KosGrid } from '../components/kos/KosCard';
import { SearchBar } from '../components/kos/SearchBar';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { useChatbotStore } from '../stores/chatbotStore';
import { useAuthStore } from '../stores/authStore';
import { formatRupiah, photoGradient } from '../lib/format';
import { toSearchString } from '../lib/search';

function OwnerHomeView({ nama }: { nama: string }) {
  const { data: kosList = [], isLoading: loadingKos } = useOwnerKos();
  const { data: conversations = [], isLoading: loadingChats } = useConversations();

  return (
    <div className="page-container pb-20 pt-8 sm:pt-12">
      {/* Header Banner */}
      <section className="mb-8 rounded-[32px] border border-line/80 bg-surface/90 p-6 shadow-sm backdrop-blur-sm sm:p-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary">
              <Store size={14} /> Pemilik Kos Terverifikasi
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-4xl">
              Selamat Datang, {nama}! 👋
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
              Kelola properti kos Anda, pantau pertanyaan masuk dari calon penyewa, dan optimalkan hunian Anda dari satu tempat.
            </p>
          </div>
          <Link to="/owner/kos/baru" className="shrink-0">
            <Button size="lg" className="gap-2 shadow-sm">
              <Plus size={18} /> Tambah Kos Baru
            </Button>
          </Link>
        </div>
      </section>

      {/* Quick Action & Metric Cards */}
      <section className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link to="/owner/kos" className="block">
          <Card className="group p-5 transition hover:border-primary/50 hover:shadow-float">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary transition group-hover:scale-105">
                <Building size={22} />
              </div>
              <ArrowRight size={16} className="text-muted transition group-hover:translate-x-1 group-hover:text-primary" />
            </div>
            <p className="mt-4 text-2xl font-extrabold text-ink">
              {loadingKos ? '...' : kosList.length} Kos
            </p>
            <p className="text-xs font-medium text-muted">Properti Terdaftar di KosMatch</p>
          </Card>
        </Link>

        <Link to="/chat" className="block">
          <Card className="group p-5 transition hover:border-accent/50 hover:shadow-float">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15 text-accent transition group-hover:scale-105">
                <MessageCircle size={22} />
              </div>
              <ArrowRight size={16} className="text-muted transition group-hover:translate-x-1 group-hover:text-accent" />
            </div>
            <p className="mt-4 text-2xl font-extrabold text-ink">
              {loadingChats ? '...' : conversations.length} Percakapan
            </p>
            <p className="text-xs font-medium text-muted">Pesan dari Calon Penyewa</p>
          </Card>
        </Link>

        <Link to="/owner/kos/baru" className="block">
          <Card className="group border-dashed p-5 transition hover:border-primary/60 hover:bg-primary/5">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary transition group-hover:scale-105">
                <Plus size={22} />
              </div>
              <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-bold text-primary">Aksi Cepat</span>
            </div>
            <p className="mt-4 text-lg font-bold text-ink">Daftarkan Kos Baru</p>
            <p className="text-xs font-medium text-muted">Tambah listing kamar untuk menjangkau penyewa</p>
          </Card>
        </Link>
      </section>

      {/* Kos Milik Saya Grid */}
      <section className="mb-12">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">Kos Milik Saya</h2>
            <p className="text-xs text-muted sm:text-sm">Kelola informasi dan harga sewa properti kos Anda.</p>
          </div>
          <Link to="/owner/kos">
            <Button variant="outline" size="sm">Lihat Semua ({kosList.length})</Button>
          </Link>
        </div>

        {kosList.length === 0 ? (
          <EmptyState
            title="Belum ada kos terdaftar"
            description="Tambahkan kos pertama Anda untuk mulai menerima calon penyewa."
            action={
              <Link to="/owner/kos/baru">
                <Button className="gap-2">
                  <Plus size={16} /> Tambah Kos Pertama
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {kosList.slice(0, 6).map((k) => (
              <Card key={k.id} className="flex flex-col justify-between p-4 transition hover:shadow-float">
                <div>
                  <div
                    className="h-28 w-full rounded-2xl transition"
                    style={{ background: photoGradient(k.fotoColor) }}
                    aria-hidden
                  />
                  <div className="mt-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-bg px-2.5 py-0.5 text-[11px] font-bold capitalize text-muted">
                        Kos {k.tipe}
                      </span>
                      <span className="text-xs font-semibold text-primary">{formatRupiah(k.hargaSewa)}/bln</span>
                    </div>
                    <h3 className="mt-1.5 truncate font-bold text-ink">{k.namaKos}</h3>
                    <p className="text-xs text-muted">{k.area}</p>
                  </div>
                </div>

                <div className="mt-4 flex gap-2 border-t border-line/60 pt-3">
                  <Link to={`/owner/kos/${k.id}/edit`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full gap-1.5">
                      <Edit2 size={13} /> Ubah
                    </Button>
                  </Link>
                  <Link to={`/kos/${k.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full gap-1.5">
                      <Eye size={13} /> Lihat
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Pertanyaan Terbaru Calon Penyewa */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">Pertanyaan Calon Penyewa</h2>
          <Link to="/chat">
            <Button variant="outline" size="sm">Buka Kotak Masuk</Button>
          </Link>
        </div>

        {conversations.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted">
            Belum ada pesan baru dari calon penyewa. Saat ada penyewa yang menanyakan kos Anda, pesan akan muncul di sini.
          </Card>
        ) : (
          <div className="space-y-3">
            {conversations.slice(0, 3).map((c) => (
              <Card key={c.otherUser.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-ink">{c.otherUser.nama}</p>
                    <span className="text-[11px] text-muted">
                      {new Date(c.last.sentAt).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted">{c.last.pesan}</p>
                </div>
                <Link to={`/chat/${c.otherUser.id}`} className="shrink-0">
                  <Button size="sm" variant="accent" className="gap-1.5">
                    <MessageCircle size={14} /> Balas Chat
                  </Button>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function LandingPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const openChatbot = useChatbotStore((s) => s.openPanel);
  const { data, isLoading, isError, refetch } = useKosList({});

  const popular = useMemo(() => [...(data ?? [])].sort((a, b) => b.rating - a.rating).slice(0, 4), [data]);

  if (user?.role === 'owner') {
    return <OwnerHomeView nama={user.nama} />;
  }

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
