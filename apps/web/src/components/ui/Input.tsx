import { forwardRef, useId, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

const fieldClass =
  'w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30';

interface FieldProps {
  label?: string;
  error?: string;
}

function Field({ label, error, id, children }: FieldProps & { id: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
      )}
      {children}
      {error && (
        <p role="alert" className="text-xs text-bahaya">
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps>(
  function Input({ label, error, className, id, ...rest }, ref) {
    const auto = useId();
    const fid = id ?? auto;
    return (
      <Field label={label} error={error} id={fid}>
        <input ref={ref} id={fid} aria-invalid={!!error} className={cn(fieldClass, error && 'border-bahaya', className)} {...rest} />
      </Field>
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps>(
  function Textarea({ label, error, className, id, ...rest }, ref) {
    const auto = useId();
    const fid = id ?? auto;
    return (
      <Field label={label} error={error} id={fid}>
        <textarea ref={ref} id={fid} rows={4} aria-invalid={!!error} className={cn(fieldClass, error && 'border-bahaya', className)} {...rest} />
      </Field>
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & FieldProps>(
  function Select({ label, error, className, id, children, ...rest }, ref) {
    const auto = useId();
    const fid = id ?? auto;
    return (
      <Field label={label} error={error} id={fid}>
        <select ref={ref} id={fid} aria-invalid={!!error} className={cn(fieldClass, error && 'border-bahaya', className)} {...rest}>
          {children}
        </select>
      </Field>
    );
  },
);
