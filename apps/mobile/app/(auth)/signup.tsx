import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Screen } from '../../src/components/Screen';
import { storefrontApi } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useServiceModeStore } from '../../src/store/useServiceModeStore';
import { useStoreStore } from '../../src/store/useStoreStore';
import { useFocusAwareScroll } from '../../src/hooks/useFocusAwareScroll';
import type { AuthUser } from '../../src/types/storefront';
import { INDIAN_STATES, STATE_DISTRICTS } from '@vaniki/shared';
import { lookupPincode } from '../../src/utils/pincode';
import { SelectionModal } from '../../src/components/SelectionModal';
import { getCachedUserLocation, getOrCreateVisitorId, requestLocationAndTrack } from '../../src/utils/telemetry';

export default function SignupScreen() {
  const setSession = useAuthStore((state) => state.setSession);
  const setUser = useAuthStore((state) => state.setUser);
  const setMode = useServiceModeStore((state) => state.setMode);
  const setAddress = useServiceModeStore((state) => state.setAddress);
  const setStore = useStoreStore((state) => state.setStore);
  const params = useLocalSearchParams<{ ref?: string }>();
  
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [stateModalVisible, setStateModalVisible] = useState(false);
  const [districtModalVisible, setDistrictModalVisible] = useState(false);
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);

  // OTP Verification state
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isMobileVerified, setIsMobileVerified] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    mobile: '',
    password: '',
    address: '',
    district: '',
    state: '',
    pincode: '',
    referralCode: typeof params.ref === 'string' ? params.ref : '',
  });
  const { scrollRef, onInputFocus } = useFocusAwareScroll(110);

  // Auto-detect user GPS coordinates and location on signup screen load
  useEffect(() => {
    void handleDetectLocation(true);
  }, []);

  const handleSendOtp = async () => {
    if (!form.mobile || !/^[6-9]\d{9}$/.test(form.mobile)) {
      Alert.alert('Invalid', 'Enter a valid 10-digit mobile number.');
      return;
    }
    setIsSendingOtp(true);
    try {
      await storefrontApi.sendOtp({ mobile: form.mobile });
      setIsOtpSent(true);
      Alert.alert('Success', 'OTP sent successfully.');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to send OTP.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length !== 4) {
      Alert.alert('Invalid', 'Enter the 4-digit OTP.');
      return;
    }
    setIsVerifyingOtp(true);
    try {
      await storefrontApi.verifyOtp({ mobile: form.mobile, otp: otpCode });
      setIsMobileVerified(true);
      Alert.alert('Success', 'Mobile number verified successfully.');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Invalid OTP.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleDetectLocation = async (silent = false) => {
    setDetecting(true);
    try {
      // 1. Check if cached location exists first
      const cached = await getCachedUserLocation();
      if (cached && cached.coordinates) {
        setCoordinates({
          latitude: cached.coordinates.latitude,
          longitude: cached.coordinates.longitude,
        });
        if (cached.location) {
          setForm((prev) => ({
            ...prev,
            address: prev.address || cached.location?.formattedAddress || '',
            district: prev.district || cached.location?.district || '',
            state: prev.state || cached.location?.state || '',
            pincode: prev.pincode || cached.location?.pincode || '',
          }));
        }
      }

      // 2. Fetch fresh live GPS coordinates
      const fresh = await requestLocationAndTrack({
        promptPermission: !silent,
        userMobile: form.mobile,
        userName: form.name,
        url: '/signup',
      });

      if (fresh && fresh.coordinates) {
        setCoordinates({
          latitude: fresh.coordinates.latitude,
          longitude: fresh.coordinates.longitude,
        });

        if (fresh.location) {
          setForm((prev) => ({
            ...prev,
            address: fresh.location?.formattedAddress || prev.address,
            district: fresh.location?.district || prev.district,
            state: fresh.location?.state || prev.state,
            pincode: fresh.location?.pincode || prev.pincode,
          }));
        }
      }
    } catch (error) {
      if (!silent) {
        Alert.alert('Detection failed', 'Could not detect your location. Please enter manually.');
      }
    } finally {
      setDetecting(false);
    }
  };

  const applySessionPreferences = (session: AuthUser) => {
    setMode(session.serviceMode);
    setAddress(session.savedAddress || null);
    if (session.serviceMode === 'pickup' && session.selectedStore && typeof session.selectedStore !== 'string') {
      setStore(session.selectedStore);
      return;
    }
    if (session.serviceMode === 'delivery' || !session.selectedStore) {
      setStore(null);
    }
  };

  return (
    <Screen withServiceBar={false} scroll={false} keyboardAware={false}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: 300 }}
        >
          <View className="mt-6 rounded-[32px] bg-white p-6 md:p-8 shadow-xs border border-primary-100">
            <Text className="text-[11px] font-black uppercase tracking-[2px] text-primary-500">Create Account</Text>
            <Text className="mt-2 text-2xl font-black text-primary-900">Start shopping with Vaniki Crop.</Text>
            
            <View className="mt-6 gap-3">
              {/* Mobile Number Input with Verification Locks */}
              <View>
                <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">Mobile Number</Text>
                <View className="flex-row items-center gap-2">
                  <TextInput
                    value={form.mobile}
                    onChangeText={(value) => setForm((current) => ({ ...current, mobile: value.replace(/\D/g, '').slice(0, 10) }))}
                    onFocus={onInputFocus}
                    placeholder="Mobile Number"
                    keyboardType="number-pad"
                    maxLength={10}
                    editable={!isMobileVerified}
                    className="flex-1 rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-3.5 text-base text-primary-900"
                    placeholderTextColor="#7a978b"
                  />
                  {isMobileVerified ? (
                    <View className="rounded-full bg-emerald-100 px-3 py-3 flex-row items-center gap-1.5 border border-emerald-200">
                      <Feather name="check-circle" size={14} color="#059669" />
                      <Text className="text-xs font-black uppercase text-emerald-700">Verified</Text>
                    </View>
                  ) : (
                    <Pressable
                      disabled={isSendingOtp || !form.mobile || form.mobile.length !== 10}
                      onPress={handleSendOtp}
                      className="rounded-[22px] bg-primary-900 px-4 py-3.5 disabled:opacity-50"
                    >
                      <Text className="text-xs font-black uppercase text-white tracking-[1px]">
                        {isSendingOtp ? 'Sending...' : isOtpSent ? 'Resend' : 'Send OTP'}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>

              {/* OTP Entry Field */}
              {isOtpSent && !isMobileVerified && (
                <View className="rounded-3xl border border-primary-100 bg-primary-50/50 p-4 animate-fadeIn">
                  <Text className="mb-2 ml-1 text-[10px] font-black uppercase tracking-[1.5px] text-primary-900/60 text-center">Enter 4-Digit OTP</Text>
                  <View className="flex-row items-center gap-2 justify-center">
                    <TextInput
                      value={otpCode}
                      onChangeText={(value) => setOtpCode(value.replace(/\D/g, '').slice(0, 4))}
                      onFocus={onInputFocus}
                      placeholder="0000"
                      keyboardType="number-pad"
                      maxLength={4}
                      className="w-32 rounded-2xl border border-primary-100 bg-white px-4 py-3 text-center text-lg font-bold tracking-[4px] text-primary-900"
                      placeholderTextColor="#7a978b"
                    />
                    <Pressable
                      disabled={isVerifyingOtp || otpCode.length !== 4}
                      onPress={handleVerifyOtp}
                      className="rounded-2xl bg-primary-500 px-5 py-3.5 disabled:opacity-50"
                    >
                      <Text className="text-xs font-black uppercase text-white tracking-[1px]">
                        {isVerifyingOtp ? 'Verifying...' : 'Verify'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Form details */}
              <View className="gap-3 mt-1">
                <View>
                  <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">Full Name</Text>
                  <TextInput
                    value={form.name}
                    onChangeText={(value) => setForm((current) => ({ ...current, name: value }))}
                    onFocus={onInputFocus}
                    placeholder="Farmer / Customer Name"
                    className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-3.5 text-base text-primary-900"
                    placeholderTextColor="#7a978b"
                  />
                </View>

                <View>
                  <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">Email Address (Optional)</Text>
                  <TextInput
                    value={form.email}
                    onChangeText={(value) => setForm((current) => ({ ...current, email: value }))}
                    onFocus={onInputFocus}
                    placeholder="email@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-3.5 text-base text-primary-900"
                    placeholderTextColor="#7a978b"
                  />
                </View>

                {/* Auto Location & Address */}
                <View className="gap-3">
                  <View className="flex-row items-center justify-between">
                    <Text className="mb-1 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">
                      Delivery Address & Location
                    </Text>
                    <Pressable
                      disabled={detecting}
                      onPress={() => handleDetectLocation(false)}
                      className="flex-row items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 border border-emerald-200 active:scale-95"
                    >
                      {detecting ? (
                        <ActivityIndicator size="small" color="#166534" />
                      ) : (
                        <Feather name="map-pin" size={13} color="#166534" />
                      )}
                      <Text className="text-[10px] font-black uppercase text-emerald-800 tracking-[0.5px]">
                        {detecting ? 'Detecting...' : coordinates ? 'GPS Detected ✓' : 'Auto Detect'}
                      </Text>
                    </Pressable>
                  </View>

                  <TextInput
                    value={form.address}
                    onChangeText={(value) => setForm((current) => ({ ...current, address: value }))}
                    onFocus={onInputFocus}
                    placeholder="Village / House / Street Name"
                    className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-3.5 text-base text-primary-900"
                    placeholderTextColor="#7a978b"
                  />

                  {/* Pincode with instant lookup */}
                  <View>
                    <TextInput
                      value={form.pincode}
                      onChangeText={async (value) => {
                        const cleanPincode = value.replace(/\D/g, '').slice(0, 6);
                        setForm((current) => ({ ...current, pincode: cleanPincode }));
                        if (cleanPincode.length === 6) {
                          const res = await lookupPincode(cleanPincode);
                          if (res) {
                            setForm((current) => ({
                              ...current,
                              district: res.district || current.district,
                              state: res.state || current.state,
                            }));
                          }
                        }
                      }}
                      onFocus={onInputFocus}
                      placeholder="6-Digit Pincode"
                      keyboardType="number-pad"
                      maxLength={6}
                      className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-3.5 text-base text-primary-900"
                      placeholderTextColor="#7a978b"
                    />
                  </View>

                  {/* State and District Pickers */}
                  <View className="flex-row gap-3">
                    <Pressable
                      onPress={() => setStateModalVisible(true)}
                      className="flex-1 rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-3.5 justify-center"
                    >
                      <Text className={`text-sm ${form.state ? 'font-black text-primary-900' : 'text-[#7a978b]'}`} numberOfLines={1}>
                        {form.state || 'Select State'}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        if (!form.state) {
                          Alert.alert('Select State', 'Please select state first');
                          return;
                        }
                        setDistrictModalVisible(true);
                      }}
                      className="flex-1 rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-3.5 justify-center"
                    >
                      <Text className={`text-sm ${form.district ? 'font-black text-primary-900' : 'text-[#7a978b]'}`} numberOfLines={1}>
                        {form.district || 'Select District'}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* Password Input */}
                <View>
                  <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">Password</Text>
                  <View className="flex-row items-center rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-1">
                    <TextInput
                      value={form.password}
                      onChangeText={(value) => setForm((current) => ({ ...current, password: value }))}
                      onFocus={onInputFocus}
                      placeholder="At least 6 characters"
                      secureTextEntry={!showPassword}
                      className="flex-1 py-3 text-base text-primary-900"
                      placeholderTextColor="#7a978b"
                    />
                    <Pressable
                      onPress={() => setShowPassword((prev) => !prev)}
                      hitSlop={10}
                      className="p-2"
                    >
                      <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color="#527164" />
                    </Pressable>
                  </View>
                </View>

                <View>
                  <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">Referral Code (Optional)</Text>
                  <TextInput
                    value={form.referralCode}
                    onChangeText={(value) => setForm((current) => ({ ...current, referralCode: value.toUpperCase() }))}
                    placeholder="Referral Code"
                    autoCapitalize="characters"
                    className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-3.5 text-base text-primary-900"
                    placeholderTextColor="#7a978b"
                  />
                </View>
              </View>
            </View>

            <Pressable
              onPress={async () => {
                if (!isMobileVerified) {
                  Alert.alert('Verification required', 'Please verify your mobile number first with OTP.');
                  return;
                }
                if (!form.name || !form.password) {
                  Alert.alert('Missing details', 'Please fill in your name and password.');
                  return;
                }
                setLoading(true);
                try {
                  const visitorId = await getOrCreateVisitorId();
                  const response = await storefrontApi.signup({
                    name: form.name,
                    email: form.email,
                    mobile: form.mobile,
                    password: form.password,
                    otp: otpCode,
                    address: form.address,
                    district: form.district,
                    state: form.state,
                    pincode: form.pincode,
                    latitude: coordinates?.latitude,
                    longitude: coordinates?.longitude,
                    visitorId: visitorId,
                    referralCode: form.referralCode || undefined,
                  });

                  setSession({ user: response.user, token: response.accessToken });
                  applySessionPreferences(response.user);
                  void storefrontApi
                    .me()
                    .then((session) => {
                      setUser(session);
                      applySessionPreferences(session);
                    })
                    .catch(() => undefined);
                  router.replace('/(tabs)/account');
                } catch (caughtError) {
                  Alert.alert('Signup failed', caughtError instanceof Error ? caughtError.message : 'Try again.');
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading || !isMobileVerified}
              style={{ opacity: isMobileVerified && !loading ? 1 : 0.5 }}
              className="mt-6 rounded-full bg-primary-500 px-5 py-4 justify-center h-[52px]"
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">
                  Create Account
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <SelectionModal
        visible={stateModalVisible}
        title="Select State"
        options={INDIAN_STATES}
        selectedValue={form.state}
        onSelect={(item) => {
          setForm((prev) => ({ ...prev, state: item, district: '' }));
          setStateModalVisible(false);
        }}
        onClose={() => setStateModalVisible(false)}
      />

      <SelectionModal
        visible={districtModalVisible}
        title="Select District"
        options={(STATE_DISTRICTS as Record<string, string[]>)[form.state] || []}
        selectedValue={form.district}
        onSelect={(item) => {
          setForm((prev) => ({ ...prev, district: item }));
          setDistrictModalVisible(false);
        }}
        onClose={() => setDistrictModalVisible(false)}
      />
    </Screen>
  );
}
