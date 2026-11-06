import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Home, LogOut, MessageCircle, Menu, Store, X } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useChatbotStore } from '../../stores/chatbotStore';
import { Avatar } from '../ui/EmptyState';
import { Button } from '../ui/Button';
import { toast } from '../../stores/toastStore';
import { cn } from '../../lib/cn';

const LINKS = [
  { to: '/', label: 'Beranda', end: true },
  { to: '/cari', label: 'Cari Kos' },
  { to: '/tersimpan', label: 'Tersimpan' },
  { to: '/notifikasi', label: 'Notifikasi' },
];

export function Wordmark() {
  return (
    <Link to="/" className="inline-flex items-center gap-2 text-lg font-extrabold tracking-tight" aria-label="KosMatch - Beranda">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Home size={17} strokeWidth={2.5} />
      </span>
      <span>
        <span className="text-primary">Kos</span>
        <span className="text-ink">Match</span>
      </span>
    </Link>
  );
}

export function Navbar() {
  const { user, logout } = useAuthStore();
  const resetChatbot = useChatbotStore((s) => s.reset);
  const closeChatbot = useChatbotStore((s) => s.closePanel);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const lastScrolledRef = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let rafId = 0;
    const updateScroll = () => {
      rafId = 0;
      const isScrolled = window.scrollY > 16;
      if (isScrolled !== lastScrolledRef.current) {
        lastScrolledRef.current = isScrolled;
        setScrolled(isScrolled);
      }
    };
    const onScroll = () => {
      if (!rafId) rafId = window.requestAnimationFrame(updateScroll);
    };
    updateScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const loginHref = `/login?redirect=${encodeURIComponent(location.pathname + location.search)}`;

  const handleLogout = () => {
    logout();
    qc.clear();
    resetChatbot();
    closeChatbot();
    setMenuOpen(false);
    setMobileOpen(false);
    toast.success('Kamu sudah keluar');
    navigate('/');
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'rounded-full px-3.5 py-1.5 text-xs transition-all',
      isActive ? 'bg-ink/5 font-bold text-ink' : 'font-medium text-muted hover:bg-ink/5 hover:text-ink',
    );

  return (
    <header
      className={cn(
        'sticky top-0 z-40 transform-gpu transition-[padding] duration-200 ease-out',
        scrolled ? 'px-3 pt-2.5 sm:px-6 sm:pt-3' : 'px-4 pt-2 sm:px-6 sm:pt-3',
      )}
    >
      <div
        className={cn(
          'mx-auto flex items-center justify-between transform-gpu transition-[max-width,background-color,border-color,box-shadow,padding] duration-200 ease-out',
          scrolled
            ? 'h-14 max-w-[920px] rounded-full border border-line/80 bg-surface/95 px-4 shadow-float backdrop-blur-md sm:h-15 sm:px-6'
            : 'h-16 max-w-[1160px] rounded-full border border-transparent bg-transparent px-2 shadow-none sm:px-4',
        )}
      >
        <Wordmark />

        <nav aria-label="Navigasi utama" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <div className="relative hidden md:block" ref={menuRef}>
              <button
                type="button"
                id="user-menu-button"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-full border border-line/80 bg-bg/60 py-1 pl-1.5 pr-3 transition hover:border-accent/50 hover:bg-surface"
              >
                <Avatar name={user.nama} size={30} />
                <span className="max-w-[140px] truncate text-xs font-semibold">{user.nama}</span>
                <ChevronDown size={14} className="text-muted" />
              </button>
              {menuOpen && (
                <div role="menu" className="absolute right-0 mt-2.5 w-52 animate-fade-in rounded-[24px] border border-line/70 bg-surface p-2 shadow-float">
                  <Link role="menuitem" to="/chat" className="flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition hover:bg-bg">
                    <MessageCircle size={16} className="text-accent" /> Pesan
                  </Link>
                  {user.role === 'owner' && (
                    <Link role="menuitem" to="/owner" className="flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition hover:bg-bg">
                      <Store size={16} className="text-primary" /> Kelola Kos
                    </Link>
                  )}
                  <button
                    role="menuitem"
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-left text-sm font-medium text-ink transition hover:bg-bg"
                  >
                    <LogOut size={16} className="text-muted" /> Keluar
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to={loginHref} className="hidden md:inline-flex">
              <Button size="sm" id="login-button" className="px-5">
                Masuk
              </Button>
            </Link>
          )}

          <button
            type="button"
            aria-label={mobileOpen ? 'Tutup menu' : 'Buka menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((o) => !o)}
            className="rounded-full p-2 hover:bg-ink/5 md:hidden"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="mx-auto mt-2 max-w-[980px] animate-fade-in rounded-[28px] border border-line/70 bg-surface/95 p-4 shadow-float backdrop-blur-md md:hidden">
          <nav aria-label="Navigasi seluler" className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  cn('rounded-2xl px-4 py-3 text-sm transition', isActive ? 'bg-bg font-bold text-ink' : 'font-medium text-muted hover:bg-bg/60')
                }
              >
                {l.label}
              </NavLink>
            ))}
            {user ? (
              <>
                <NavLink to="/chat" className="rounded-2xl px-4 py-3 text-sm font-medium text-muted hover:bg-bg/60">Pesan</NavLink>
                {user.role === 'owner' && (
                  <NavLink to="/owner" className="rounded-2xl px-4 py-3 text-sm font-medium text-muted hover:bg-bg/60">Kelola Kos</NavLink>
                )}
                <button type="button" onClick={handleLogout} className="rounded-2xl px-4 py-3 text-left text-sm font-medium text-muted hover:bg-bg/60">
                  Keluar ({user.nama})
                </button>
              </>
            ) : (
              <Link to={loginHref} className="mt-2">
                <Button className="w-full">Masuk</Button>
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
