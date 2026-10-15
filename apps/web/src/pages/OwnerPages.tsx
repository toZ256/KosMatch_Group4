import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { KosFormSchema, FASILITAS_OPTIONS } from '@kosmatch/shared';
import type { Kos, KosFormOutput } from '@kosmatch/shared';
import { useDeleteOwnerKos, useOwnerKos, useSaveOwnerKos } from '../api/hooks';
import { errorMessage } from '../api/client';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { formatRupiah, photoGradient } from '../lib/format';
import { toast } from '../stores/toastStore';

/* ─── Owner Dashboard ─────────────────────────────────────────── */

function KosListRow({ kos, onDelete }: { kos: Kos; onDelete: (k: Kos) => void }) {
  return (
    <Card className="flex items-center gap-4 p-4">
      <div
        className="h-16 w-16 shrink-0 rounded-xl"
        style={{ background: photoGradient(kos.fotoColor) }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-ink">{kos.namaKos}</p>
        <p className="text-sm text-muted">{kos.area} · {formatRupiah(kos.hargaSewa)}/bulan</p>
        <p className="text-xs capitalize text-muted">Kos {kos.tipe}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Link to={`/owner/kos/${kos.id}/edit`}>
          <Button variant="outline" size="sm" aria-label="Ubah kos">
            <Edit2 size={14} />
          </Button>
        </Link>
        <Button variant="outline" size="sm" aria-label="Hapus kos" onClick={() => onDelete(kos)}>
          <Trash2 size={14} className="text-bahaya" />
        </Button>
      </div>
    </Card>
  );
}

export function OwnerDashboardPage() {
  const { data: kosList = [], isLoading, isError, refetch } = useOwnerKos();
  const deleteKos = useDeleteOwnerKos();
  const [toDelete, setToDelete] = useState<Kos | null>(null);

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteKos.mutateAsync(toDelete.id);
      toast.success(`"${toDelete.namaKos}" berhasil dihapus`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
    setToDelete(null);
  };

  return (
    <div className="page-container py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kos Saya</h1>
        <Link to="/owner/kos/baru">
          <Button id="owner-add-kos">
            <Plus size={16} /> Tambah Kos
          </Button>
        </Link>
      </div>

      {isError ? (
        <EmptyState
          title="Gagal memuat kos"
          action={<Button onClick={() => void refetch()}>Coba Lagi</Button>}
        />
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-card bg-ink/5" />
          ))}
        </div>
      ) : kosList.length === 0 ? (
        <EmptyState
          title="Belum ada kos terdaftar"
          description="Tambahkan kos pertama kamu untuk mulai menerima calon penyewa."
          action={
            <Link to="/owner/kos/baru">
              <Button>
                <Plus size={16} /> Tambah Kos
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {kosList.map((k) => (
            <KosListRow key={k.id} kos={k} onDelete={(kos) => setToDelete(kos)} />
          ))}
        </div>
      )}

      <Modal
        open={!!toDelete}
        title="Hapus Kos"
        onClose={() => setToDelete(null)}
      >
        <p className="text-sm text-muted">
          Yakin ingin menghapus <span className="font-semibold text-ink">{toDelete?.namaKos}</span>? Tindakan ini tidak dapat dibatalkan.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="outline" onClick={() => setToDelete(null)}>
            Batal
          </Button>
          <Button
            onClick={() => void handleDelete()}
            loading={deleteKos.isPending}
            className="bg-bahaya hover:bg-bahaya/90"
          >
            Hapus
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/* ─── Owner Kos Form (Add / Edit) ────────────────────────────── */

type FormValues = {
  namaKos: string;
  area: string;
  hargaSewa: number;
  latitude: number;
  longitude: number;
  tipe: 'putra' | 'putri' | 'campur';
  fasilitas: Array<typeof FASILITAS_OPTIONS[number]>;
  deskripsi: string;
};

export function OwnerKosFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const { data: kosList = [] } = useOwnerKos();
  const existing = kosList.find((k) => k.id === id);
  const save = useSaveOwnerKos(id);

  const form = useForm<FormValues>({
    resolver: zodResolver(KosFormSchema),
    defaultValues: existing
      ? {
          namaKos: existing.namaKos,
          area: existing.area,
          hargaSewa: existing.hargaSewa,
          latitude: existing.latitude,
          longitude: existing.longitude,
          tipe: existing.tipe,
          fasilitas: existing.fasilitas as Array<typeof FASILITAS_OPTIONS[number]>,
          deskripsi: existing.deskripsi,
        }
      : {
          namaKos: '',
          area: '',
          hargaSewa: 0,
          latitude: -6.2088,
          longitude: 106.8456,
          tipe: 'campur',
          fasilitas: [],
          deskripsi: '',
        },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const result = await save.mutateAsync(values as KosFormOutput);
      toast.success(isEdit ? 'Kos berhasil diperbarui' : 'Kos baru berhasil ditambahkan');
      navigate(`/kos/${result.id}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="page-container py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link to="/owner/kos" className="text-sm text-muted hover:text-ink">
          ← Kos Saya
        </Link>
        <span className="text-muted">/</span>
        <h1 className="text-xl font-bold">{isEdit ? 'Ubah Kos' : 'Tambah Kos Baru'}</h1>
      </div>

      <Card className="mx-auto max-w-2xl p-6 sm:p-8">
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
          <Input
            label="Nama Kos"
            placeholder="mis. Kos Melati Kemang"
            error={form.formState.errors.namaKos?.message}
            {...form.register('namaKos')}
          />
          <Input
            label="Area / Kelurahan"
            placeholder="mis. Kemang, Jakarta Selatan"
            error={form.formState.errors.area?.message}
            {...form.register('area')}
          />
          <Input
            label="Harga Sewa per Bulan (Rp)"
            type="number"
            placeholder="mis. 1500000"
            error={form.formState.errors.hargaSewa?.message}
            {...form.register('hargaSewa', { valueAsNumber: true })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Latitude"
              type="number"
              step="0.0001"
              placeholder="-6.2088"
              error={form.formState.errors.latitude?.message}
              {...form.register('latitude', { valueAsNumber: true })}
            />
            <Input
              label="Longitude"
              type="number"
              step="0.0001"
              placeholder="106.8456"
              error={form.formState.errors.longitude?.message}
              {...form.register('longitude', { valueAsNumber: true })}
            />
          </div>
          <Select
            label="Tipe Kos"
            error={form.formState.errors.tipe?.message}
            {...form.register('tipe')}
          >
            <option value="putra">Putra</option>
            <option value="putri">Putri</option>
            <option value="campur">Campur</option>
          </Select>

          {/* Fasilitas checkboxes */}
          <Controller
            control={form.control}
            name="fasilitas"
            render={({ field, fieldState }) => (
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium text-ink">Fasilitas</p>
                <div className="flex flex-wrap gap-2">
                  {FASILITAS_OPTIONS.map((f) => {
                    const checked = field.value.includes(f);
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() =>
                          field.onChange(
                            checked ? field.value.filter((x) => x !== f) : [...field.value, f],
                          )
                        }
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          checked
                            ? 'border-accent bg-accent/15 text-ink'
                            : 'border-line bg-surface text-muted hover:border-accent'
                        }`}
                      >
                        {f}
                      </button>
                    );
                  })}
                </div>
                {fieldState.error && (
                  <p role="alert" className="text-xs text-bahaya">
                    {fieldState.error.message}
                  </p>
                )}
              </div>
            )}
          />

          <Textarea
            label="Deskripsi"
            placeholder="Ceritakan detail kos, lingkungan sekitar, aturan kos, dll."
            error={form.formState.errors.deskripsi?.message}
            {...form.register('deskripsi')}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Link to="/owner/kos">
              <Button type="button" variant="outline">
                Batal
              </Button>
            </Link>
            <Button type="submit" loading={save.isPending}>
              {isEdit ? 'Simpan Perubahan' : 'Tambah Kos'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
