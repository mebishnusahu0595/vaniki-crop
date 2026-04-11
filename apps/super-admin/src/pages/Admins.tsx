import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { LocateFixed } from 'lucide-react';
import { z } from 'zod';
import { LoadingBlock } from '../components/LoadingBlock';
import { PageHeader } from '../components/PageHeader';
import type { AdminAccount } from '../types/admin';
import { adminApi } from '../utils/api';

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const adminSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  email: z.string().trim().email('Enter a valid email').or(z.literal('')),
  mobile: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  storeName: z.string().trim().min(2, 'Store name is required'),
  storeLocation: z.string().trim().min(3, 'Store location is required'),
  longitude: z.coerce.number().min(-180, 'Longitude must be between -180 and 180').max(180, 'Longitude must be between -180 and 180'),
  latitude: z.coerce.number().min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90'),
  gstNumber: z.string().trim().toUpperCase().regex(GSTIN_PATTERN, 'Enter valid GSTIN (example: 27ABCDE1234F1Z4)'),
  sgstNumber: z.string().trim().toUpperCase().regex(GSTIN_PATTERN, 'Enter valid SGSTIN (example: 27ABCDE1234F1Z3)'),
  password: z.string().trim().min(6, 'Password must be at least 6 characters').or(z.literal('')),
  approvalStatus: z.enum(['pending', 'approved', 'rejected']),
}).refine((values) => values.gstNumber.slice(0, 2) === values.sgstNumber.slice(0, 2), {
  path: ['sgstNumber'],
  message: 'SGST state code must match GST state code',
});

type AdminFormInput = z.input<typeof adminSchema>;
type AdminFormOutput = z.output<typeof adminSchema>;

const adminDefaultValues: AdminFormInput = {
  name: '',
  email: '',
  mobile: '',
  storeName: '',
  storeLocation: '',
  longitude: 0,
  latitude: 0,
  gstNumber: '',
  sgstNumber: '',
  password: '',
  approvalStatus: 'approved',
};

export default function AdminsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<AdminAccount | null>(null);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminAccount | null>(null);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState('');
  const [search, setSearch] = useState('');
  const [approvalStatus, setApprovalStatus] = useState('');

  const adminsQuery = useQuery({
    queryKey: ['super-admin-admins', search, approvalStatus],
    queryFn: () =>
      adminApi.admins({
        search,
        approvalStatus: approvalStatus || undefined,
        limit: 100,
      }),
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { isSubmitting },
  } = useForm<AdminFormInput, undefined, AdminFormOutput>({
    resolver: zodResolver(adminSchema),
    defaultValues: adminDefaultValues,
  });

  useEffect(() => {
    return () => {
      if (selectedImagePreview) {
        URL.revokeObjectURL(selectedImagePreview);
      }
    };
  }, [selectedImagePreview]);

  const handleImageSelection = (file: File | null) => {
    if (selectedImagePreview) {
      URL.revokeObjectURL(selectedImagePreview);
    }

    setSelectedImageFile(file);
    setSelectedImagePreview(file ? URL.createObjectURL(file) : '');
  };

  useEffect(() => {
    if (!editing) {
      reset(adminDefaultValues);
      setFormError('');
      setFormSuccess('');
      handleImageSelection(null);
      return;
    }

    reset({
      name: editing.name,
      email: editing.email || '',
      mobile: editing.mobile,
      storeName: editing.storeName || editing.assignedStore?.name || '',
      storeLocation: editing.storeLocation || '',
      longitude: editing.longitude ?? 0,
      latitude: editing.latitude ?? 0,
      gstNumber: editing.gstNumber || '',
      sgstNumber: editing.sgstNumber || '',
      password: '',
      approvalStatus: editing.approvalStatus || 'approved',
    });

    setFormError('');
    setFormSuccess('');
    handleImageSelection(null);
  }, [editing, reset]);

  const upsertMutation = useMutation({
    mutationFn: async (values: AdminFormOutput) => {
      if (editing) {
        const payload = new FormData();
        payload.append('name', values.name);
        payload.append('email', values.email);
        payload.append('mobile', values.mobile);
        payload.append('storeName', values.storeName);
        payload.append('storeLocation', values.storeLocation);
        payload.append('longitude', String(values.longitude));
        payload.append('latitude', String(values.latitude));
        payload.append('gstNumber', values.gstNumber);
        payload.append('sgstNumber', values.sgstNumber);
        payload.append('approvalStatus', values.approvalStatus);

        if (values.password && values.password.trim()) {
          payload.append('password', values.password);
        }

        if (selectedImageFile) {
          payload.append('profileImage', selectedImageFile);
        }

        return adminApi.updateAdmin(editing.id, payload);
      }

      if (!values.password || !values.password.trim()) {
        throw new Error('Password is required for new admin accounts');
      }

      if (!selectedImageFile) {
        throw new Error('Dealer photo is required for new admin accounts');
      }

      const payload = new FormData();
      payload.append('name', values.name);
      payload.append('email', values.email);
      payload.append('mobile', values.mobile);
      payload.append('storeName', values.storeName);
      payload.append('storeLocation', values.storeLocation);
      payload.append('longitude', String(values.longitude));
      payload.append('latitude', String(values.latitude));
      payload.append('gstNumber', values.gstNumber);
      payload.append('sgstNumber', values.sgstNumber);
      payload.append('password', values.password);
      payload.append('profileImage', selectedImageFile);

      return adminApi.createAdmin(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-admins'] });
      setEditing(null);
      reset(adminDefaultValues);
      setFormError('');
      setFormSuccess(editing ? 'Admin updated successfully.' : 'Admin created successfully.');
      handleImageSelection(null);
    },
    onError: (error) => {
      setFormSuccess('');
      setFormError(error instanceof Error ? error.message : 'Unable to save admin details.');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => adminApi.deactivateAdmin(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-admins'] });
      setFormError('');
      setFormSuccess('Admin deactivated successfully.');
      setSelectedAdmin(null);
    },
    onError: (error) => {
      setFormSuccess('');
      setFormError(error instanceof Error ? error.message : 'Unable to deactivate admin.');
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, nextStatus }: { id: string; nextStatus: 'approved' | 'rejected' }) =>
      adminApi.approveAdmin(id, nextStatus),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-admins'] });
      setFormError('');
      setFormSuccess(variables.nextStatus === 'approved' ? 'Admin approved successfully.' : 'Admin rejected successfully.');
      setSelectedAdmin(null);
    },
    onError: (error) => {
      setFormSuccess('');
      setFormError(error instanceof Error ? error.message : 'Unable to update approval status.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteAdmin(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-admins'] });
      setFormError('');
      setFormSuccess('Admin deleted successfully.');
      setSelectedAdmin(null);
    },
    onError: (error) => {
      setFormSuccess('');
      setFormError(error instanceof Error ? error.message : 'Unable to delete admin.');
    },
  });

  if (adminsQuery.isLoading) return <LoadingBlock label="Loading admins..." />;

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-[1.75rem] border border-primary-100 bg-white p-5">
        <PageHeader
          title="All Admins"
          subtitle="Create, edit, approve/reject, deactivate, and delete store-admin accounts."
        />

        <form onSubmit={handleSubmit((values) => upsertMutation.mutate(values))} className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Name</label>
            <input
              {...register('name')}
              placeholder="Dealer name"
              className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Mobile Number</label>
              <input
                {...register('mobile')}
                inputMode="numeric"
                maxLength={10}
                onInput={(event) => {
                  event.currentTarget.value = event.currentTarget.value.replace(/\D/g, '').slice(0, 10);
                }}
                placeholder="9876543210"
                className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Email</label>
              <input
                {...register('email')}
                placeholder="dealer@example.com"
                className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Store Name</label>
              <input
                {...register('storeName')}
                placeholder="My Agro Store"
                className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Store Location</label>
              <input
                {...register('storeLocation')}
                placeholder="Area / Landmark / Address"
                className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Longitude</label>
              <input
                type="number"
                step="0.000001"
                {...register('longitude')}
                placeholder="77.4065"
                className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Latitude</label>
              <input
                type="number"
                step="0.000001"
                {...register('latitude')}
                placeholder="23.2505"
                className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!navigator.geolocation) {
                setFormError('Geolocation is not supported on this device/browser.');
                return;
              }

              navigator.geolocation.getCurrentPosition(
                (position) => {
                  const longitude = Number(position.coords.longitude.toFixed(6));
                  const latitude = Number(position.coords.latitude.toFixed(6));
                  setValue('longitude', longitude, { shouldValidate: true });
                  setValue('latitude', latitude, { shouldValidate: true });

                  const currentStoreLocation = getValues('storeLocation');
                  if (!currentStoreLocation) {
                    setValue('storeLocation', `Detected at ${latitude}, ${longitude}`, { shouldValidate: true });
                  }

                  setFormError('');
                },
                () => {
                  setFormError('Unable to detect location. Please allow location access.');
                },
                { enableHighAccuracy: true, timeout: 10000 },
              );
            }}
            className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-primary-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.15em] text-primary-700"
          >
            <LocateFixed size={14} />
            Detect Location
          </button>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">GST No.</label>
              <input
                {...register('gstNumber')}
                maxLength={15}
                autoCapitalize="characters"
                onInput={(event) => {
                  event.currentTarget.value = event.currentTarget.value.toUpperCase();
                }}
                placeholder="27ABCDE1234F1Z4"
                className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 uppercase"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">SGST No.</label>
              <input
                {...register('sgstNumber')}
                maxLength={15}
                autoCapitalize="characters"
                onInput={(event) => {
                  event.currentTarget.value = event.currentTarget.value.toUpperCase();
                }}
                placeholder="27ABCDE1234F1Z3"
                className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 uppercase"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Dealer Photo</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => handleImageSelection(event.target.files?.[0] || null)}
              className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm"
            />
            {selectedImagePreview ? (
              <img src={selectedImagePreview} alt="Dealer preview" className="mt-3 h-20 w-20 rounded-2xl object-cover" />
            ) : editing?.profileImage?.url ? (
              <img src={editing.profileImage.url} alt={editing.name} className="mt-3 h-20 w-20 rounded-2xl object-cover" />
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Password</label>
              <input
                type="password"
                {...register('password')}
                placeholder={editing ? 'Set new password (optional)' : 'Create password'}
                className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Approval Status</label>
              <select
                {...register('approvalStatus')}
                className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          {formError ? (
            <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">{formError}</p>
          ) : null}

          {formSuccess ? (
            <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{formSuccess}</p>
          ) : null}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="cursor-pointer rounded-2xl bg-primary-500 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white disabled:cursor-not-allowed disabled:bg-primary-200"
            >
              {editing ? 'Update Admin' : 'Create Admin'}
            </button>
            {editing ? (
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  reset(adminDefaultValues);
                  handleImageSelection(null);
                  setFormError('');
                }}
                className="cursor-pointer rounded-2xl border border-primary-100 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-600"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="space-y-4">
        <div className="rounded-[1.5rem] border border-primary-100 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search admins by name, mobile, email"
              className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
            />
            <select
              value={approvalStatus}
              onChange={(event) => setApprovalStatus(event.target.value)}
              className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
            >
              <option value="">All approvals</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {adminsQuery.data?.data.map((admin) => (
          <div
            key={admin.id}
            onClick={() => setSelectedAdmin(admin)}
            className="cursor-pointer rounded-[1.5rem] border border-primary-100 bg-white p-4 transition hover:bg-primary-50/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-black text-slate-900">{admin.name}</p>
                <p className="mt-1 text-sm text-slate-500">{admin.mobile} · {admin.email || 'No email'}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary-600">
                  Assigned Store: {admin.assignedStore?.name || 'Unassigned'}
                </p>
              </div>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  setEditing(admin);
                }}
                className="cursor-pointer rounded-xl border border-primary-100 px-4 py-2 text-sm font-semibold text-primary-700"
              >
                Edit
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${admin.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  {admin.isActive ? 'Active' : 'Inactive'}
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${
                  admin.approvalStatus === 'approved'
                    ? 'bg-emerald-100 text-emerald-700'
                    : admin.approvalStatus === 'rejected'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {admin.approvalStatus}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {admin.approvalStatus !== 'approved' ? (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      approveMutation.mutate({ id: admin.id, nextStatus: 'approved' });
                    }}
                    className="cursor-pointer text-sm font-semibold text-emerald-600"
                  >
                    Approve
                  </button>
                ) : null}

                {admin.approvalStatus !== 'rejected' ? (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      approveMutation.mutate({ id: admin.id, nextStatus: 'rejected' });
                    }}
                    className="cursor-pointer text-sm font-semibold text-rose-600"
                  >
                    Reject
                  </button>
                ) : null}

                {admin.isActive ? (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      deactivateMutation.mutate(admin.id);
                    }}
                    className="cursor-pointer text-sm font-semibold text-rose-600"
                  >
                    Deactivate
                  </button>
                ) : null}

                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!window.confirm(`Delete admin ${admin.name}?`)) return;
                    deleteMutation.mutate(admin.id);
                  }}
                  className="cursor-pointer text-sm font-semibold text-rose-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}

        {adminsQuery.data?.data.length === 0 ? (
          <div className="rounded-[1.5rem] border border-primary-100 bg-white p-6 text-sm font-semibold text-slate-500">
            No admins found for selected filter.
          </div>
        ) : null}
      </div>

      {selectedAdmin ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <div className="w-full max-w-2xl rounded-[2rem] border border-primary-100 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-500">Admin Detail</p>
                <h2 className="mt-2 text-2xl font-black text-slate-900">{selectedAdmin.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAdmin(null)}
                className="cursor-pointer rounded-2xl border border-primary-100 px-4 py-2 text-sm font-semibold text-slate-600"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-3 rounded-[1.5rem] border border-primary-100 bg-primary-50/40 p-4 text-sm text-slate-600">
              {selectedAdmin.profileImage?.url ? (
                <img
                  src={selectedAdmin.profileImage.url}
                  alt={selectedAdmin.name}
                  className="h-20 w-20 rounded-2xl object-cover"
                />
              ) : null}
              <p><span className="font-black text-slate-900">Admin ID:</span> {selectedAdmin.id}</p>
              <p><span className="font-black text-slate-900">Role:</span> {selectedAdmin.role}</p>
              <p><span className="font-black text-slate-900">Status:</span> {selectedAdmin.isActive ? 'Active' : 'Inactive'}</p>
              <p><span className="font-black text-slate-900">Approval:</span> {selectedAdmin.approvalStatus}</p>
              <p><span className="font-black text-slate-900">Mobile:</span> {selectedAdmin.mobile}</p>
              <p><span className="font-black text-slate-900">Email:</span> {selectedAdmin.email || '-'}</p>
              <p><span className="font-black text-slate-900">Assigned Store:</span> {selectedAdmin.assignedStore?.name || 'Unassigned'}</p>
              <p><span className="font-black text-slate-900">Store Name:</span> {selectedAdmin.storeName || '-'}</p>
              <p><span className="font-black text-slate-900">Store Location:</span> {selectedAdmin.storeLocation || '-'}</p>
              <p><span className="font-black text-slate-900">Longitude:</span> {selectedAdmin.longitude ?? '-'}</p>
              <p><span className="font-black text-slate-900">Latitude:</span> {selectedAdmin.latitude ?? '-'}</p>
              <p><span className="font-black text-slate-900">GST No.:</span> {selectedAdmin.gstNumber || '-'}</p>
              <p><span className="font-black text-slate-900">SGST No.:</span> {selectedAdmin.sgstNumber || '-'}</p>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {selectedAdmin.approvalStatus !== 'approved' ? (
                <button
                  type="button"
                  onClick={() => {
                    approveMutation.mutate({ id: selectedAdmin.id, nextStatus: 'approved' });
                  }}
                  className="cursor-pointer rounded-2xl border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700"
                >
                  Approve Dealer
                </button>
              ) : null}

              {selectedAdmin.approvalStatus !== 'rejected' ? (
                <button
                  type="button"
                  onClick={() => {
                    approveMutation.mutate({ id: selectedAdmin.id, nextStatus: 'rejected' });
                  }}
                  className="cursor-pointer rounded-2xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700"
                >
                  Reject Dealer
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  setEditing(selectedAdmin);
                  setSelectedAdmin(null);
                }}
                className="cursor-pointer rounded-2xl border border-primary-100 px-4 py-2 text-sm font-semibold text-primary-700"
              >
                Edit This Admin
              </button>
              {selectedAdmin.isActive ? (
                <button
                  type="button"
                  onClick={() => {
                    deactivateMutation.mutate(selectedAdmin.id);
                  }}
                  className="cursor-pointer rounded-2xl border border-rose-100 px-4 py-2 text-sm font-semibold text-rose-600"
                >
                  Deactivate
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  if (!window.confirm(`Delete admin ${selectedAdmin.name}?`)) return;
                  deleteMutation.mutate(selectedAdmin.id);
                }}
                className="cursor-pointer rounded-2xl border border-rose-100 px-4 py-2 text-sm font-semibold text-rose-700"
              >
                Delete Admin
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
