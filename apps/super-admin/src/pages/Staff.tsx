import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bike, CheckCircle2, ClipboardList, PackageCheck, Plus, Search, ShieldCheck, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { LoadingBlock } from '../components/LoadingBlock';
import { PageHeader } from '../components/PageHeader';
import { adminApi } from '../utils/api';
import { cn } from '../utils/cn';
import { currencyFormatter, formatAddress, formatDateTime } from '../utils/format';
import { resolveMediaUrl } from '../utils/media';
import type { Order, StaffMember } from '../types/admin';

function getStaffId(staff: StaffMember & { _id?: string }) {
  return staff.id || staff._id || '';
}

function getOrderId(order: Order & { _id?: string }) {
  return order.id || order._id || '';
}

function orderLabel(order: Order) {
  const products = order.items.map((item) => item.productName).join(', ');
  return `${order.orderNumber} - ${order.userId?.name || order.shippingAddress?.name || 'Customer'} - ${products}`;
}

function StaffList({
  selectedStaffId,
}: {
  selectedStaffId?: string;
}) {
  const [search, setSearch] = useState('');

  const staffQuery = useQuery({
    queryKey: ['superadmin-staff', 'delivery'],
    queryFn: () => adminApi.getStaffList({ role: 'delivery' }),
  });

  const filteredStaff = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return staffQuery.data || [];
    return (staffQuery.data || []).filter((staff) => (
      staff.name.toLowerCase().includes(term)
      || staff.mobile.includes(term)
      || staff.referralCode.toLowerCase().includes(term)
    ));
  }, [search, staffQuery.data]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search staff"
          className="w-full rounded-2xl border border-primary-100 bg-white py-2 pl-10 pr-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary-500/20"
        />
      </div>

      <div className="overflow-hidden rounded-[1.5rem] border border-primary-100 bg-white">
        {staffQuery.isLoading ? (
          <LoadingBlock label="Loading staff..." />
        ) : filteredStaff.length === 0 ? (
          <div className="p-8 text-center text-sm font-semibold text-slate-400">No staff found</div>
        ) : (
          <div className="divide-y divide-primary-50">
            {filteredStaff.map((staff) => {
              const staffId = getStaffId(staff);
              const isSelected = selectedStaffId === staffId;

              return (
                <Link
                  key={staffId}
                  to={`/staff/${staffId}`}
                  className={cn(
                    'block p-4 transition hover:bg-primary-50/60',
                    isSelected && 'border-l-4 border-l-primary-500 bg-primary-50',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-900">{staff.name}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{staff.mobile} · {staff.referralCode}</p>
                    </div>
                    <span
                      className={cn(
                        'rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em]',
                        staff.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700',
                      )}
                    >
                      {staff.isActive ? 'Active' : 'Off'}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-primary-50 p-2">
                      <p className="text-sm font-black text-slate-900">{staff.activeDeliveries || 0}</p>
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Active</p>
                    </div>
                    <div className="rounded-xl bg-emerald-50 p-2">
                      <p className="text-sm font-black text-emerald-700">{staff.deliveredDeliveries || 0}</p>
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Done</p>
                    </div>
                    <div className="rounded-xl bg-red-50 p-2">
                      <p className="text-sm font-black text-red-700">{staff.cancelledDeliveries || 0}</p>
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Cancel</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function AddStaffForm() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', mobile: '', email: '', password: '' });

  const createMutation = useMutation({
    mutationFn: adminApi.createStaff,
    onSuccess: (staff) => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-staff', 'delivery'] });
      toast.success('Staff added');
      navigate(`/staff/${getStaffId(staff)}`);
      setForm({ name: '', mobile: '', email: '', password: '' });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not add staff'),
  });

  return (
    <div className="rounded-[1.5rem] border border-primary-100 bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-primary-50 p-3 text-primary-700">
          <Plus size={18} />
        </div>
        <div>
          <h2 className="font-black text-slate-900">Add Delivery Staff</h2>
          <p className="text-xs text-slate-500">Create login for the delivery app.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Name" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-2.5 text-sm" />
        <input value={form.mobile} onChange={(event) => setForm({ ...form, mobile: event.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="Mobile" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-2.5 text-sm" />
        <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Email (optional)" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-2.5 text-sm" />
        <input value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} type="password" placeholder="Password" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-2.5 text-sm" />
      </div>

      <button
        onClick={() => createMutation.mutate({ ...form, role: 'delivery' })}
        disabled={createMutation.isPending}
        className="mt-4 rounded-2xl bg-primary-500 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white disabled:opacity-60"
      >
        {createMutation.isPending ? 'Creating...' : 'Create Staff'}
      </button>
    </div>
  );
}

function DeliveryCard({ order }: { order: Order }) {
  const proofImage = order.deliveryProofImage?.url;

  return (
    <div className="rounded-[1.5rem] border border-primary-100 bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-primary-600">{order.orderNumber}</p>
          <h3 className="mt-2 text-lg font-black text-slate-900">{order.userId?.name || order.shippingAddress?.name || 'Customer'}</h3>
          <p className="mt-1 text-sm text-slate-500">{order.userId?.mobile || order.shippingAddress?.mobile || '-'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-primary-700">{order.status}</span>
          {order.deliveryOtp ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-amber-700">OTP {order.deliveryOtp}</span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <div className="space-y-3">
          {order.items.map((item, index) => (
            <div key={`${item.productId}-${index}`} className="rounded-2xl bg-primary-50/60 p-3">
              <p className="font-black text-slate-900">{item.productName}</p>
              <p className="mt-1 text-sm text-slate-500">{item.variantLabel} · {item.qty} qty · {currencyFormatter.format(item.price * item.qty)}</p>
            </div>
          ))}
          <p className="text-sm text-slate-600"><span className="font-black text-slate-900">Address:</span> {formatAddress(order.shippingAddress || order.userId?.savedAddress)}</p>
        </div>

        <div className="space-y-2 text-sm text-slate-600">
          <p><span className="font-black text-slate-900">Assigned:</span> {order.deliveryAssignedAt ? formatDateTime(order.deliveryAssignedAt) : '-'}</p>
          <p><span className="font-black text-slate-900">Delivered:</span> {order.deliveryDeliveredAt ? formatDateTime(order.deliveryDeliveredAt) : '-'}</p>
          <p><span className="font-black text-slate-900">Cancel reason:</span> {order.deliveryCancelReason || '-'}</p>
          <p><span className="font-black text-slate-900">Proof note:</span> {order.deliveryProofDescription || '-'}</p>
          {proofImage ? (
            <img src={resolveMediaUrl(proofImage)} alt="Delivery proof" className="mt-3 h-32 w-full rounded-2xl border border-primary-100 object-cover" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StaffDetailView({ staffId }: { staffId: string }) {
  const queryClient = useQueryClient();
  const [orderId, setOrderId] = useState('');
  const [deliveryOtp, setDeliveryOtp] = useState('');
  const [note, setNote] = useState('');

  const detailQuery = useQuery({
    queryKey: ['superadmin-staff-detail', staffId],
    queryFn: () => adminApi.getStaffDetail(staffId),
    enabled: Boolean(staffId),
  });

  const availableOrdersQuery = useQuery({
    queryKey: ['superadmin-available-delivery-orders'],
    queryFn: adminApi.availableDeliveryOrders,
    enabled: Boolean(staffId),
  });

  const toggleMutation = useMutation({
    mutationFn: (payload: { id: string; isActive: boolean }) => adminApi.updateStaffStatus(payload.id, payload.isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-staff', 'delivery'] });
      queryClient.invalidateQueries({ queryKey: ['superadmin-staff-detail', staffId] });
      toast.success('Staff status updated');
    },
  });

  const assignMutation = useMutation({
    mutationFn: () => adminApi.assignOrderToStaff(staffId, { orderId, deliveryOtp, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-staff'] });
      queryClient.invalidateQueries({ queryKey: ['superadmin-staff-detail', staffId] });
      queryClient.invalidateQueries({ queryKey: ['superadmin-available-delivery-orders'] });
      toast.success('Delivery assigned');
      setOrderId('');
      setDeliveryOtp('');
      setNote('');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not assign delivery'),
  });

  if (detailQuery.isLoading) return <LoadingBlock label="Loading staff profile..." />;

  const detail = detailQuery.data;
  if (!detail) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-primary-200 bg-primary-50/40 p-10 text-center text-slate-500">
        Select staff to see delivery details.
      </div>
    );
  }

  const staff = detail.staff;
  const activeDeliveries = detail.deliveries.filter((order) => !['delivered', 'cancelled'].includes(order.status)).length;

  return (
    <div className="space-y-4">
      <div className="rounded-[1.5rem] border border-primary-100 bg-slate-950 p-4 text-white">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-white/10 p-3">
              <Bike size={26} />
            </div>
            <div>
              <h2 className="text-2xl font-black">{staff.name}</h2>
              <p className="mt-1 text-sm font-semibold text-white/60">{staff.mobile} · {staff.email || 'No email'} · Code {staff.referralCode}</p>
            </div>
          </div>
          <button
            onClick={() => toggleMutation.mutate({ id: staffId, isActive: !staff.isActive })}
            className={cn(
              'inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-[0.16em]',
              staff.isActive ? 'bg-emerald-500/20 text-emerald-200' : 'bg-red-500/20 text-red-200',
            )}
          >
            {staff.isActive ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            {staff.isActive ? 'Active' : 'Inactive'}
          </button>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-2xl font-black">{activeDeliveries}</p>
            <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-white/50">Active Deliveries</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-2xl font-black">{detail.deliveries.filter((order) => order.status === 'delivered').length}</p>
            <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-white/50">Delivered</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-2xl font-black">{detail.deliveries.filter((order) => order.status === 'cancelled').length}</p>
            <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-white/50">Cancelled</p>
          </div>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-primary-100 bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-primary-50 p-3 text-primary-700">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h2 className="font-black text-slate-900">Assign Delivery + OTP</h2>
            <p className="text-sm text-slate-500">OTP is visible on the customer order detail and required in the delivery app.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 lg:grid-cols-[1.4fr_0.5fr_1fr_auto]">
          <select value={orderId} onChange={(event) => setOrderId(event.target.value)} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-2.5 text-sm">
            <option value="">Choose order</option>
            {(availableOrdersQuery.data || []).map((order: Order) => (
              <option key={getOrderId(order)} value={getOrderId(order)}>{orderLabel(order)}</option>
            ))}
          </select>
          <input value={deliveryOtp} onChange={(event) => setDeliveryOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="OTP" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-2.5 text-sm" />
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Note" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-2.5 text-sm" />
          <button
            onClick={() => assignMutation.mutate()}
            disabled={!orderId || assignMutation.isPending}
            className="rounded-2xl bg-primary-500 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white disabled:opacity-60"
          >
            Assign
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ClipboardList size={18} className="text-primary-700" />
          <h2 className="text-lg font-black text-slate-900">Delivery History</h2>
        </div>
        {detail.deliveries.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-primary-200 bg-primary-50/40 p-10 text-center text-sm font-semibold text-slate-400">
            No delivery assigned yet.
          </div>
        ) : (
          detail.deliveries.map((order) => <DeliveryCard key={getOrderId(order)} order={order} />)
        )}
      </div>
    </div>
  );
}

export default function StaffPage() {
  const { id } = useParams();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Staff"
        subtitle="Manage delivery staff, assignments, and performance monitoring."
        action={
          <Link to="/orders" className="inline-flex items-center gap-2 rounded-2xl border border-primary-100 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-primary-700">
            <PackageCheck size={16} />
            Orders
          </Link>
        }
      />

      <AddStaffForm />

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <StaffList selectedStaffId={id} />
        {id ? <StaffDetailView staffId={id} /> : (
          <div className="rounded-[1.5rem] border border-dashed border-primary-200 bg-primary-50/40 p-10 text-center text-slate-500">
            Select a staff member to open delivery details.
          </div>
        )}
      </div>
    </div>
  );
}
