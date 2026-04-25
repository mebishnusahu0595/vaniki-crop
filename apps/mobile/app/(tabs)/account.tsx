import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Share, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '../../src/components/Screen';
import { ProductCard } from '../../src/components/ProductCard';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useServiceModeStore } from '../../src/store/useServiceModeStore';
import { useStoreStore } from '../../src/store/useStoreStore';
import { storefrontApi } from '../../src/lib/api';
import { currencyFormatter, formatStoreAddress } from '../../src/utils/format';
import type { Product, ServiceMode } from '../../src/types/storefront';

const tabs = ['orders', 'wishlist', 'profile', 'password'] as const;

export default function AccountScreen() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('orders');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const { user, logout, setUser } = useAuthStore();
  const selectedStore = useStoreStore((state) => state.selectedStore);
  const setStore = useStoreStore((state) => state.setStore);
  const mode = useServiceModeStore((state) => state.mode);
  const setMode = useServiceModeStore((state) => state.setMode);
  const setAddress = useServiceModeStore((state) => state.setAddress);
  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    mobile: user?.mobile || '',
    street: user?.savedAddress?.street || '',
    city: user?.savedAddress?.city || '',
    state: user?.savedAddress?.state || '',
    pincode: user?.savedAddress?.pincode || '',
    landmark: user?.savedAddress?.landmark || '',
  });
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '' });
  const [serviceMode, setServiceMode] = useState<ServiceMode>(mode);
  const [pickupStoreId, setPickupStoreId] = useState(selectedStore?.id || '');
  const [isQuickModeSaving, setIsQuickModeSaving] = useState(false);
  const wishlistProducts = (user?.wishlist || []).filter(
    (entry): entry is Product => typeof entry !== 'string',
  );

  const ordersQuery = useQuery({
    queryKey: ['mobile-orders'],
    queryFn: () => storefrontApi.orders(),
    enabled: Boolean(user),
  });
  const orderDetailQuery = useQuery({
    queryKey: ['mobile-order-detail', selectedOrderId],
    queryFn: () => storefrontApi.orderDetail(selectedOrderId || ''),
    enabled: Boolean(selectedOrderId),
  });
  const pickupStoresQuery = useQuery({
    queryKey: ['mobile-account-pickup-stores'],
    queryFn: storefrontApi.stores,
    enabled: Boolean(user),
  });

  const pickupStores = useMemo(() => pickupStoresQuery.data || [], [pickupStoresQuery.data]);

  useEffect(() => {
    setServiceMode(mode);
    setPickupStoreId(selectedStore?.id || '');
  }, [mode, selectedStore?.id]);

  if (!user) {
    return (
      <Screen>
        <View className="rounded-[28px] bg-white p-8">
          <Text className="text-2xl font-black text-primary-900">Sign in to continue.</Text>
          <Text className="mt-3 text-sm leading-6 text-primary-900/70">
            Track orders, save addresses, and manage your account from here.
          </Text>
          <Pressable onPress={() => router.push('/(auth)/login')} className="mt-6 rounded-full bg-primary-500 px-5 py-4">
            <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">Login</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const handleQuickModeChange = async (nextMode: ServiceMode) => {
    if (nextMode === mode) return;

    setIsQuickModeSaving(true);
    try {
      const modeUser = await storefrontApi.updateServiceMode(nextMode);
      setMode(nextMode);

      if (nextMode === 'delivery') {
        setStore(null);
        setPickupStoreId('');
        setUser({
          ...user,
          ...modeUser,
          serviceMode: 'delivery',
          selectedStore: null,
        });
      } else {
        setUser({
          ...user,
          ...modeUser,
          serviceMode: 'pickup',
          selectedStore: modeUser.selectedStore ?? user.selectedStore ?? null,
        });
      }

      Alert.alert('Updated', nextMode === 'delivery' ? 'Delivery mode activated.' : 'Pickup mode activated.');
    } catch (caughtError) {
      Alert.alert('Update failed', caughtError instanceof Error ? caughtError.message : 'Please try again.');
    } finally {
      setIsQuickModeSaving(false);
    }
  };

  const handleQuickPickupStoreChange = async (nextStoreId: string) => {
    if (!nextStoreId) return;

    setPickupStoreId(nextStoreId);
    setIsQuickModeSaving(true);
    try {
      const modeUser = mode === 'pickup' ? null : await storefrontApi.updateServiceMode('pickup');
      const storeUser = await storefrontApi.updateSelectedStore(nextStoreId);
      await storefrontApi.selectStore(nextStoreId);

      const matchedStore = pickupStores.find((store) => store.id === nextStoreId) || null;
      if (matchedStore) {
        setStore(matchedStore);
      }

      setMode('pickup');
      setUser({
        ...user,
        ...(modeUser || {}),
        ...storeUser,
        serviceMode: 'pickup',
        selectedStore: storeUser.selectedStore ?? modeUser?.selectedStore ?? matchedStore ?? null,
      });
      Alert.alert('Store updated', 'Pickup store has been selected.');
    } catch (caughtError) {
      Alert.alert('Update failed', caughtError instanceof Error ? caughtError.message : 'Please try again.');
    } finally {
      setIsQuickModeSaving(false);
    }
  };

  return (
    <Screen>
      <Text className="text-3xl font-black text-primary-900">{user.name}</Text>
      <Text className="mt-2 text-sm text-primary-900/60">{user.mobile}</Text>

      <View className="mt-5 rounded-[28px] bg-white p-5">
        <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-500">Service Mode</Text>
        <View className="mt-3 flex-row rounded-full bg-primary-50 p-1">
          {(['delivery', 'pickup'] as const).map((item) => (
            <Pressable
              key={item}
              onPress={() => handleQuickModeChange(item)}
              disabled={isQuickModeSaving}
              className={`flex-1 rounded-full px-3 py-3 ${mode === item ? 'bg-primary-500' : 'bg-transparent'} ${isQuickModeSaving ? 'opacity-60' : ''}`}
            >
              <Text className={`text-center text-[10px] font-black uppercase tracking-[1.2px] ${mode === item ? 'text-white' : 'text-primary-900/55'}`}>
                {item}
              </Text>
            </Pressable>
          ))}
        </View>

        {mode === 'pickup' ? (
          <View className="mt-4 gap-2">
            {pickupStores.map((store) => (
              <Pressable
                key={store.id}
                onPress={() => handleQuickPickupStoreChange(store.id)}
                disabled={isQuickModeSaving}
                className={`rounded-[18px] border px-4 py-4 ${pickupStoreId === store.id ? 'border-primary-500 bg-primary-50' : 'border-primary-100 bg-white'} ${isQuickModeSaving ? 'opacity-60' : ''}`}
              >
                <Text className="text-sm font-black text-primary-900">{store.name}</Text>
                <Text className="mt-1 text-sm text-primary-900/60">{formatStoreAddress(store.address)}</Text>
              </Pressable>
            ))}
            {!pickupStores.length ? (
              <Text className="text-sm text-primary-900/60">No pickup stores available right now.</Text>
            ) : null}
          </View>
        ) : (
          <Text className="mt-4 text-sm text-primary-900/60">Delivery mode will use your saved address at checkout.</Text>
        )}
      </View>

      <View className="mt-4 flex-row rounded-full bg-primary-50 p-1">
        {tabs.map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            className={`flex-1 rounded-full px-3 py-3 ${activeTab === tab ? 'bg-white' : ''}`}
          >
            <Text className={`text-center text-[10px] font-black uppercase tracking-[1px] ${activeTab === tab ? 'text-primary-900' : 'text-primary-900/45'}`}>
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>

      {activeTab === 'orders' ? (
        <View className="mt-5 gap-4">
          {(ordersQuery.data?.data || []).map((order) => (
            <Pressable key={order.id} onPress={() => setSelectedOrderId(order.id)} className="rounded-[28px] bg-white p-5">
              <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-500">{order.orderNumber}</Text>
              <Text className="mt-2 text-lg font-black text-primary-900">{currencyFormatter.format(order.totalAmount)}</Text>
              <Text className="mt-2 text-sm text-primary-900/60">{order.status}</Text>
            </Pressable>
          ))}

          {selectedOrderId && orderDetailQuery.data ? (
            <View className="rounded-[28px] bg-white p-5">
              <Text className="text-lg font-black text-primary-900">Order Detail</Text>
              <Text className="mt-2 text-sm text-primary-900/70">{orderDetailQuery.data.orderNumber}</Text>
              <View className="mt-4 gap-3">
                {orderDetailQuery.data.statusHistory.map((entry) => (
                  <View key={`${entry.status}-${entry.timestamp}`} className="flex-row gap-3">
                    <View className="mt-1 h-3 w-3 rounded-full bg-primary-500" />
                    <View className="flex-1">
                      <Text className="text-sm font-black uppercase tracking-[1px] text-primary-900">{entry.status}</Text>
                      <Text className="text-sm text-primary-900/60">{entry.note || 'Updated'}</Text>
                    </View>
                  </View>
                ))}
                <Text className="text-sm text-primary-900/60">
                  {orderDetailQuery.data.shippingAddress
                    ? `Delivery to ${formatStoreAddress(orderDetailQuery.data.shippingAddress)}`
                    : `Pickup from ${orderDetailQuery.data.storeId?.name || 'Selected store'}`}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {activeTab === 'wishlist' ? (
        <View className="mt-5">
          {wishlistProducts.length ? (
            <View className="gap-3">
              {wishlistProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </View>
          ) : (
            <View className="rounded-[28px] bg-white p-6">
              <Text className="text-lg font-black text-primary-900">No saved products yet.</Text>
              <Text className="mt-2 text-sm leading-6 text-primary-900/65">
                Tap the heart icon on any product to build your wishlist.
              </Text>
              <Pressable
                onPress={() => router.push('/products')}
                className="mt-5 rounded-full bg-primary-500 px-5 py-4"
              >
                <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">Browse Products</Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : null}

          {activeTab === 'profile' ? (
        <View className="mt-5 gap-3 rounded-[28px] bg-white p-5">
          <View className="rounded-[24px] bg-primary-50 p-4">
            <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-500">Referral Program</Text>
            <Text className="mt-2 text-lg font-black text-primary-900">Code: {user.referralCode || 'Generating'}</Text>
            <Text className="mt-1 text-sm text-primary-900/65">Successful referrals: {user.referralCount || 0}</Text>
            <Pressable
              onPress={async () => {
                if (!user.referralCode) {
                  Alert.alert('Referral unavailable', 'Your referral code is not ready yet.');
                  return;
                }

                const referralLink = `https://vanikicrop.com/signup?ref=${user.referralCode}`;
                await Share.share({
                  message: `Join Vaniki Crop with my referral link: ${referralLink}`,
                });
              }}
              className="mt-3 rounded-full border border-primary-200 bg-white px-4 py-3"
            >
              <Text className="text-center text-[10px] font-black uppercase tracking-[1.5px] text-primary-900">Share Invite Link</Text>
            </Pressable>
          </View>

          <View className="rounded-[24px] bg-primary-50 p-4">
            <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-500">Service Mode</Text>
            <View className="mt-3 flex-row rounded-full bg-white p-1">
              {(['delivery', 'pickup'] as const).map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setServiceMode(item)}
                  className={`flex-1 rounded-full px-3 py-3 ${serviceMode === item ? 'bg-primary-500' : ''}`}
                >
                  <Text className={`text-center text-[10px] font-black uppercase tracking-[1.2px] ${serviceMode === item ? 'text-white' : 'text-primary-900/55'}`}>
                    {item}
                  </Text>
                </Pressable>
              ))}
            </View>

            {serviceMode === 'pickup' ? (
              <View className="mt-4 gap-2">
                {pickupStores.map((store) => (
                  <Pressable
                    key={store.id}
                    onPress={() => setPickupStoreId(store.id)}
                    className={`rounded-[18px] border px-4 py-4 ${pickupStoreId === store.id ? 'border-primary-500 bg-white' : 'border-primary-100 bg-white/70'}`}
                  >
                    <Text className="text-sm font-black text-primary-900">{store.name}</Text>
                    <Text className="mt-1 text-sm text-primary-900/60">{formatStoreAddress(store.address)}</Text>
                  </Pressable>
                ))}
                {!pickupStores.length ? (
                  <Text className="text-sm text-primary-900/60">No pickup stores available right now.</Text>
                ) : null}
              </View>
            ) : (
              <Text className="mt-4 text-sm text-primary-900/60">Delivery mode will use your saved address at checkout.</Text>
            )}
          </View>

          {([
            ['name', 'Full Name'],
            ['mobile', 'Mobile'],
            ['email', 'Email'],
            ['street', 'Street Address'],
            ['city', 'City'],
            ['state', 'State'],
            ['pincode', 'Pincode'],
            ['landmark', 'Landmark'],
          ] as const).map(([key, placeholder]) => (
            <TextInput
              key={key}
              value={profile[key] || ''}
              onChangeText={(value) => setProfile((current) => ({ ...current, [key]: value }))}
              placeholder={placeholder}
              className="rounded-[20px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
              placeholderTextColor="#7a978b"
            />
          ))}
          <Pressable
            onPress={async () => {
              if (serviceMode === 'pickup' && !pickupStoreId) {
                Alert.alert('Choose store', 'Please choose a pickup store before saving.');
                return;
              }

              try {
                const updatedProfile = await storefrontApi.updateMe({
                  name: profile.name,
                  email: profile.email,
                  mobile: profile.mobile,
                  savedAddress: {
                    street: profile.street,
                    city: profile.city,
                    state: profile.state,
                    pincode: profile.pincode,
                    landmark: profile.landmark,
                  },
                });

                const updatedMode = await storefrontApi.updateServiceMode(serviceMode);
                let nextUser = {
                  ...updatedProfile,
                  serviceMode: updatedMode.serviceMode,
                  selectedStore: updatedMode.selectedStore ?? null,
                };

                setMode(serviceMode);

                if (serviceMode === 'pickup' && pickupStoreId) {
                  const storeUser = await storefrontApi.updateSelectedStore(pickupStoreId);
                  await storefrontApi.selectStore(pickupStoreId);
                  const matchedStore = pickupStores.find((store) => store.id === pickupStoreId) || null;
                  if (matchedStore) {
                    setStore(matchedStore);
                  }
                  nextUser = {
                    ...nextUser,
                    selectedStore: storeUser.selectedStore ?? null,
                  };
                } else if (serviceMode === 'delivery') {
                  setStore(null);
                  setPickupStoreId('');
                  nextUser = {
                    ...nextUser,
                    selectedStore: null,
                  };
                }

                setUser(nextUser);
                setAddress(nextUser.savedAddress || null);
                Alert.alert('Profile saved', 'Your account preferences have been updated.');
              } catch (caughtError) {
                Alert.alert('Save failed', caughtError instanceof Error ? caughtError.message : 'Please try again.');
              }
            }}
            className="rounded-full bg-primary-500 px-5 py-4"
          >
            <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">Save Profile</Text>
          </Pressable>

          <View className="mt-2 gap-3 rounded-[24px] bg-primary-50 p-4">
            <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-500">Explore</Text>
            <Pressable onPress={() => router.push('/about' as any)} className="rounded-full bg-white px-4 py-3">
              <Text className="text-center text-[10px] font-black uppercase tracking-[1.4px] text-primary-900">About Vaniki</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/contact' as any)} className="rounded-full bg-white px-4 py-3">
              <Text className="text-center text-[10px] font-black uppercase tracking-[1.4px] text-primary-900">Contact Support</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/privacy-policy' as any)} className="rounded-full bg-white px-4 py-3">
              <Text className="text-center text-[10px] font-black uppercase tracking-[1.4px] text-primary-900">Privacy Policy</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {activeTab === 'password' ? (
        <View className="mt-5 gap-3 rounded-[28px] bg-white p-5">
          <TextInput
            value={password.currentPassword}
            onChangeText={(value) => setPassword((current) => ({ ...current, currentPassword: value }))}
            placeholder="Current Password"
            secureTextEntry
            className="rounded-[20px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
            placeholderTextColor="#7a978b"
          />
          <TextInput
            value={password.newPassword}
            onChangeText={(value) => setPassword((current) => ({ ...current, newPassword: value }))}
            placeholder="New Password"
            secureTextEntry
            className="rounded-[20px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
            placeholderTextColor="#7a978b"
          />
          <Pressable
            onPress={async () => {
              await storefrontApi.changePassword(password);
              await storefrontApi.logout();
              logout();
              router.replace('/(auth)/login');
            }}
            className="rounded-full bg-primary-500 px-5 py-4"
          >
            <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">Change Password</Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        onPress={async () => {
          await storefrontApi.logout().catch(() => undefined);
          logout();
        }}
        className="mt-6 rounded-full bg-white px-5 py-4"
      >
        <Text className="text-center text-xs font-black uppercase tracking-[2px] text-primary-900">Logout</Text>
      </Pressable>
    </Screen>
  );
}
