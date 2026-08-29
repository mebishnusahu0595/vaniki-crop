import { useMemo, useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Trash2, Eye, EyeOff, QrCode, Edit2, CheckCircle2, XCircle, Shield, UploadCloud, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../utils/api';
import { resolveMediaUrl } from '../utils/media';

interface StoreStaffMember {
  _id: string;
  id?: string;
  name: string;
  mobile: string;
  role: string;
  upiId?: string;
  upiQrCode?: string;
  qrCode?: string;
  canAccessInventory?: boolean;
  isActive?: boolean;
  createdAt?: string;
}

export default function StaffPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<{
    name: string;
    mobile: string;
    password: string;
    upiId: string;
    canAccessInventory: boolean;
    qrCodeImage: File | null;
    qrPreview: string | null;
  }>({
    name: '',
    mobile: '',
    password: '',
    upiId: '',
    canAccessInventory: false,
    qrCodeImage: null,
    qrPreview: null,
  });
  const [showPassword, setShowPassword] = useState(false);

  // Edit Staff State
  const [editingStaff, setEditingStaff] = useState<StoreStaffMember | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    password: string;
    upiId: string;
    canAccessInventory: boolean;
    existingQrUrl: string | null;
    editQrImage: File | null;
    editQrPreview: string | null;
  }>({
    name: '',
    password: '',
    upiId: '',
    canAccessInventory: false,
    existingQrUrl: null,
    editQrImage: null,
    editQrPreview: null,
  });
  const [showEditPassword, setShowEditPassword] = useState(false);

  // View QR Modal State
  const [selectedStaffForQr, setSelectedStaffForQr] = useState<StoreStaffMember | null>(null);
  const [qrViewMode, setQrViewMode] = useState<'custom' | 'generated'>('custom');

  const staffQuery = useQuery({
    queryKey: ['dealer-store-staff'],
    queryFn: () => adminApi.listStoreStaff(),
  });

  const createMutation = useMutation({
    mutationFn: adminApi.createStoreStaff,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dealer-store-staff'] });
      toast.success('Store staff created successfully with assigned QR code & permissions');
      setForm({
        name: '',
        mobile: '',
        password: '',
        upiId: '',
        canAccessInventory: false,
        qrCodeImage: null,
        qrPreview: null,
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to create staff');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => adminApi.updateStoreStaff(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dealer-store-staff'] });
      toast.success('Staff member updated successfully');
      setEditingStaff(null);
      if (editFileInputRef.current) editFileInputRef.current.value = '';
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update staff');
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

  const handleCreateFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image file must be less than 5MB');
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setForm((prev) => ({ ...prev, qrCodeImage: file, qrPreview: previewUrl }));
  };

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image file must be less than 5MB');
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setEditForm((prev) => ({ ...prev, editQrImage: file, editQrPreview: previewUrl }));
  };

  const handleCreate = () => {
    if (!form.name.trim()) return toast.error('Name is required');
    if (!/^[6-9]\d{9}$/.test(form.mobile)) return toast.error('Enter a valid 10-digit mobile number');
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
    createMutation.mutate({
      name: form.name.trim(),
      mobile: form.mobile,
      password: form.password,
      upiId: form.upiId.trim() || undefined,
      canAccessInventory: form.canAccessInventory,
      qrCodeImage: form.qrCodeImage || undefined,
    });
  };

  const handleOpenEdit = (staff: StoreStaffMember) => {
    setEditingStaff(staff);
    setEditForm({
      name: staff.name || '',
      password: '',
      upiId: staff.upiId || '',
      canAccessInventory: Boolean(staff.canAccessInventory),
      existingQrUrl: staff.qrCode || staff.upiQrCode || null,
      editQrImage: null,
      editQrPreview: null,
    });
  };

  const handleSaveEdit = () => {
    if (!editingStaff) return;
    const staffId = editingStaff._id || editingStaff.id;
    if (!staffId) return;

    const payload: Record<string, any> = {
      name: editForm.name.trim(),
      upiId: editForm.upiId.trim(),
      canAccessInventory: editForm.canAccessInventory,
    };
    if (editForm.password && editForm.password.length >= 6) {
      payload.password = editForm.password;
    }
    if (editForm.editQrImage) {
      payload.qrCodeImage = editForm.editQrImage;
    }
    updateMutation.mutate({ id: staffId, payload });
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Remove "${name}" from your store staff?`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleOpenQrModal = (staff: StoreStaffMember) => {
    setSelectedStaffForQr(staff);
    setQrViewMode(staff.qrCode || staff.upiQrCode ? 'custom' : 'generated');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900">Store Staff & QR Management</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage staff accounts, upload payment QR codes (Paytm, PhonePe, GPay, Bank QR), and configure inventory access permissions for the Dealers Staff App.
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
              Staff will log in to the Dealers Staff App using their mobile & password to fulfill pickups and take payments.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
              Full Name *
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Ramesh Kumar"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold outline-none focus:border-primary-500 focus:bg-white transition"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
              Mobile Number *
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
              Password *
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
          <div className="space-y-1">
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
              Assign Staff UPI ID (Optional)
            </label>
            <input
              value={form.upiId}
              onChange={(e) => setForm({ ...form, upiId: e.target.value })}
              placeholder="e.g. ramesh@upi / 9876543210@paytm"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold outline-none focus:border-primary-500 focus:bg-white transition"
            />
          </div>
        </div>

        {/* QR Code Image Upload Box */}
        <div className="mt-5 rounded-2xl border border-dashed border-primary-200 bg-primary-50/30 p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="rounded-xl bg-primary-100 p-2.5 text-primary-700">
                <QrCode size={22} />
              </div>
              <div>
                <p className="text-xs font-black text-slate-900">Upload Staff Payment QR Code Image</p>
                <p className="text-[11px] font-medium text-slate-500">
                  Upload GPay, PhonePe, Paytm or Store QR sticker image. This exact QR will be shown in the staff mobile app during payment collection.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleCreateFileChange}
                className="hidden"
                id="staff-qr-upload"
              />
              <label
                htmlFor="staff-qr-upload"
                className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-white border border-primary-200 px-4 py-2 text-xs font-black text-primary-800 shadow-sm hover:bg-primary-50 transition"
              >
                <UploadCloud size={15} />
                <span>{form.qrCodeImage ? 'Change QR Image' : 'Select QR Image'}</span>
              </label>
            </div>
          </div>

          {form.qrPreview && (
            <div className="mt-3.5 pt-3.5 border-t border-primary-100/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-xl border border-slate-200 bg-white p-1 shadow-sm overflow-hidden flex items-center justify-center">
                  <img src={form.qrPreview} alt="QR Preview" className="h-full w-full object-contain" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900">{form.qrCodeImage?.name}</p>
                  <p className="text-[10px] text-emerald-600 font-bold">QR Image Selected ({(form.qrCodeImage!.size / 1024).toFixed(1)} KB)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setForm((prev) => ({ ...prev, qrCodeImage: null, qrPreview: null }));
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 transition"
                title="Remove image"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Inventory Permission Checkbox */}
        <div className="mt-4 rounded-xl border border-primary-100 bg-primary-50/40 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary-100 p-2 text-primary-800">
              <Shield size={18} />
            </div>
            <div>
              <p className="text-xs font-black text-slate-900">📦 Inventory Access Permission</p>
              <p className="text-[11px] font-medium text-slate-500">
                Allow this staff member to view and update store product quantities in the Dealers Staff App.
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={form.canAccessInventory}
              onChange={(e) => setForm({ ...form, canAccessInventory: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>

        <button
          onClick={handleCreate}
          disabled={createMutation.isPending}
          className="mt-5 rounded-xl bg-primary-600 px-6 py-2.5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-primary-700 disabled:opacity-60 shadow-sm shadow-primary-600/20"
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
            {staffList.map((staff) => {
              const staffId = staff._id || staff.id || '';
              const hasCustomQr = Boolean(staff.qrCode || staff.upiQrCode);

              return (
                <div key={staffId} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 hover:bg-slate-50/50 transition">
                  <div className="flex items-center gap-3.5">
                    <div className="relative">
                      {hasCustomQr ? (
                        <div
                          onClick={() => handleOpenQrModal(staff)}
                          className="cursor-pointer h-12 w-12 rounded-xl border border-emerald-200 bg-white p-1 shadow-sm overflow-hidden flex items-center justify-center group"
                          title="Click to view QR"
                        >
                          <img
                            src={resolveMediaUrl(staff.qrCode || staff.upiQrCode || '')}
                            alt="Staff QR"
                            className="h-full w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 text-primary-800 font-black text-base">
                          {staff.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black text-slate-900">{staff.name}</p>
                        <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700">
                          Active
                        </span>
                        {hasCustomQr && (
                          <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-blue-700">
                            Custom QR Attached
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs font-semibold text-slate-500">📞 {staff.mobile}</p>
                        {staff.upiId && (
                          <span className="text-[11px] font-mono text-primary-700 font-bold">
                            • {staff.upiId}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Badges & Actions */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Inventory Permission Badge */}
                    <div
                      className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-black border ${
                        staff.canAccessInventory
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-slate-50 border-slate-200 text-slate-500'
                      }`}
                    >
                      {staff.canAccessInventory ? (
                        <CheckCircle2 size={13} className="text-emerald-600" />
                      ) : (
                        <XCircle size={13} className="text-slate-400" />
                      )}
                      <span>{staff.canAccessInventory ? 'Inventory: Allowed' : 'Inventory: Restricted'}</span>
                    </div>

                    {/* QR Code Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenQrModal(staff)}
                      className="flex items-center gap-1.5 rounded-xl border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-black text-primary-800 hover:bg-primary-100 transition"
                    >
                      <QrCode size={14} />
                      <span>{hasCustomQr ? 'View QR Image' : staff.upiId ? `QR: ${staff.upiId}` : 'View Staff QR'}</span>
                    </button>

                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(staff)}
                      className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 transition"
                      title="Edit staff member"
                    >
                      <Edit2 size={15} />
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => handleDelete(staffId, staff.name)}
                      disabled={deleteMutation.isPending}
                      className="rounded-xl border border-rose-100 p-2 text-rose-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60"
                      title="Remove staff"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Staff Modal */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-primary-100 bg-white p-6 shadow-2xl animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-900">Edit Staff: {editingStaff.name}</h3>
              <button
                onClick={() => setEditingStaff(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Full Name
                </label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold outline-none focus:border-primary-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  New Password (Leave empty to keep unchanged)
                </label>
                <div className="relative">
                  <input
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    type={showEditPassword ? 'text' : 'password'}
                    placeholder="Min 6 characters"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 pr-10 text-sm font-semibold outline-none focus:border-primary-500 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Assigned UPI ID (Optional)
                </label>
                <input
                  value={editForm.upiId}
                  onChange={(e) => setEditForm({ ...editForm, upiId: e.target.value })}
                  placeholder="e.g. staff@upi / 9876543210@paytm"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold outline-none focus:border-primary-500 focus:bg-white"
                />
              </div>

              {/* Edit QR Code Image Upload Box */}
              <div className="rounded-2xl border border-dashed border-primary-200 bg-primary-50/30 p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-xs font-black text-slate-900">Payment QR Code Image</p>
                  <input
                    ref={editFileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleEditFileChange}
                    className="hidden"
                    id="edit-staff-qr-upload"
                  />
                  <label
                    htmlFor="edit-staff-qr-upload"
                    className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-white border border-primary-200 px-3 py-1.5 text-xs font-bold text-primary-800 hover:bg-primary-50 transition shadow-sm"
                  >
                    <UploadCloud size={14} />
                    <span>{editForm.editQrPreview || editForm.existingQrUrl ? 'Replace QR Image' : 'Upload QR Image'}</span>
                  </label>
                </div>

                {editForm.editQrPreview ? (
                  <div className="flex items-center justify-between bg-white rounded-xl p-2.5 border border-primary-100">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-lg border border-slate-200 p-0.5 overflow-hidden flex items-center justify-center">
                        <img src={editForm.editQrPreview} alt="New QR" className="h-full w-full object-contain" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900">{editForm.editQrImage?.name}</p>
                        <p className="text-[10px] text-emerald-600 font-bold">New QR Image Ready</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditForm((prev) => ({ ...prev, editQrImage: null, editQrPreview: null }));
                        if (editFileInputRef.current) editFileInputRef.current.value = '';
                      }}
                      className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : editForm.existingQrUrl ? (
                  <div className="flex items-center gap-3 bg-white rounded-xl p-2.5 border border-primary-100">
                    <div className="h-12 w-12 rounded-lg border border-slate-200 p-0.5 overflow-hidden flex items-center justify-center">
                      <img src={resolveMediaUrl(editForm.existingQrUrl)} alt="Current QR" className="h-full w-full object-contain" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700">Current QR Code Image Active</p>
                      <p className="text-[10px] text-slate-400">Click Replace QR Image above to update</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic">No custom QR image uploaded yet.</p>
                )}
              </div>

              {/* Inventory Access Permission Toggle in Modal */}
              <div className="rounded-xl border border-primary-100 bg-primary-50/40 p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-slate-900">📦 Inventory Access Permission</p>
                  <p className="text-[10px] font-medium text-slate-500">
                    Allow this staff member to view and update store stock quantities.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.canAccessInventory}
                    onChange={(e) => setEditForm({ ...editForm, canAccessInventory: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={updateMutation.isPending}
                  className="rounded-xl bg-primary-600 px-6 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Staff QR Code Modal */}
      {selectedStaffForQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-primary-100 bg-white p-6 shadow-2xl text-center animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider">Staff Payment QR</h3>
              <button
                onClick={() => setSelectedStaffForQr(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Close
              </button>
            </div>

            {/* Mode Switcher Tabs if custom QR exists */}
            {(selectedStaffForQr.qrCode || selectedStaffForQr.upiQrCode) && (
              <div className="mb-4 flex rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setQrViewMode('custom')}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${
                    qrViewMode === 'custom'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Uploaded QR Image
                </button>
                <button
                  type="button"
                  onClick={() => setQrViewMode('generated')}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${
                    qrViewMode === 'generated'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Dynamic UPI QR
                </button>
              </div>
            )}

            <div className="mx-auto w-56 h-56 bg-white rounded-2xl border-2 border-slate-200 p-2 shadow-inner flex items-center justify-center">
              {qrViewMode === 'custom' && (selectedStaffForQr.qrCode || selectedStaffForQr.upiQrCode) ? (
                <img
                  src={resolveMediaUrl(selectedStaffForQr.qrCode || selectedStaffForQr.upiQrCode || '')}
                  alt="Uploaded Staff QR"
                  className="w-full h-full object-contain rounded-lg"
                />
              ) : (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                    `upi://pay?pa=${selectedStaffForQr.upiId || `${selectedStaffForQr.mobile}@upi`}&pn=${encodeURIComponent(
                      selectedStaffForQr.name
                    )}&cu=INR`
                  )}`}
                  alt="Generated UPI QR"
                  className="w-full h-full object-contain rounded-lg"
                />
              )}
            </div>

            <p className="mt-4 font-black text-base text-slate-900">{selectedStaffForQr.name}</p>
            <p className="text-xs font-mono font-bold text-primary-700 bg-primary-50 px-3 py-1 rounded-lg inline-block mt-1">
              {selectedStaffForQr.upiId || `${selectedStaffForQr.mobile}@upi`}
            </p>
            <p className="text-[11px] text-slate-500 font-medium mt-2">
              {qrViewMode === 'custom' && (selectedStaffForQr.qrCode || selectedStaffForQr.upiQrCode)
                ? 'This exact uploaded QR code is displayed to customers on the Dealers Staff App when collecting payments.'
                : 'Customers can scan this UPI QR code using any UPI app (GPay, PhonePe, Paytm, BHIM) upon pickup.'}
            </p>

            <button
              type="button"
              onClick={() => setSelectedStaffForQr(null)}
              className="mt-5 w-full rounded-xl bg-slate-900 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-slate-800 transition"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

