import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Platform, Pressable, Share, Text, TextInput, View, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '../../src/components/Screen';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useServiceModeStore } from '../../src/store/useServiceModeStore';
import { useStoreStore } from '../../src/store/useStoreStore';
import { storefrontApi } from '../../src/lib/api';
import { buildStoreDirectionsUrl, formatStoreAddress } from '../../src/utils/format';
import type { ServiceMode } from '../../src/types/storefront';
import { INDIAN_STATES, STATE_DISTRICTS } from '@vaniki/shared';
import { lookupPincode } from '../../src/utils/pincode';
import { SelectionModal } from '../../src/components/SelectionModal';
import { LocationMapPicker } from '../../src/components/LocationMapPicker';

export default function ProfileScreen() {
  const { user, setUser, logout } = useAuthStore();
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

  const [serviceMode, setServiceMode] = useState<ServiceMode>(mode);
  const [pickupStoreId, setPickupStoreId] = useState(selectedStore?.id || '');
  const [isSaving, setIsSaving] = useState(false);
  const [stateModalVisible, setStateModalVisible] = useState(false);
  const [districtModalVisible, setDistrictModalVisible] = useState(false);

  const pickupStoresQuery = useQuery({
    queryKey: ['mobile-account-pickup-stores'],
    queryFn: storefrontApi.stores,
  });

  const pickupStores = useMemo(() => pickupStoresQuery.data || [], [pickupStoresQuery.data]);

  useEffect(() => {
    setServiceMode(mode);
    setPickupStoreId(selectedStore?.id || '');
  }, [mode, selectedStore?.id]);

  if (!user) {
    return (
      <Screen>
        <View className="flex-1 justify-center items-center px-6 py-12">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200 mb-5">
            <Feather name="lock" size={32} color="#2D6A4F" />
          </View>
          <Text className="text-2xl font-black text-primary-900 text-center">Login Required</Text>
          <Text className="mt-2 text-xs leading-5 text-primary-900/60 text-center max-w-xs mb-6">
            Please login or register to view and edit your profile details.
          </Text>
          <Pressable
            onPress={() => router.push('/(auth)/login')}
            className="rounded-full bg-primary-500 px-8 py-4 active:scale-95 shadow-md"
          >
            <Text className="text-center text-xs font-black uppercase tracking-[1.5px] text-white">
              Login / Register Now
            </Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action is permanent and cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await storefrontApi.deleteAccount();
              logout();
              router.replace('/(auth)/login');
            } catch (caughtError) {
              Alert.alert('Error', caughtError instanceof Error ? caughtError.message : 'Failed to delete account.');
            }
          },
        },
      ],
    );
  };

  const handleSaveProfile = async () => {
    if (serviceMode === 'pickup' && !pickupStoreId) {
      Alert.alert('Choose store', 'Please choose a pickup store before saving.');
      return;
    }

    setIsSaving(true);
    try {
      const updatedProfile = await storefrontApi.updateMe({
        name: profile.name,
        email: profile.email,
        mobile: profile.mobile,
        savedAddress: {
          street: profile.street,
          city: profile.city,
          district: profile.city,
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
      router.back();
    } catch (caughtError) {
      Alert.alert('Save failed', caughtError instanceof Error ? caughtError.message : 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen scroll={false}>
      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, width: '100%' }} contentContainerStyle={{ width: '100%', flexGrow: 1, paddingBottom: 40 }}>
        {/* Back and Title */}
        <View className="flex-row items-center gap-3 mb-6">
          <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm border border-primary-50 active:scale-90">
            <Feather name="arrow-left" size={18} color="#082018" />
          </Pressable>
          <Text className="text-2xl font-black text-primary-900">Edit Profile</Text>
        </View>

        {/* Referral Card */}
        <View className="rounded-[28px] bg-primary-50 border border-primary-100 p-5 mb-5 shadow-sm">
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
              const message = `Join Vaniki Crop with my referral link: ${referralLink}`;

              try {
                if (Platform.OS !== 'web') {
                  await Share.share({ message });
                } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
                  await navigator.clipboard.writeText(referralLink);
                  Alert.alert('Link Copied! 📋', 'Referral link has been copied to your clipboard.');
                } else {
                  Alert.alert('Referral Link', referralLink);
                }
              } catch (error) {
                if (typeof navigator !== 'undefined' && navigator.clipboard) {
                  await navigator.clipboard.writeText(referralLink);
                  Alert.alert('Link Copied! 📋', 'Referral link has been copied to your clipboard.');
                } else {
                  Alert.alert('Referral Link', referralLink);
                }
              }
            }}
            className="mt-4 rounded-full border border-primary-200 bg-white py-3 active:scale-95 shadow-sm"
          >
            <Text className="text-center text-[10px] font-black uppercase tracking-[1.5px] text-primary-900">Share Invite Link</Text>
          </Pressable>
        </View>

        {/* Main Details Form */}
        <View className="rounded-[28px] bg-white border border-primary-100 p-5 mb-5 shadow-sm gap-4">
          <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-500 mb-1">Personal Info</Text>

          <View>
            <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">Full Name</Text>
            <TextInput
              value={profile.name}
              onChangeText={(value) => setProfile((current) => ({ ...current, name: value }))}
              placeholder="Full Name"
              className="rounded-[20px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
              placeholderTextColor="#7a978b"
            />
          </View>

          <View>
            <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">Mobile Number</Text>
            <TextInput
              value={profile.mobile}
              onChangeText={(value) => setProfile((current) => ({ ...current, mobile: value.replace(/\D/g, '') }))}
              placeholder="Mobile"
              keyboardType="phone-pad"
              editable={false}
              className="rounded-[20px] border border-primary-100 bg-primary-50/50 px-4 py-4 text-base text-primary-900/60"
              placeholderTextColor="#7a978b"
            />
          </View>

          <View>
            <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">Email Address</Text>
            <TextInput
              value={profile.email}
              onChangeText={(value) => setProfile((current) => ({ ...current, email: value }))}
              placeholder="Email"
              keyboardType="email-address"
              className="rounded-[20px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
              placeholderTextColor="#7a978b"
            />
          </View>
        </View>

        {/* Address and Service Mode Preference */}
        <View className="rounded-[28px] bg-white border border-primary-100 p-5 mb-5 shadow-sm gap-4">
          <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-500 mb-1">Service & Address</Text>

          <View className="flex-row rounded-full bg-primary-50 p-1">
            {(['delivery', 'pickup'] as const).map((item) => (
              <Pressable
                key={item}
                onPress={() => setServiceMode(item)}
                className={`flex-1 rounded-full px-3 py-2.5 ${serviceMode === item ? 'bg-primary-500' : ''} active:scale-95`}
              >
                <Text className={`text-center text-[10px] font-black uppercase tracking-[1.2px] ${serviceMode === item ? 'text-white' : 'text-primary-900/55'}`}>
                  {item === 'delivery' ? 'Delivery' : 'Store'}
                </Text>
              </Pressable>
            ))}
          </View>

          {serviceMode === 'pickup' ? (
            <View className="gap-2 mt-2">
              <Text className="mb-1 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">Select Store</Text>
              {pickupStores.map((store) => (
                <Pressable
                  key={store.id}
                  onPress={() => setPickupStoreId(store.id)}
                  className={`rounded-[18px] border px-4 py-4 ${pickupStoreId === store.id ? 'border-primary-500 bg-primary-50' : 'border-primary-100 bg-white'} active:scale-[0.99]`}
                >
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-sm font-black text-primary-900">{store.name}</Text>
                      <Text className="mt-1 text-xs text-primary-900/60">{formatStoreAddress(store.address)}</Text>
                    </View>
                    <Pressable
                      onPress={() => Linking.openURL(buildStoreDirectionsUrl(store)).catch(() => undefined)}
                      hitSlop={10}
                      accessibilityLabel="Get directions"
                      className="h-10 w-10 items-center justify-center rounded-full bg-primary-50"
                    >
                      <Feather name="navigation" size={16} color="#2D6A4F" />
                    </Pressable>
                  </View>
                </Pressable>
              ))}
              {!pickupStores.length ? (
                <Text className="text-sm text-primary-900/60">No stores available right now.</Text>
              ) : null}
            </View>
          ) : (
            <View className="gap-4 mt-2">
              {/* Dynamic Live GPS Location & OpenStreetMap Pin Picker */}
              <LocationMapPicker
                currentPincode={profile.pincode}
                currentState={profile.state}
                currentCity={profile.city}
                onLocationSelect={(res) => {
                  setProfile((current) => ({
                    ...current,
                    street: res.street || current.street,
                    city: res.city || current.city,
                    state: res.state || current.state,
                    pincode: res.pincode || current.pincode,
                    landmark: res.landmark || current.landmark,
                  }));
                }}
              />

              <View>
                <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">Street Address</Text>
                <TextInput
                  value={profile.street}
                  onChangeText={(value) => setProfile((current) => ({ ...current, street: value }))}
                  placeholder="Street Address"
                  className="rounded-[20px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
                  placeholderTextColor="#7a978b"
                />
              </View>

              <View>
                <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">Pincode</Text>
                <TextInput
                  value={profile.pincode}
                  onChangeText={async (v) => {
                    const pincode = v.replace(/\D/g, '');
                    setProfile(f => ({ ...f, pincode }));
                    if (pincode.length === 6) {
                      const result = await lookupPincode(pincode);
                      if (result) {
                        setProfile(prev => ({
                          ...prev,
                          state: result.state,
                          city: result.district,
                        }));
                      }
                    }
                  }}
                  placeholder="Pincode"
                  keyboardType="number-pad"
                  maxLength={6}
                  className="rounded-[20px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
                  placeholderTextColor="#7a978b"
                />
              </View>

              <View>
                <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">State</Text>
                <Pressable 
                  onPress={() => setStateModalVisible(true)}
                  className="rounded-[20px] border border-primary-100 bg-primary-50 px-4 py-4"
                >
                  <Text style={{ color: profile.state ? '#143D2E' : '#7a978b' }} className="text-base font-medium">
                    {profile.state || 'Select State'}
                  </Text>
                </Pressable>
              </View>

              <View>
                <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">District / City</Text>
                {STATE_DISTRICTS[profile.state] ? (
                  <Pressable 
                    onPress={() => setDistrictModalVisible(true)}
                    className="rounded-[20px] border border-primary-100 bg-primary-50 px-4 py-4"
                  >
                    <Text style={{ color: profile.city ? '#143D2E' : '#7a978b' }} className="text-base font-medium">
                      {profile.city || 'Select District'}
                    </Text>
                  </Pressable>
                ) : (
                  <TextInput
                    value={profile.city}
                    onChangeText={(value) => setProfile((current) => ({ ...current, city: value }))}
                    placeholder="District / City"
                    className="rounded-[20px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
                    placeholderTextColor="#7a978b"
                  />
                )}
              </View>

              <View>
                <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">Landmark (Optional)</Text>
                <TextInput
                  value={profile.landmark}
                  onChangeText={(value) => setProfile((current) => ({ ...current, landmark: value }))}
                  placeholder="Landmark"
                  className="rounded-[20px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
                  placeholderTextColor="#7a978b"
                />
              </View>
            </View>
          )}
        </View>

        <SelectionModal
          visible={stateModalVisible}
          onClose={() => setStateModalVisible(false)}
          title="Select State"
          options={INDIAN_STATES}
          selectedValue={profile.state}
          onSelect={(state) => setProfile(f => ({ ...f, state, city: '' }))}
        />

        <SelectionModal
          visible={districtModalVisible}
          onClose={() => setDistrictModalVisible(false)}
          title="Select District"
          options={STATE_DISTRICTS[profile.state] || []}
          selectedValue={profile.city}
          onSelect={(city) => setProfile(f => ({ ...f, city }))}
        />

        {/* Action Buttons */}
        <Pressable
          onPress={handleSaveProfile}
          disabled={isSaving}
          className="rounded-full bg-primary-500 py-4 active:scale-95 shadow-sm"
          style={{ opacity: isSaving ? 0.6 : 1 }}
        >
          <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">
            {isSaving ? 'Saving...' : 'Save Profile'}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleDeleteAccount}
          className="mt-5 rounded-full bg-rose-50 border border-rose-100 py-4 active:scale-95"
        >
          <Text className="text-center text-xs font-black uppercase tracking-[2px] text-rose-600">Delete Account</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
