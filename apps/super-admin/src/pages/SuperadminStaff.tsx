import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, Plus, Search, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { LoadingBlock } from '../components/LoadingBlock';
import { PageHeader } from '../components/PageHeader';
import { adminApi } from '../utils/api';
import { cn } from '../utils/cn';

interface SuperAdminStaffMember {
  id: string;
  _id?: string;
  name: string;
  mobile: string;
  email?: string;
  isActive: boolean;
  role: string;
}

export default function SuperadminStaffPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', mobile: '', email: '', password: '' });

  // Query list of superadmin staff
  const staffQuery = useQuery({
    queryKey: ['superadmin-app-staff'],
    queryFn: () => adminApi.getSuperAdminStaffList(),
  });

  // Create superadmin staff mutation
  const createMutation = useMutation({
    mutationFn: adminApi.createSuperAdminStaff,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-app-staff'] });
      toast.success('Superadmin App Staff created');
      setForm({ name: '', mobile: '', email: '', password: '' });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Could not create staff');
    },
  });

  // Toggle active status mutation
  const toggleMutation = useMutation({
    mutationFn: (payload: { id: string; isActive: boolean }) =>
      adminApi.updateSuperAdminStaff(payload.id, { isActive: payload.isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-app-staff'] });
      toast.success('Status updated');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Could not update status');
    },
  });

  // Delete staff mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteSuperAdminStaff(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-app-staff'] });
      toast.success('Staff member deleted');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Could not delete staff');
    },
  });

  // Filter list
  const filteredStaff = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = (staffQuery.data?.data || []) as SuperAdminStaffMember[];
    if (!term) return list;
    return list.filter(
      (staff) =>
        staff.name.toLowerCase().includes(term) ||
        staff.mobile.includes(term) ||
        (staff.email && staff.email.toLowerCase().includes(term)),
    );
  }, [search, staffQuery.data]);

  const handleCreate = () => {
    if (!form.name || !form.mobile || !form.password) {
      toast.error('Name, mobile and password are required');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(form.mobile)) {
      toast.error('Enter a valid 10-digit mobile number');
      return;
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    createMutation.mutate({
      name: form.name,
      mobile: form.mobile,
      email: form.email || undefined,
      password: form.password,
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete superadmin staff "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Superadmin App Staff"
        subtitle="Manage administrative staff logins for the Superadmin Monitoring Mobile App."
      />

      {/* Add Staff Form */}
      <div className="rounded-[1.5rem] border border-primary-100 bg-white p-6 shadow-[0_4px_20px_rgba(45,106,79,0.04)]">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-primary-50 p-3 text-primary-700">
            <Plus size={18} />
          </div>
          <div>
            <h2 className="font-black text-slate-900">Add Superadmin App Staff</h2>
            <p className="text-xs text-slate-500">Create access for monitoring and receiving Firebase notification chimes.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Staff Name"
              className="w-full rounded-2xl border border-primary-100 bg-primary-50/60 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:bg-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Mobile</label>
            <input
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
              placeholder="Mobile Number"
              inputMode="numeric"
              maxLength={10}
              className="w-full rounded-2xl border border-primary-100 bg-primary-50/60 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:bg-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Email (Optional)</label>
            <input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Email address"
              className="w-full rounded-2xl border border-primary-100 bg-primary-50/60 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:bg-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Password</label>
            <input
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              type="password"
              placeholder="Min 6 characters"
              className="w-full rounded-2xl border border-primary-100 bg-primary-50/60 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:bg-white"
            />
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={createMutation.isPending}
          className="mt-5 rounded-2xl bg-primary-500 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-primary-600 disabled:opacity-60"
        >
          {createMutation.isPending ? 'Creating...' : 'Create Superadmin Staff'}
        </button>
      </div>

      {/* Staff List */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search superadmin staff..."
              className="w-full rounded-2xl border border-primary-100 bg-white py-2.5 pl-10 pr-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-slate-500">Total: {filteredStaff.length} Members</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-[1.5rem] border border-primary-100 bg-white shadow-[0_4px_20px_rgba(45,106,79,0.04)]">
          {staffQuery.isLoading ? (
            <LoadingBlock label="Loading superadmin staff..." />
          ) : filteredStaff.length === 0 ? (
            <div className="p-10 text-center text-sm font-semibold text-slate-400">No superadmin app staff members found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-primary-50 bg-primary-50/20 text-slate-400">
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider">Mobile</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider">Email</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary-50">
                  {filteredStaff.map((staff) => {
                    const id = staff.id || staff._id || '';
                    return (
                      <tr key={id} className="hover:bg-primary-50/20">
                        <td className="px-6 py-4 font-bold text-slate-900 flex items-center gap-2">
                          <div className="rounded-lg bg-primary-50 p-1.5 text-primary-600">
                            <ShieldAlert size={14} />
                          </div>
                          {staff.name}
                        </td>
                        <td className="px-6 py-4 text-slate-600 font-bold">{staff.mobile}</td>
                        <td className="px-6 py-4 text-slate-500 font-semibold">{staff.email || '-'}</td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => toggleMutation.mutate({ id, isActive: !staff.isActive })}
                            disabled={toggleMutation.isPending}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition disabled:opacity-60',
                              staff.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700',
                            )}
                          >
                            {staff.isActive ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                            {staff.isActive ? 'Active' : 'Deactivated'}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleDelete(id, staff.name)}
                            disabled={deleteMutation.isPending}
                            className="rounded-xl p-2 text-red-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
                            title="Delete Staff"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
