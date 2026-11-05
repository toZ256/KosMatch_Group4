import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'accent' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  pill?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    'bg-primary text-white shadow-tactile-primary hover:brightness-105 active:translate-y-[2px] active:shadow-none',
  accent:
    'bg-accent text-white shadow-tactile-accent hover:brightness-105 active:translate-y-[2px] active:shadow-none',
  ghost: 'bg-transparent text-ink hover:bg-ink/5 active:scale-[0.98]',
  outline:
    'border-2 border-line/80 bg-surface text-ink shadow-sm hover:border-accent/50 hover:bg-bg/60 active:translate-y-[1px]',
  danger: 'bg-bahaya text-white shadow-sm hover:brightness-95 active:translate-y-[1px]',
};
const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-xs',
  md: 'h-11 px-5 text-sm',
  lg: 'h-13 px-7 py-3 text-sm sm:text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, pill = true, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-bold tracking-tight transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none',
        pill ? 'rounded-full' : 'rounded-2xl',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
});
