import { Bookmark } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Kos } from '@kosmatch/shared';
import { useBookmarks, useToggleBookmark } from '../../api/hooks';
import { useAuthStore } from '../../stores/authStore';
import { cn } from '../../lib/cn';

interface BookmarkButtonProps {
  kos: Kos;
  className?: string;
  /** "icon" is the round overlay used on cards; "labeled" shows text (detail page). */
  variant?: 'icon' | 'labeled';
}

export function BookmarkButton({ kos, className, variant = 'icon' }: BookmarkButtonProps) {
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();
  const location = useLocation();
  const { data: bookmarks } = useBookmarks();
  const toggle = useToggleBookmark();
  const saved = !!bookmarks?.some((k) => k.id === kos.id);

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token) {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    toggle.mutate({ kos, saved });
  };

  const label = saved ? 'Hapus dari tersimpan' : 'Simpan kos';
  const icon = <Bookmark size={16} className={cn(saved && 'fill-primary text-primary')} />;

  if (variant === 'labeled') {
    return (
      <button
        type="button"
        aria-pressed={saved}
        aria-label={label}
        onClick={onClick}
        className={cn(
          'inline-flex h-12 items-center justify-center gap-2 rounded-full border border-line bg-surface px-6 text-sm font-semibold text-ink transition hover:bg-bg',
          className,
        )}
      >
        {icon}
        {saved ? 'Tersimpan' : 'Simpan'}
      </button>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-full bg-surface/90 text-ink shadow-sm transition hover:bg-surface',
        className,
      )}
    >
      {icon}
    </button>
  );
}
