import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, LogOut, MessageCircle, Menu, Store, X } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useChatbotStore } from '../../stores/chatbotStore';
import { Avatar } from '../ui/EmptyState';
import { Button } from '../ui/Button';
import { toast } from '../../stores/toastStore';
import { cn } from '../../lib/cn';

const LINKS = [
  { to: '/', label: 'Beranda', end: true },
  { to: '/cari', label: 'Cari Kos' },
  { to: '/bookmark', label: 'Tersimpan' },
  { to: '/notifikasi', label: 'Notifikasi' },
];

export function Wordmark() {
  return (
    <Link to="/" className="text-xl font-extrabold tracking-tight" aria-label="KosMatch - Beranda">
      <span className="text-primary">Kos</span>
      <span className="text-ink">Match</span>
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
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

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
    cn('text-xs transition-colors', isActive ? 'font-semibold text-ink' : 'text-muted hover:text-ink');

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 sm:px-6">
        <Wordmark />

        <nav aria-label="Navigasi utama" className="hidden items-center gap-8 md:flex">
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
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-ink/5"
              >
                <Avatar name={user.nama} size={32} />
                <span className="max-w-[140px] truncate text-xs font-semibold">{user.nama}</span>
                <ChevronDown size={14} className="text-muted" />
              </button>
              {menuOpen && (
                <div role="menu" className="absolute right-0 mt-2 w-48 animate-fade-in rounded-2xl border border-line bg-surface p-1.5 shadow-card">
                  <Link role="menuitem" to="/chat" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-bg">
                    <MessageCircle size={16} /> Pesan
                  </Link>
                  {user.role === 'owner' && (
                    <Link role="menuitem" to="/owner" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-bg">
                      <Store size={16} /> Kelola Kos
                    </Link>
                  )}
                  <button
                    role="menuitem"
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-bg"
                  >
                    <LogOut size={16} /> Keluar
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to={loginHref} className="hidden md:inline-flex">
              <Button size="sm" id="login-button">Masuk</Button>
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
        <div className="animate-fade-in border-t border-line bg-surface px-4 pb-4 pt-2 md:hidden">
          <nav aria-label="Navigasi seluler" className="flex flex-col">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  cn('rounded-xl px-3 py-3 text-sm', isActive ? 'bg-bg font-semibold text-ink' : 'text-muted')
                }
              >
                {l.label}
              </NavLink>
            ))}
            {user ? (
              <>
                <NavLink to="/chat" className="rounded-xl px-3 py-3 text-sm text-muted">Pesan</NavLink>
                {user.role === 'owner' && (
                  <NavLink to="/owner" className="rounded-xl px-3 py-3 text-sm text-muted">Kelola Kos</NavLink>
                )}
                <button type="button" onClick={handleLogout} className="rounded-xl px-3 py-3 text-left text-sm text-muted">
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
