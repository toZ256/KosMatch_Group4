import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LoginInputSchema, RegisterInputSchema } from '@kosmatch/shared';
import { useLogin, useRegister } from '../api/hooks';
import { errorMessage } from '../api/client';
import { Wordmark } from '../components/layout/Navbar';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { safeRedirect } from '../lib/redirect';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';

const DEMO = {
  tenant: { email: 'tenant@kosmatch.test', password: 'password123' },
  owner: { email: 'owner@kosmatch.test', password: 'password123' },
};

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 text-center">
          <Wordmark />
          <h1 className="mt-4 text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
        {children}
      </Card>
    </div>
  );
}

function DemoButtons({ onDemo, busy }: { onDemo: (role: 'tenant' | 'owner') => void; busy: boolean }) {
  return (
    <div className="mt-6 space-y-2 border-t border-line pt-6">
      <p className="text-center text-xs text-muted">Atau coba cepat dengan akun demo</p>
      <Button variant="accent" className="w-full" disabled={busy} onClick={() => onDemo('tenant')}>
        Masuk sebagai Demo Penyewa
      </Button>
      <Button variant="accent" className="w-full" disabled={busy} onClick={() => onDemo('owner')}>
        Masuk sebagai Demo Pemilik
      </Button>
    </div>
  );
}

export function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const redirect = safeRedirect(params.get('redirect'));
  const token = useAuthStore((s) => s.token);
  const login = useLogin();
  const [demoBusy, setDemoBusy] = useState(false);
  const form = useForm<z.input<typeof LoginInputSchema>>({
    resolver: zodResolver(LoginInputSchema),
    defaultValues: { email: '', password: '' },
  });

  if (token && !login.isPending && !demoBusy) return <Navigate to={redirect} replace />;

  const doLogin = async (input: { email: string; password: string }) => {
    try {
      const res = await login.mutateAsync(input);
      toast.success(`Selamat datang, ${res.user.nama}`);
      navigate(redirect, { replace: true });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const demo = async (role: 'tenant' | 'owner') => {
    setDemoBusy(true);
    await doLogin(DEMO[role]);
    setDemoBusy(false);
  };

  return (
    <AuthShell title="Masuk ke KosMatch" subtitle="Lanjutkan pencarian kos impianmu.">
      <form onSubmit={form.handleSubmit(doLogin)} noValidate className="space-y-4">
        <Input label="Email" type="email" autoComplete="email" placeholder="nama@email.com" error={form.formState.errors.email?.message} {...form.register('email')} />
        <Input label="Password" type="password" autoComplete="current-password" placeholder="Password kamu" error={form.formState.errors.password?.message} {...form.register('password')} />
        <Button type="submit" size="lg" className="w-full" loading={login.isPending && !demoBusy}>
          Masuk
        </Button>
      </form>
      <DemoButtons onDemo={(r) => void demo(r)} busy={login.isPending} />
      <p className="mt-6 text-center text-sm text-muted">
        Belum punya akun?{' '}
        <Link to={`/register${redirect !== '/' ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} className="font-semibold text-primary">
          Daftar
        </Link>
      </p>
    </AuthShell>
  );
}

export function RegisterPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const redirect = safeRedirect(params.get('redirect'));
  const token = useAuthStore((s) => s.token);
  const register = useRegister();
  const login = useLogin();
  const form = useForm<z.input<typeof RegisterInputSchema>>({
    resolver: zodResolver(RegisterInputSchema),
    defaultValues: { nama: '', email: '', password: '', role: 'tenant' },
  });

  if (token && !register.isPending && !login.isPending) return <Navigate to={redirect} replace />;

  const onSubmit = async (input: z.input<typeof RegisterInputSchema>) => {
    try {
      const res = await register.mutateAsync(input);
      toast.success(`Akun berhasil dibuat. Selamat datang, ${res.user.nama}`);
      navigate(redirect, { replace: true });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const demo = async (role: 'tenant' | 'owner') => {
    try {
      const res = await login.mutateAsync(DEMO[role]);
      toast.success(`Selamat datang, ${res.user.nama}`);
      navigate(redirect, { replace: true });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <AuthShell title="Buat Akun KosMatch" subtitle="Daftar gratis sebagai penyewa atau pemilik kos.">
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Input label="Nama" autoComplete="name" placeholder="Nama lengkap" error={form.formState.errors.nama?.message} {...form.register('nama')} />
        <Input label="Email" type="email" autoComplete="email" placeholder="nama@email.com" error={form.formState.errors.email?.message} {...form.register('email')} />
        <Input label="Password" type="password" autoComplete="new-password" placeholder="Minimal 8 karakter" error={form.formState.errors.password?.message} {...form.register('password')} />
        <Select label="Daftar sebagai" error={form.formState.errors.role?.message} {...form.register('role')}>
          <option value="tenant">Calon Penyewa</option>
          <option value="owner">Pemilik Kos</option>
        </Select>
        <Button type="submit" size="lg" className="w-full" loading={register.isPending}>
          Daftar
        </Button>
      </form>
      <DemoButtons onDemo={(r) => void demo(r)} busy={register.isPending || login.isPending} />
      <p className="mt-6 text-center text-sm text-muted">
        Sudah punya akun?{' '}
        <Link to={`/login${redirect !== '/' ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} className="font-semibold text-primary">
          Masuk
        </Link>
      </p>
    </AuthShell>
  );
}
