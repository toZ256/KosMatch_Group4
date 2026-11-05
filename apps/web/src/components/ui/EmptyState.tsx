import type { ReactNode } from 'react';
import { initials } from '../../lib/format';
import { cn } from '../../lib/cn';

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3.5 rounded-[32px] border border-line/60 bg-surface/95 px-6 py-16 text-center shadow-card backdrop-blur-sm">
      {icon && <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/15 text-accent shadow-inner">{icon}</div>}
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      {description && <p className="max-w-sm text-sm leading-relaxed text-muted">{description}</p>}
      <div className="mt-1">{action}</div>
    </div>
  );
}

export function Avatar({ name, size = 36, className }: { name: string; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-white', className)}
    >
      {initials(name) || '?'}
    </span>
  );
}
