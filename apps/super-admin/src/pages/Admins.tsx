import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { LoadingBlock } from '../components/LoadingBlock';
import { PageHeader } from '../components/PageHeader';
import type { AdminAccount } from '../types/admin';
import { adminApi } from '../utils/api';

const adminSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().or(z.literal('')),
  mobile: z.string().regex(/^[6-9]\d{9}$/),
  password: z.string().min(6).or(z.literal('')).optional(),
  storeId: z.string().optional(),
});

type AdminFormInput = z.input<typeof adminSchema>;
type AdminFormOutput = z.output<typeof adminSchema>;

const adminDefaultValues: AdminFormInput = {
  name: '',
  email: '',
  mobile: '',
  password: '',
  storeId: '',
};

export default function AdminsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<AdminAccount | null>(null);
  const [search, setSearch] = useState('');

  const adminsQuery = useQuery({
    queryKey: ['super-admin-admins', search],
    queryFn: () => adminApi.admins({ search, limit: 100 }),
  });

  const storesQuery = useQuery({
    queryKey: ['super-admin-store-list'],
    queryFn: () => adminApi.stores({ limit: 200 }),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<AdminFormInput, undefined, AdminFormOutput>({
    resolver: zodResolver(adminSchema),
    defaultValues: adminDefaultValues,
  });

  useEffect(() => {
    if (!editing) {
      reset(adminDefaultValues);
      return;
    }

    reset({
      name: editing.name,
      email: editing.email || '',
      mobile: editing.mobile,
      password: '',
      storeId: editing.assignedStore?.id || '',
    });
  }, [editing, reset]);

  const upsertMutation = useMutation({
    mutationFn: async (values: AdminFormOutput) => {
      if (editing) {
        const payload: Record<string, unknown> = {
          name: values.name,
          email: values.email,
          mobile: values.mobile,
          storeId: values.storeId ? values.storeId : null,
        };

        if (values.password && values.password.trim()) {
          payload.password = values.password;
        }

        return adminApi.updateAdmin(editing.id, payload);
      }

      if (!values.password || !values.password.trim()) {
        throw new Error('Password is required for new admin accounts');
      }

      const payload: Record<string, unknown> = {
        name: values.name,
        email: values.email,
        mobile: values.mobile,
        password: values.password,
      };

      if (values.storeId) {
        payload.storeId = values.storeId;
      }

      return adminApi.createAdmin(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-admins'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-store-list'] });
      setEditing(null);
      reset(adminDefaultValues);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => adminApi.deactivateAdmin(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-admins'] });
    },
  });

  if (adminsQuery.isLoading) return <LoadingBlock label="Loading admins..." />;

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-[1.75rem] border border-primary-100 bg-white p-5">
        <PageHeader
          title="All Admins"
          subtitle="Create, edit, deactivate, and assign store-admin accounts."
        />

        <form onSubmit={handleSubmit((values) => upsertMutation.mutate(values))} className="mt-6 space-y-4">
          <input {...register('name')} placeholder="Admin name" className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
          <div className="grid gap-3 md:grid-cols-2">
            <input {...register('mobile')} placeholder="Mobile" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
            <input {...register('email')} placeholder="Email" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
          </div>
          <input
            type="password"
            {...register('password')}
            placeholder={editing ? 'Set new password (optional)' : 'Temporary password'}
            className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
          />
          <select {...register('storeId')} className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3">
            <option value="">Assign store later</option>
            {storesQuery.data?.data.map((store) => (
              <option key={store.id} value={store.id}>{store.name}</option>
            ))}
          </select>

          <div className="flex gap-3">
            <button type="submit" disabled={isSubmitting} className="rounded-2xl bg-primary-500 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white">
              {editing ? 'Update Admin' : 'Create Admin'}
            </button>
            {editing ? (
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  reset(adminDefaultValues);
                }}
                className="rounded-2xl border border-primary-100 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-600"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="space-y-4">
        <div className="rounded-[1.5rem] border border-primary-100 bg-white p-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search admins by name, mobile, email"
            className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
          />
        </div>

        {adminsQuery.data?.data.map((admin) => (
          <div key={admin.id} className="rounded-[1.5rem] border border-primary-100 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-black text-slate-900">{admin.name}</p>
                <p className="mt-1 text-sm text-slate-500">{admin.mobile} · {admin.email || 'No email'}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary-600">
                  Assigned Store: {admin.assignedStore?.name || 'Unassigned'}
                </p>
              </div>
              <button
                onClick={() => setEditing(admin)}
                className="rounded-xl border border-primary-100 px-4 py-2 text-sm font-semibold text-primary-700"
              >
                Edit
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${admin.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                {admin.isActive ? 'Active' : 'Inactive'}
              </span>
              {admin.isActive ? (
                <button
                  onClick={() => deactivateMutation.mutate(admin.id)}
                  className="text-sm font-semibold text-rose-600"
                >
                  Deactivate
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
