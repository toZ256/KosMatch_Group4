import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-[28px] border border-line/60 bg-surface shadow-card', className)} {...rest} />;
}

export function Badge({
  className,
  tone = 'neutral',
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: 'neutral' | 'accent' | 'primary' }) {
  const tones = {
    neutral: 'bg-ink/5 text-ink border border-line/60',
    accent: 'bg-accent/15 text-ink border border-accent/25',
    primary: 'bg-primary/10 text-primary border border-primary/20',
  };
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold', tones[tone], className)}
      {...rest}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-2xl bg-ink/10', className)} />;
}
