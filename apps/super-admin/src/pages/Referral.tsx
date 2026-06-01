import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Users, 
  UserPlus, 
  Search, 
  Download, 
  Trash2, 
  CheckCircle, 
  XCircle,
  Copy,
  ChevronRight,
  UserCheck,
  Package,
  Award,
  Wallet,
  Eye,
  EyeOff
} from 'lucide-react';
import { adminApi } from '../utils/api';
import { cn } from '../utils/cn';
import { LoadingBlock } from '../components/LoadingBlock';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';

// ─── Interfaces ──────────────────────────────────────────────────────────

interface Staff {
  _id?: string;
  id?: string;
  name: string;
  mobile: string;
  referralCode: string;
  role?: 'delivery' | 'referral';
  referralCount: number;
  isActive: boolean;
}

interface OrderItem {
  productName: string;
  variantLabel: string;
  qty: number;
  price: number;
}

interface Order {
  orderNumber: string;
  totalAmount: number;
  createdAt: string;
  status: string;
  items: OrderItem[];
}

interface ReferralUser {
  _id: string;
  name: string;
  mobile: string;
  email?: string;
  createdAt: string;
  savedAddress?: {
    city?: string;
    state?: string;
  };
  orders?: Order[];
}

interface UserReferrer {
  id: string;
  name: string;
  mobile: string;
  referralCode: string;
  referralCount: number;
  loyaltyPoints: number;
  isActive: boolean;
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function getStaffId(staff: Staff) {
  return staff.id || staff._id || '';
}

const exportToExcel = (data: any[], filename: string) => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

// ─── Sub-Components ──────────────────────────────────────────────────────

function StaffReferrals() {
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    email: '',
    password: ''
  });

  const staffQuery = useQuery<Staff[]>({
    queryKey: ['superadmin-staff', 'referral'],
    queryFn: async () => {
      const res = await adminApi.getStaffList({ role: 'referral' });
      return res as unknown as Staff[];
    }
  });

  const referralsQuery = useQuery<ReferralUser[]>({
    queryKey: ['superadmin-staff-referrals', selectedStaffId],
    queryFn: async () => {
      const res = await adminApi.getStaffReferrals(selectedStaffId!);
      return res as ReferralUser[];
    },
    enabled: !!selectedStaffId
  });

  const createStaffMutation = useMutation({
    mutationFn: (payload: { name: string; mobile: string; email?: string; password: string }) =>
      adminApi.createStaff({ ...payload, role: 'referral' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-staff', 'referral'] });
      toast.success('Staff added successfully');
      setIsAddModalOpen(false);
      setFormData({ name: '', mobile: '', email: '', password: '' });
      setShowPassword(false);
    },
    onError: (error: any) => {
      console.error('Error creating staff:', error);
      const errMsg = error.response?.data?.error || error.message || 'Failed to create staff';
      toast.error(errMsg);
    }
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (params: { id: string; isActive: boolean }) => 
      adminApi.updateStaffStatus(params.id, params.isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-staff', 'referral'] });
      toast.success('Status updated');
    }
  });

  const deleteStaffMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteStaff(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-staff', 'referral'] });
      toast.success('Staff removed');
    }
  });

  const filteredStaff = staffQuery.data?.filter((s) => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.mobile.includes(searchTerm) ||
    s.referralCode.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (staffQuery.isLoading) return <LoadingBlock label="Loading staff data..." />;

  return (
    <div className="grid gap-6 lg:grid-cols-3 animate-in fade-in duration-500">
      {/* Staff List */}
      <div className="lg:col-span-1 space-y-4">
        <div className="flex items-center justify-between">
          <div className="relative flex-1 mr-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search staff..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500 text-white shadow-lg shadow-primary-500/20 hover:bg-primary-600"
            title="Add Staff"
          >
            <UserPlus size={18} />
          </button>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-50">
            {filteredStaff.map((staff: Staff) => {
              const staffId = getStaffId(staff);
              return (
              <button
                key={staffId}
                onClick={() => setSelectedStaffId(staffId)}
                className={cn(
                  "w-full flex items-center justify-between p-4 text-left transition hover:bg-slate-50",
                  selectedStaffId === staffId && "bg-primary-50/50 border-l-4 border-l-primary-500"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                    <Users size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{staff.name}</p>
                    <p className="text-xs font-medium text-slate-500">{staff.mobile} | <span className="font-black text-primary-600">{staff.referralCode}</span></p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-primary-600">{staff.referralCount}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Referrals</p>
                </div>
              </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Details Area */}
      <div className="lg:col-span-2 space-y-4">
        {selectedStaffId ? (
          <div className="space-y-4">
            {/* Staff Stats Card */}
            {(() => {
              const staff = staffQuery.data?.find(s => getStaffId(s) === selectedStaffId);
              if (!staff) return null;
              const staffId = getStaffId(staff);
              return (
                <div className="rounded-2xl bg-slate-900 p-4 text-white shadow-xl">
                  <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white">
                        <UserCheck size={28} />
                      </div>
                      <div>
                        <h2 className="text-xl font-black">{staff.name}</h2>
                        <div className="mt-1 flex items-center gap-2 text-slate-400">
                          <span className="text-sm font-bold uppercase tracking-widest text-primary-400">Code: {staff.referralCode}</span>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(staff.referralCode);
                              toast.success('Code copied');
                            }}
                            className="rounded-lg p-1 hover:bg-white/10"
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleStatusMutation.mutate({ id: staffId, isActive: !staff.isActive })}
                        className={cn(
                          "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold",
                          staff.isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                        )}
                      >
                        {staff.isActive ? <CheckCircle size={16} /> : <XCircle size={16} />}
                        {staff.isActive ? 'Active' : 'Inactive'}
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm('Remove this staff?')) deleteStaffMutation.mutate(staffId);
                        }}
                        className="rounded-xl bg-white/5 p-2 text-white/40 hover:bg-rose-500/20 hover:text-rose-400"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Referral List */}
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-lg font-black text-slate-900">Referred Users & Purchases</h3>
                <button 
                  onClick={() => exportToExcel(referralsQuery.data || [], `staff_referrals_${selectedStaffId}`)}
                  className="flex items-center gap-2 text-sm font-bold text-primary-600 hover:underline"
                >
                  <Download size={16} />
                  Export Report
                </button>
              </div>

              {referralsQuery.isLoading ? (
                <div className="py-12 text-center text-slate-400">Loading details...</div>
              ) : (referralsQuery.data?.length || 0) === 0 ? (
                <div className="py-12 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-300">
                    <Users size={32} />
                  </div>
                  <p className="mt-4 font-bold text-slate-500">No users referred yet</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {referralsQuery.data?.map((user: ReferralUser) => (
                    <div key={user._id} className="rounded-2xl border border-slate-100 bg-slate-50/30 p-4 transition hover:bg-slate-50">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-primary-600 shadow-sm">
                            <Users size={18} />
                          </div>
                          <div>
                            <p className="font-black text-slate-900">{user.name}</p>
                            <p className="text-xs font-bold text-slate-500">{user.mobile} | Joined {new Date(user.createdAt).toLocaleDateString('en-IN')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <div className="rounded-lg bg-primary-100 px-3 py-1 text-xs font-black text-primary-700">
                             {(user.orders?.length || 0)} Orders
                           </div>
                           <div className="rounded-lg bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
                             ₹{(user.orders?.reduce((sum, o) => sum + o.totalAmount, 0) || 0).toLocaleString()} Spent
                           </div>
                        </div>
                      </div>

                      {/* Order Items */}
                      {user.orders && user.orders.length > 0 && (
                        <div className="mt-4 space-y-3 pl-2 sm:pl-10">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Purchase History</p>
                          {user.orders.map((order) => (
                            <div key={order.orderNumber} className="rounded-xl bg-white p-3 shadow-sm">
                              <div className="flex items-center justify-between border-b border-slate-50 pb-2 mb-2">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-black text-slate-700">{order.orderNumber}</p>
                                  <span className={cn(
                                    "rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider",
                                    order.status === 'delivered' ? "bg-emerald-100 text-emerald-700" :
                                    order.status === 'cancelled' ? "bg-rose-100 text-rose-700" :
                                    "bg-amber-100 text-amber-700"
                                  )}>
                                    {order.status}
                                  </span>
                                </div>
                                <p className="text-[10px] font-bold text-slate-400">{new Date(order.createdAt).toLocaleDateString('en-IN')}</p>
                              </div>
                              <div className="space-y-1">
                                {order.items.map((item, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                      <Package size={12} className="text-slate-400" />
                                      <p className="font-bold text-slate-600">{item.productName} ({item.variantLabel})</p>
                                    </div>
                                    <p className="font-black text-slate-900">x{item.qty}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-20">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-slate-300 shadow-sm">
              <ChevronRight size={40} />
            </div>
            <p className="mt-6 text-lg font-black text-slate-400">Select staff to see performance</p>
          </div>
        )}
      </div>

      {/* Add Staff Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black text-slate-900">Add New Staff</h2>
            <p className="text-sm text-slate-500">Create a new referral account</p>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                createStaffMutation.mutate(formData);
              }}
              className="mt-6 space-y-4"
            >
              <div>
                <label className="mb-2 block text-xs font-bold text-slate-500">Full Name</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold text-slate-500">Mobile Number</label>
                <input
                  required
                  type="tel"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold text-slate-500">Email (Optional)</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold text-slate-500">Password</label>
                <div className="relative">
                  <input
                    required
                    minLength={6}
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white pl-4 pr-11 py-3 font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setShowPassword(false);
                  }}
                  className="flex-1 rounded-xl bg-slate-100 py-3 font-bold text-slate-600 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createStaffMutation.isPending}
                  className="flex-1 rounded-xl bg-primary-500 py-3 font-bold text-white shadow-lg shadow-primary-500/20 hover:bg-primary-600 disabled:opacity-50"
                >
                  {createStaffMutation.isPending ? 'Creating...' : 'Create Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerReferrals() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReferrerId, setSelectedReferrerId] = useState<string | null>(null);

  const referrersQuery = useQuery({
    queryKey: ['user-referrals', searchTerm],
    queryFn: () => adminApi.userReferrals({ search: searchTerm }),
  });

  const detailsQuery = useQuery({
    queryKey: ['user-referral-details', selectedReferrerId],
    queryFn: () => adminApi.userReferralDetails(selectedReferrerId!),
    enabled: !!selectedReferrerId
  });

  const filteredReferrers = referrersQuery.data?.data || [];

  if (referrersQuery.isLoading) return <LoadingBlock label="Loading user referrals..." />;

  return (
    <div className="grid gap-6 lg:grid-cols-3 animate-in fade-in duration-500">
      {/* Referrer List */}
      <div className="lg:col-span-1 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search referrers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-50">
            {filteredReferrers.map((referrer: UserReferrer) => (
              <button
                key={referrer.id}
                onClick={() => setSelectedReferrerId(referrer.id)}
                className={cn(
                  "w-full flex items-center justify-between p-4 text-left transition hover:bg-slate-50",
                  selectedReferrerId === referrer.id && "bg-primary-50/50 border-l-4 border-l-primary-500"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                    <Award size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{referrer.name}</p>
                    <p className="text-xs font-medium text-slate-500">{referrer.mobile} | <span className="font-black text-primary-600">{referrer.referralCode}</span></p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-primary-600">{referrer.referralCount}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Referrals</p>
                </div>
              </button>
            ))}
            {filteredReferrers.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-400 font-bold">No referrers found</div>
            )}
          </div>
        </div>
      </div>

      {/* Details Area */}
      <div className="lg:col-span-2 space-y-4">
        {selectedReferrerId ? (
          <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
            {/* Referrer Header */}
            {detailsQuery.data?.referrer && (
              <div className="rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 p-6 text-white shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md">
                      <Award size={32} className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black">{detailsQuery.data.referrer.name}</h2>
                      <div className="mt-1 flex items-center gap-3 text-white/70">
                        <span className="text-sm font-bold uppercase tracking-widest">Code: {detailsQuery.data.referrer.referralCode}</span>
                        <span className="h-4 w-px bg-white/20" />
                        <span className="text-sm font-bold">{detailsQuery.data.referrer.mobile}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 backdrop-blur-md">
                      <Wallet size={20} className="text-amber-400" />
                      <div>
                        <p className="text-lg font-black leading-none">{detailsQuery.data.referrer.loyaltyPoints}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">Loyalty Points</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Referred Users List */}
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-lg font-black text-slate-900">People Added & Their Activity</h3>
                <button 
                  onClick={() => exportToExcel(detailsQuery.data?.referrals || [], `user_referrals_${selectedReferrerId}`)}
                  className="flex items-center gap-2 text-sm font-bold text-primary-600 hover:underline"
                >
                  <Download size={16} />
                  Export Data
                </button>
              </div>

              {detailsQuery.isLoading ? (
                <div className="py-20 text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                  <p className="mt-4 text-sm font-bold text-slate-400">Fetching referral activity...</p>
                </div>
              ) : (detailsQuery.data?.referrals?.length || 0) === 0 ? (
                <div className="py-20 text-center">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 text-slate-300">
                    <Users size={40} />
                  </div>
                  <p className="mt-6 text-lg font-black text-slate-400">No referrals discovered yet</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {detailsQuery.data?.referrals.map((user: any) => (
                    <div key={user._id} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 transition hover:bg-slate-50">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-primary-600 shadow-sm">
                            <Users size={22} />
                          </div>
                          <div>
                            <p className="text-lg font-black text-slate-900">{user.name}</p>
                            <p className="text-sm font-bold text-slate-500">{user.mobile} | Joined {new Date(user.createdAt).toLocaleDateString('en-IN')}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                           <div className="flex flex-col items-center rounded-xl bg-primary-100 px-4 py-2 text-primary-700">
                             <p className="text-lg font-black leading-none">{user.orders?.length || 0}</p>
                             <p className="text-[10px] font-bold uppercase">Orders</p>
                           </div>
                           <div className="flex flex-col items-center rounded-xl bg-emerald-100 px-4 py-2 text-emerald-700">
                             <p className="text-lg font-black leading-none">₹{(user.orders?.reduce((sum: number, o: any) => sum + o.totalAmount, 0) || 0).toLocaleString()}</p>
                             <p className="text-[10px] font-bold uppercase">Spent</p>
                           </div>
                        </div>
                      </div>

                      {/* User's Orders */}
                      {user.orders && user.orders.length > 0 && (
                        <div className="mt-6 space-y-3 pl-4 sm:pl-16 border-l-2 border-slate-100">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Detailed Purchase History</p>
                          {user.orders.map((order: any) => (
                            <div key={order.orderNumber} className="rounded-2xl bg-white p-4 shadow-sm border border-slate-50">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">{order.orderNumber}</span>
                                  <span className={cn(
                                    "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider",
                                    order.status === 'delivered' ? "bg-emerald-500 text-white" :
                                    order.status === 'cancelled' ? "bg-rose-500 text-white" :
                                    "bg-amber-500 text-white"
                                  )}>
                                    {order.status}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-black text-slate-900">₹{order.totalAmount.toLocaleString()}</p>
                                  <p className="text-[10px] font-bold text-slate-400">{new Date(order.createdAt).toLocaleDateString('en-IN')}</p>
                                </div>
                              </div>
                              <div className="grid gap-2">
                                {order.items.map((item: any, idx: number) => (
                                  <div key={idx} className="flex items-center justify-between rounded-lg bg-slate-50/50 p-2 text-sm">
                                    <div className="flex items-center gap-3">
                                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-xs">
                                        <Package size={14} className="text-slate-400" />
                                      </div>
                                      <p className="font-bold text-slate-600">{item.productName} <span className="text-xs text-slate-400 font-medium">({item.variantLabel})</span></p>
                                    </div>
                                    <p className="font-black text-slate-900">x{item.qty}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-[2.5rem] border-2 border-dashed border-slate-200 bg-slate-50/50 py-32 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white text-primary-200 shadow-sm border border-slate-100">
              <Award size={48} />
            </div>
            <h4 className="mt-8 text-xl font-black text-slate-900">Select a Referrer</h4>
            <p className="mt-2 text-sm font-bold text-slate-400 max-w-xs px-6">Select a user from the list to see who they referred and how much those people have spent on the platform.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function WhatsAppReferrals() {
  const [searchTerm, setSearchTerm] = useState('');

  const whatsappQuery = useQuery({
    queryKey: ['whatsapp-referrals', searchTerm],
    queryFn: () => adminApi.getWhatsAppReferrals({ search: searchTerm }),
  });

  const referrals = whatsappQuery.data?.data || [];

  if (whatsappQuery.isLoading) return <LoadingBlock label="Loading WhatsApp referrals..." />;

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Search WhatsApp users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-500/20"
        />
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900">WhatsApp Origin Registrations</h3>
          <button 
            onClick={() => exportToExcel(referrals, 'whatsapp_referrals')}
            className="flex items-center gap-2 text-sm font-bold text-primary-600 hover:underline"
          >
            <Download size={16} />
            Export Data
          </button>
        </div>

        {referrals.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 text-slate-300">
              <Users size={40} />
            </div>
            <p className="mt-6 text-lg font-black text-slate-400">No WhatsApp referrals found</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {referrals.map((user: any) => (
              <div key={user.id} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 transition hover:bg-slate-50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-green-600 shadow-sm">
                      <Users size={22} />
                    </div>
                    <div>
                      <p className="text-lg font-black text-slate-900">{user.name}</p>
                      <p className="text-sm font-bold text-slate-500">{user.mobile}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-slate-400">Joined</p>
                    <p className="text-sm font-bold text-slate-900">{new Date(user.createdAt).toLocaleDateString('en-IN')}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                   <div className="flex-1 rounded-xl bg-primary-100 p-3 text-center">
                     <p className="text-lg font-black text-primary-700 leading-none">{user.orders?.length || 0}</p>
                     <p className="text-[10px] font-bold uppercase text-primary-600 mt-1">Orders</p>
                   </div>
                   <div className="flex-1 rounded-xl bg-emerald-100 p-3 text-center">
                     <p className="text-lg font-black text-emerald-700 leading-none">₹{(user.orders?.reduce((sum: number, o: any) => sum + o.totalAmount, 0) || 0).toLocaleString()}</p>
                     <p className="text-[10px] font-bold uppercase text-emerald-600 mt-1">Spent</p>
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReferralPage() {
  const [activeTab, setActiveTab] = useState<'staff' | 'customer' | 'whatsapp'>('staff');

  const statsQuery = useQuery({
    queryKey: ['referral-stats'],
    queryFn: () => adminApi.referralStats(),
  });

  const stats = statsQuery.data || {
    staff: { totalReferrals: 0 },
    customer: { totalReferrals: 0, totalLoyaltyPoints: 0 },
    whatsapp: { totalReferrals: 0 },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Referral Management</h1>
          <p className="text-sm font-medium text-slate-500">Track and manage staff and customer referral programs</p>
        </div>
        <div className="flex rounded-2xl bg-slate-100 p-1.5 shadow-inner">
          <button
            onClick={() => setActiveTab('staff')}
            className={cn(
              "flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-black transition-all duration-300",
              activeTab === 'staff' 
                ? "bg-white text-primary-600 shadow-md" 
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <UserCheck size={18} />
            Staff Referrals
          </button>
          <button
            onClick={() => setActiveTab('customer')}
            className={cn(
              "flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-black transition-all duration-300",
              activeTab === 'customer' 
                ? "bg-white text-primary-600 shadow-md" 
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Award size={18} />
            Customer Referrals
          </button>
          <button
            onClick={() => setActiveTab('whatsapp')}
            className={cn(
              "flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-black transition-all duration-300",
              activeTab === 'whatsapp' 
                ? "bg-white text-primary-600 shadow-md" 
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Users size={18} />
            WhatsApp Sources
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
              <UserCheck size={24} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Staff Referrals</p>
              <h3 className="text-2xl font-black text-slate-900">{stats.staff.totalReferrals.toLocaleString()}</h3>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Users size={24} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">User Referrals</p>
              <h3 className="text-2xl font-black text-slate-900">{stats.customer.totalReferrals.toLocaleString()}</h3>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Wallet size={24} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Total Loyalty Points</p>
              <h3 className="text-2xl font-black text-slate-900">{stats.customer.totalLoyaltyPoints.toLocaleString()}</h3>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50 text-green-600">
              <Users size={24} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">WhatsApp Referrals</p>
              <h3 className="text-2xl font-black text-slate-900">{stats.whatsapp?.totalReferrals.toLocaleString() || 0}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-[600px]">
        {activeTab === 'staff' ? (
          <StaffReferrals />
        ) : activeTab === 'customer' ? (
          <CustomerReferrals />
        ) : (
          <WhatsAppReferrals />
        )}
      </div>
    </div>
  );
}
