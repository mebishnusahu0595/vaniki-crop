import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../utils/api';

interface StoreStaffMember {
  _id: string;
  name: string;
  mobile: string;
  role: string;
  isActive?: boolean;
  createdAt?: string;
}

export default function StaffPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', mobile: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);

  const staffQuery = useQuery({
    queryKey: ['dealer-store-staff'],
    queryFn: () => adminApi.listStoreStaff(),
  });

  const createMutation = useMutation({
    mutationFn: adminApi.createStoreStaff,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dealer-store-staff'] });
      toast.success('Store staff created successfully');
      setForm({ name: '', mobile: '', password: '' });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to create staff');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteStoreStaff(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dealer-store-staff'] });
      toast.success('Staff member removed');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to delete staff');
    },
  });

  const staffList = useMemo(() => {
    return (staffQuery.data || []) as StoreStaffMember[];
  }, [staffQuery.data]);

  const handleCreate = () => {
    if (!form.name.trim()) return toast.error('Name is required');
    if (!/^[6-9]\d{9}$/.test(form.mobile)) return toast.error('Enter a valid 10-digit mobile number');
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
    createMutation.mutate({ name: form.name.trim(), mobile: form.mobile, password: form.password });
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Remove "${name}" from your store staff?`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900">Store Staff</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage staff accounts for the Dealers Staff App. Staff can verify pickup orders using OTP.
        </p>
      </div>

      {/* Add Staff Form */}
      <div className="rounded-2xl border border-primary-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="rounded-xl bg-primary-50 p-2.5 text-primary-700">
            <Plus size={18} />
          </div>
          <div>
            <h2 className="font-black text-slate-900">Add Staff Member</h2>
            <p className="text-xs text-slate-500">
              Staff will log in to the Dealers Staff App using their mobile & password.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
              Full Name
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Staff name"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold outline-none focus:border-primary-500 focus:bg-white transition"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
              Mobile Number
            </label>
            <input
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
              placeholder="10-digit mobile"
              inputMode="numeric"
              maxLength={10}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold outline-none focus:border-primary-500 focus:bg-white transition"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
              Password
            </label>
            <div className="relative">
              <input
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                type={showPassword ? 'text' : 'password'}
                placeholder="Min 6 characters"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 pr-10 text-sm font-semibold outline-none focus:border-primary-500 focus:bg-white transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={createMutation.isPending}
          className="mt-5 rounded-xl bg-primary-500 px-6 py-2.5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-primary-600 disabled:opacity-60"
        >
          {createMutation.isPending ? 'Creating...' : 'Create Staff Member'}
        </button>
      </div>

      {/* Staff List */}
      <div className="rounded-2xl border border-primary-100 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-primary-600" />
            <h2 className="font-black text-slate-900">Staff Members</h2>
          </div>
          <span className="text-xs font-bold text-slate-500">{staffList.length} total</span>
        </div>

        {staffQuery.isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400 font-semibold">
            Loading staff...
          </div>
        ) : staffList.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
              <Users size={22} className="text-slate-400" />
            </div>
            <p className="text-sm font-bold text-slate-500">No staff members yet</p>
            <p className="mt-1 text-xs text-slate-400">Add staff above so they can access the Dealers Staff App</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {staffList.map((staff) => (
              <div key={staff._id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50/50 transition">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-700 font-black text-sm">
                    {staff.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900">{staff.name}</p>
                    <p className="text-xs font-semibold text-slate-500">{staff.mobile}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="rounded-xl bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                    Active
                  </span>
                  <button
                    onClick={() => handleDelete(staff._id, staff.name)}
                    disabled={deleteMutation.isPending}
                    className="rounded-xl p-2 text-red-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
                    title="Remove staff"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
