import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { useToastStore } from '../../stores/toastStore';
import { cn } from '../../lib/cn';

export function ToastViewport() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-20 z-[60] flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => {
        const Icon = t.type === 'sukses' ? CheckCircle2 : t.type === 'bahaya' ? XCircle : Info;
        return (
          <button
            key={t.id}
            type="button"
            role="status"
            onClick={() => dismiss(t.id)}
            className={cn(
              'pointer-events-auto flex max-w-sm animate-fade-in items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-white shadow-card',
              t.type === 'sukses' && 'bg-sukses',
              t.type === 'bahaya' && 'bg-bahaya',
              t.type === 'info' && 'bg-ink',
            )}
          >
            <Icon size={16} />
            <span>{t.message}</span>
          </button>
        );
      })}
    </div>
  );
}
