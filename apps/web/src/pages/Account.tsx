import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Package, User, KeyRound, X, Heart, Copy, Gift } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/useAuthStore';
import { useServiceModeStore } from '../store/useServiceModeStore';
import { useStoreStore } from '../store/useStoreStore';
import { storefrontApi } from '../utils/api';
import { currencyFormatter, formatStoreAddress } from '../utils/format';
import type { OrderStatusHistoryEntry, Product, ServiceMode } from '../types/storefront';
import { cn } from '../utils/cn';
import ProductCard from '../components/shared/ProductCard';

const statusSequence: OrderStatusHistoryEntry['status'][] = [
  'placed',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
];

const Account: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, token, logout, updateUser } = useAuthStore();
  const selectedStore = useStoreStore((state) => state.selectedStore);
  const setStore = useStoreStore((state) => state.setStore);
  const mode = useServiceModeStore((state) => state.mode);
  const setMode = useServiceModeStore((state) => state.setMode);
  const setAddress = useServiceModeStore((state) => state.setAddress);

  const statusLabelMap = useMemo<Record<OrderStatusHistoryEntry['status'], string>>(
    () => ({
      placed: t('accountPage.statusPlaced'),
      confirmed: t('accountPage.statusConfirmed'),
      processing: t('accountPage.statusProcessing'),
      shipped: t('accountPage.statusShipped'),
      delivered: t('accountPage.statusDelivered'),
      cancelled: t('accountPage.statusCancelled'),
    }),
    [t],
  );

  const tabs = useMemo(
    () => [
      { id: 'orders', label: t('accountPage.tabOrders'), icon: Package },
      { id: 'wishlist', label: t('accountPage.tabWishlist'), icon: Heart },
      { id: 'profile', label: t('accountPage.tabProfile'), icon: User },
      { id: 'password', label: t('accountPage.tabPassword'), icon: KeyRound },
    ] as const,
    [t],
  );

  const [activeTab, setActiveTab] = useState<'orders' | 'wishlist' | 'profile' | 'password'>('orders');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    mobile: user?.mobile || '',
    street: user?.savedAddress?.street || '',
    city: user?.savedAddress?.city || '',
    state: user?.savedAddress?.state || '',
    pincode: user?.savedAddress?.pincode || '',
    landmark: user?.savedAddress?.landmark || '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [profileServiceMode, setProfileServiceMode] = useState<ServiceMode>(mode);
  const [profilePickupStoreId, setProfilePickupStoreId] = useState(selectedStore?.id || '');

  useEffect(() => {
    if (!token) navigate('/login?redirect=/account');
  }, [navigate, token]);

  const { data: ordersResponse, isLoading: isLoadingOrders } = useQuery({
    queryKey: ['account-orders'],
    queryFn: () => storefrontApi.orders(),
    enabled: !!token,
    staleTime: 0,
  });

  const { data: orderDetail, isLoading: isLoadingOrderDetail } = useQuery({
    queryKey: ['account-order-detail', selectedOrderId],
    queryFn: () => storefrontApi.orderDetail(selectedOrderId || ''),
    enabled: !!selectedOrderId,
    staleTime: 0,
  });

  const { data: pickupStores = [], isLoading: isLoadingPickupStores } = useQuery({
    queryKey: ['account-pickup-stores'],
    queryFn: storefrontApi.stores,
    enabled: !!token && activeTab === 'profile',
    staleTime: 300000,
  });

  const orders = ordersResponse?.data || [];
  const wishlistProducts = useMemo(
    () => (user?.wishlist || []).filter((entry): entry is Product => typeof entry !== 'string'),
    [user?.wishlist],
  );
  const orderTimeline = useMemo(
    () =>
      orderDetail?.statusHistory.length
        ? orderDetail.statusHistory
        : statusSequence.map((status) => ({ status, note: 'Pending', timestamp: new Date().toISOString() })),
    [orderDetail?.statusHistory],
  );

  useEffect(() => {
    setProfileServiceMode(mode);
    setProfilePickupStoreId(selectedStore?.id || '');
  }, [mode, selectedStore?.id]);

  const handleProfileSave = async (event: React.FormEvent) => {
    event.preventDefault();

    if (profileServiceMode === 'pickup' && !profilePickupStoreId) {
      toast.error(t('storeSelector.choosePickupStore'));
      return;
    }

    setIsSavingProfile(true);
    try {
      const updatedUser = await storefrontApi.updateMe({
        name: profileData.name,
        email: profileData.email,
        mobile: profileData.mobile,
        savedAddress: {
          street: profileData.street,
          city: profileData.city,
          state: profileData.state,
          pincode: profileData.pincode,
          landmark: profileData.landmark,
        },
      });

      await storefrontApi.updateServiceMode(profileServiceMode);
      setMode(profileServiceMode);

      if (profileServiceMode === 'pickup' && profilePickupStoreId) {
        await storefrontApi.selectStore(profilePickupStoreId);
        const matchedStore = pickupStores.find((store) => store.id === profilePickupStoreId) || null;
        if (matchedStore) {
          setStore(matchedStore);
        }
      }

      updateUser(updatedUser);
      setAddress(updatedUser.savedAddress || null);
      toast.success(t('accountPage.profileUpdated'));
    } catch {
      toast.error(t('accountPage.profileUpdateFailed'));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsChangingPassword(true);
    try {
      const response = await storefrontApi.changePassword(passwordData);
      toast.success(response.message);
      await storefrontApi.logout();
      logout();
      navigate('/login');
    } catch {
      toast.error(t('accountPage.passwordChangeFailed'));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleCopyReferralLink = async () => {
    if (!user?.referralCode) {
      toast.error(t('accountPage.referralUnavailable'));
      return;
    }

    const baseUrl = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, '');
    const referralLink = `${baseUrl}/signup?ref=${user.referralCode}`;

    try {
      await navigator.clipboard.writeText(referralLink);
      toast.success(t('accountPage.referralCopied'));
    } catch {
      toast.error(t('accountPage.referralCopyFailed'));
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6">
      <section className="surface-card overflow-hidden bg-[linear-gradient(135deg,_rgba(20,61,46,1),_rgba(8,32,24,0.96))] px-6 py-8 text-white sm:px-8">
        <p className="section-kicker text-primary-200">{t('accountPage.myAccount')}</p>
        <h1 className="mt-3 font-heading text-5xl">{user?.name || t('accountPage.customerAccount')}</h1>
        <p className="mt-4 text-base font-medium leading-8 text-white/75">
          {t('accountPage.accountDescription')}
        </p>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[250px_1fr]">
        <aside className="surface-card h-fit p-4">
          <div className="space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black uppercase tracking-[0.16em]',
                  activeTab === tab.id ? 'bg-primary text-white' : 'text-primary-900/65 hover:bg-primary-50',
                )}
              >
                <tab.icon size={16} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="surface-card p-6">
          {activeTab === 'orders' && (
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="section-kicker mb-2">{t('accountPage.orders')}</p>
                  <h2 className="text-2xl font-black text-primary-900">{t('accountPage.recentOrders')}</h2>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {isLoadingOrders ? (
                  [...Array(3)].map((_, index) => <div key={index} className="h-28 animate-pulse rounded-[1.5rem] bg-primary-50" />)
                ) : orders.length ? (
                  orders.map((order) => (
                    <button
                      key={order.id}
                      onClick={() => setSelectedOrderId(order.id)}
                      className="w-full rounded-[1.5rem] border border-primary-100 bg-primary-50/50 p-5 text-left transition hover:bg-primary-50"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-500">{t('accountPage.orderNumber')}</p>
                          <h3 className="mt-2 text-lg font-black text-primary-900">{order.orderNumber}</h3>
                          <p className="mt-2 text-sm font-medium text-primary-900/60">
                            {new Date(order.createdAt).toLocaleDateString()} · {order.serviceMode === 'delivery' ? t('checkoutPage.delivery') : t('checkoutPage.pickup')}
                          </p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-sm font-black uppercase tracking-[0.16em] text-primary-500">{statusLabelMap[order.status] || order.status}</p>
                          <p className="mt-2 text-lg font-black text-primary">{currencyFormatter.format(order.totalAmount)}</p>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="text-sm font-medium text-primary-900/60">{t('accountPage.noOrdersYet')}</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'wishlist' && (
            <div>
              <div>
                <p className="section-kicker mb-2">{t('accountPage.wishlist')}</p>
                <h2 className="text-2xl font-black text-primary-900">{t('accountPage.savedProducts')}</h2>
              </div>

              <div className="mt-6">
                {wishlistProducts.length ? (
                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {wishlistProducts.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[1.5rem] border border-primary-100 bg-primary-50/50 p-6">
                    <p className="text-sm font-medium text-primary-900/65">
                      {t('accountPage.wishlistEmpty')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <form onSubmit={handleProfileSave} className="space-y-4">
              <div>
                <p className="section-kicker mb-2">{t('accountPage.profile')}</p>
                <h2 className="text-2xl font-black text-primary-900">{t('accountPage.customerDetails')}</h2>
              </div>

              <div className="rounded-[1.5rem] border border-primary-100 bg-primary-50/70 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-500">{t('accountPage.referralProgram')}</p>
                    <p className="mt-2 text-lg font-black text-primary-900">{t('accountPage.code')}: {user?.referralCode || t('accountPage.generating')}</p>
                    <p className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-primary-900/65">
                      <Gift size={14} />
                      {t('accountPage.successfulReferrals', { count: user?.referralCount || 0 })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyReferralLink}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-primary-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-primary-900"
                  >
                    <Copy size={14} />
                    {t('accountPage.copyInviteLink')}
                  </button>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-primary-100 bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-500">{t('storeSelector.serviceMode')}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl border border-primary-100 bg-primary-50 p-1.5">
                  {([
                    { key: 'delivery', label: t('storeSelector.delivery') },
                    { key: 'pickup', label: t('storeSelector.pickup') },
                  ] as const).map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setProfileServiceMode(item.key)}
                      className={cn(
                        'rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.14em] transition',
                        profileServiceMode === item.key
                          ? 'bg-primary text-white'
                          : 'text-primary-900/60 hover:text-primary-900',
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {profileServiceMode === 'pickup' ? (
                  <div className="mt-4 space-y-2">
                    <label className="block text-xs font-black uppercase tracking-[0.16em] text-primary-500">
                      {t('serviceModeBar.selectNearbyStore')}
                    </label>
                    <select
                      value={profilePickupStoreId}
                      onChange={(event) => setProfilePickupStoreId(event.target.value)}
                      className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900"
                    >
                      <option value="">{t('storeSelector.choosePickupStore')}</option>
                      {pickupStores.map((store) => (
                        <option key={store.id} value={store.id}>
                          {store.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs font-medium text-primary-900/55">
                      {isLoadingPickupStores ? t('common.loading') : t('header.pickupFrom')}
                    </p>
                  </div>
                ) : (
                  <p className="mt-4 text-xs font-medium text-primary-900/55">{t('storeSelector.addressHint')}</p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <input value={profileData.name} onChange={(event) => setProfileData((current) => ({ ...current, name: event.target.value }))} placeholder={t('accountPage.fullName')} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900" />
                <input value={profileData.mobile} onChange={(event) => setProfileData((current) => ({ ...current, mobile: event.target.value }))} placeholder={t('accountPage.mobileNumber')} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900" />
                <input value={profileData.email} onChange={(event) => setProfileData((current) => ({ ...current, email: event.target.value }))} placeholder={t('accountPage.emailAddress')} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900 sm:col-span-2" />
                <input value={profileData.street} onChange={(event) => setProfileData((current) => ({ ...current, street: event.target.value }))} placeholder={t('accountPage.streetAddress')} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900 sm:col-span-2" />
                <input value={profileData.city} onChange={(event) => setProfileData((current) => ({ ...current, city: event.target.value }))} placeholder={t('accountPage.city')} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900" />
                <input value={profileData.state} onChange={(event) => setProfileData((current) => ({ ...current, state: event.target.value }))} placeholder={t('accountPage.state')} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900" />
                <input value={profileData.pincode} onChange={(event) => setProfileData((current) => ({ ...current, pincode: event.target.value }))} placeholder={t('accountPage.pincode')} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900" />
                <input value={profileData.landmark} onChange={(event) => setProfileData((current) => ({ ...current, landmark: event.target.value }))} placeholder={t('accountPage.landmark')} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900" />
              </div>
              <button className="rounded-full bg-primary px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white">
                {isSavingProfile ? t('accountPage.saving') : t('accountPage.saveProfile')}
              </button>
            </form>
          )}

          {activeTab === 'password' && (
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <p className="section-kicker mb-2">{t('accountPage.security')}</p>
                <h2 className="text-2xl font-black text-primary-900">{t('accountPage.changePassword')}</h2>
              </div>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(event) => setPasswordData((current) => ({ ...current, currentPassword: event.target.value }))}
                placeholder={t('accountPage.currentPassword')}
                className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900"
              />
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(event) => setPasswordData((current) => ({ ...current, newPassword: event.target.value }))}
                placeholder={t('accountPage.newPassword')}
                className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900"
              />
              <button className="rounded-full bg-primary px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white">
                {isChangingPassword ? t('accountPage.updating') : t('accountPage.updatePassword')}
              </button>
            </form>
          )}
        </section>
      </div>

      {selectedOrderId && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-primary-900/60 px-4 py-6 backdrop-blur-sm">
          <div className="surface-card w-full max-w-3xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="section-kicker mb-2">{t('accountPage.orderDetail')}</p>
                <h2 className="text-2xl font-black text-primary-900">{orderDetail?.orderNumber || t('accountPage.loading')}</h2>
              </div>
              <button onClick={() => setSelectedOrderId(null)} className="rounded-full p-2 hover:bg-primary-50">
                <X size={20} />
              </button>
            </div>

            {isLoadingOrderDetail || !orderDetail ? (
              <div className="mt-6 h-40 animate-pulse rounded-[1.5rem] bg-primary-50" />
            ) : (
              <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
                <div className="space-y-4">
                  {orderDetail.items.map((item, index) => (
                    <div key={`${item.productId}-${index}`} className="rounded-[1.5rem] border border-primary-100 bg-primary-50/50 p-4">
                      <p className="text-sm font-black text-primary-900">{item.productName}</p>
                      <p className="mt-1 text-[11px] font-black uppercase tracking-[0.18em] text-primary-500">
                        {item.qty} x {item.variantLabel}
                      </p>
                      <p className="mt-2 text-sm font-bold text-primary">{currencyFormatter.format(item.price * item.qty)}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-[1.5rem] border border-primary-100 bg-white p-4">
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-primary-500">{t('accountPage.statusTimeline')}</p>
                  <div className="mt-4 space-y-4">
                    {statusSequence.map((status) => {
                      const isComplete = orderTimeline.some((entry) => entry.status === status);
                      return (
                        <div key={status} className="flex items-start gap-3">
                          <div className={cn('mt-1 h-3 w-3 rounded-full', isComplete ? 'bg-primary' : 'bg-primary-100')} />
                          <div>
                            <p className="text-sm font-black uppercase tracking-[0.18em] text-primary-900">{statusLabelMap[status] || status}</p>
                            <p className="mt-1 text-sm font-medium text-primary-900/55">
                              {orderTimeline.find((entry) => entry.status === status)?.note || t('accountPage.pending')}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-6 rounded-[1.5rem] bg-primary-50 p-4 text-sm font-medium text-primary-900/65">
                    {orderDetail.shippingAddress
                      ? t('accountPage.deliveryTo', { address: formatStoreAddress(orderDetail.shippingAddress) })
                      : t('accountPage.pickupFrom', {
                          store: typeof orderDetail.storeId === 'object' ? orderDetail.storeId.name : t('accountPage.selectedStore'),
                        })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Account;
