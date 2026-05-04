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
  Package
} from 'lucide-react';
import { adminApi } from '../utils/api';
import { cn } from '../utils/cn';
import { LoadingBlock } from '../components/LoadingBlock';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';

interface Staff {
  _id: string;
  name: string;
  mobile: string;
  referralCode: string;
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

export default function ReferralPage() {
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    email: ''
  });

  const staffQuery = useQuery<Staff[]>({
    queryKey: ['superadmin-staff'],
    queryFn: async () => {
      const res = await adminApi.getStaffList();
      return res as Staff[];
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
    mutationFn: (payload: { name: string; mobile: string; email?: string }) => 
      adminApi.createStaff(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-staff'] });
      toast.success('Staff added successfully');
      setIsAddModalOpen(false);
      setFormData({ name: '', mobile: '', email: '' });
    }
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (params: { id: string; isActive: boolean }) => 
      adminApi.updateStaffStatus(params.id, params.isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-staff'] });
      toast.success('Status updated');
    }
  });

  const deleteStaffMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteStaff(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-staff'] });
      toast.success('Staff removed');
    }
  });

  const exportToExcel = (data: any[], filename: string) => {
    const flattenedData = data.map(user => ({
      Name: user.name,
      Mobile: user.mobile,
      Email: user.email || 'N/A',
      City: user.savedAddress?.city || 'N/A',
      State: user.savedAddress?.state || 'N/A',
      SignupDate: new Date(user.createdAt).toLocaleDateString('en-IN'),
      TotalOrders: user.orders?.length || 0,
      TotalSpent: user.orders?.reduce((sum: number, o: any) => sum + o.totalAmount, 0) || 0
    }));
    const ws = XLSX.utils.json_to_sheet(flattenedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  const filteredStaff = staffQuery.data?.filter((s) => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.mobile.includes(searchTerm) ||
    s.referralCode.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (staffQuery.isLoading) return <LoadingBlock label="Loading referral data..." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Referral Management</h1>
          <p className="text-slate-500">Track staff referrals and user signups</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportToExcel(staffQuery.data || [], 'staff_referrals')}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <Download size={16} />
            Export Staff
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary-500/20 hover:bg-primary-600"
          >
            <UserPlus size={16} />
            Add Staff
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Staff List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search staff..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-50">
              {filteredStaff.map((staff: Staff) => (
                <button
                  key={staff._id}
                  onClick={() => setSelectedStaffId(staff._id)}
                  className={cn(
                    "w-full flex items-center justify-between p-4 text-left transition hover:bg-slate-50",
                    selectedStaffId === staff._id && "bg-primary-50/50 border-l-4 border-l-primary-500"
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
              ))}
            </div>
          </div>
        </div>

        {/* Details Area */}
        <div className="lg:col-span-2 space-y-6">
          {selectedStaffId ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Staff Stats Card */}
              {(() => {
                const staff = staffQuery.data?.find(s => s._id === selectedStaffId);
                if (!staff) return null;
                return (
                  <div className="rounded-3xl bg-slate-900 p-6 text-white shadow-xl">
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
                          onClick={() => toggleStatusMutation.mutate({ id: staff._id, isActive: !staff.isActive })}
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
                            if (window.confirm('Remove this staff?')) deleteStaffMutation.mutate(staff._id);
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
              <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-lg font-black text-slate-900">Referred Users & Purchases</h3>
                  <button 
                    onClick={() => exportToExcel(referralsQuery.data || [], `referrals_${selectedStaffId}`)}
                    className="flex items-center gap-2 text-sm font-bold text-primary-600 hover:underline"
                  >
                    <Download size={16} />
                    Export Detailed Report
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
                                  <p className="text-xs font-black text-slate-700">{order.orderNumber}</p>
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

              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
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
