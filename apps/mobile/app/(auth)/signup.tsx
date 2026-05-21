import { useState } from 'react';
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

  const handleDetectLocation = async () => {
    if (!isMobileVerified) return;
    setDetecting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to detect your address.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (address) {
        setForm(prev => ({
          ...prev,
          address: `${address.name || ''} ${address.street || ''}`.trim(),
          district: address.district || address.city || address.subregion || '',
          state: address.region || '',
          pincode: address.postalCode || '',
        }));
      }
    } catch (error) {
      Alert.alert('Detection failed', 'Could not detect your location. Please enter manually.');
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
          <View className="mt-10 rounded-[32px] bg-white p-8">
            <Text className="text-[11px] font-black uppercase tracking-[2px] text-primary-400">Create Account</Text>
            <Text className="mt-3 text-3xl font-black text-primary-900">Start shopping with Vaniki Crop.</Text>
            
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
                    className="flex-1 rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
                    placeholderTextColor="#7a978b"
                  />
                  {isMobileVerified ? (
                    <View className="rounded-full bg-emerald-100 px-3 py-3.5 flex-row items-center gap-1.5 border border-emerald-200">
                      <Feather name="check-circle" size={14} color="#059669" />
                      <Text className="text-xs font-black uppercase text-emerald-700">Verified</Text>
                    </View>
                  ) : (
                    <Pressable
                      disabled={isSendingOtp || !form.mobile || form.mobile.length !== 10}
                      onPress={handleSendOtp}
                      className="rounded-[22px] bg-primary-900 px-4 py-4 disabled:opacity-50"
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

              {/* Other Registration fields wrapped with opacity & editable conditions */}
              <View style={{ opacity: isMobileVerified ? 1 : 0.5 }} className="gap-3">
                <View>
                  <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">Full Name</Text>
                  <TextInput
                    value={form.name}
                    onChangeText={(value) => setForm((current) => ({ ...current, name: value }))}
                    onFocus={onInputFocus}
                    placeholder="Full Name"
                    editable={isMobileVerified}
                    className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
                    placeholderTextColor="#7a978b"
                  />
                </View>

                <View>
                  <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">Email Address</Text>
                  <TextInput
                    value={form.email}
                    onChangeText={(value) => setForm((current) => ({ ...current, email: value }))}
                    onFocus={onInputFocus}
                    placeholder="Email Address"
                    keyboardType="email-address"
                    editable={isMobileVerified}
                    className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
                    placeholderTextColor="#7a978b"
                  />
                </View>

                <View className="mt-2 rounded-3xl bg-primary-50/50 p-4 border border-primary-100">
                  <View className="flex-row items-center justify-between mb-4">
                    <Text className="text-xs font-black uppercase tracking-widest text-primary-900">Address Details</Text>
                    <Pressable 
                      onPress={handleDetectLocation} 
                      disabled={!isMobileVerified || detecting}
                      className="flex-row items-center bg-primary-500 px-3 py-2 rounded-full disabled:opacity-50"
                    >
                      {detecting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Feather name="map-pin" size={12} color="#fff" />
                          <Text className="ml-1.5 text-[10px] font-black text-white uppercase">Detect</Text>
                        </>
                      )}
                    </Pressable>
                  </View>

                  <View className="gap-4">
                    <View>
                      <Text className="mb-2 ml-1 text-[10px] font-black uppercase tracking-[1px] text-primary-900/60">Street / Village / House No</Text>
                      <TextInput
                        value={form.address}
                        onChangeText={(v) => setForm(f => ({ ...f, address: v }))}
                        placeholder="Enter address"
                        editable={isMobileVerified}
                        className="rounded-2xl border border-primary-100 bg-white px-4 py-4 text-sm text-primary-900"
                        placeholderTextColor="#7a978b"
                      />
                    </View>
                    <View className="flex-row gap-2">
                      <View className="flex-1">
                        <Text className="mb-2 ml-1 text-[10px] font-black uppercase tracking-[1px] text-primary-900/60">State</Text>
                        <Pressable 
                          onPress={() => isMobileVerified && setStateModalVisible(true)}
                          className="rounded-2xl border border-primary-100 bg-white px-4 py-4"
                        >
                          <Text style={{ color: form.state ? '#143D2E' : '#7a978b' }} className="text-sm font-medium">
                            {form.state || 'Select State'}
                          </Text>
                        </Pressable>
                      </View>
                      <View className="flex-1">
                        <Text className="mb-2 ml-1 text-[10px] font-black uppercase tracking-[1px] text-primary-900/60">District</Text>
                        {STATE_DISTRICTS[form.state] ? (
                          <Pressable 
                            onPress={() => isMobileVerified && setDistrictModalVisible(true)}
                            className="rounded-2xl border border-primary-100 bg-white px-4 py-4"
                          >
                            <Text style={{ color: form.district ? '#143D2E' : '#7a978b' }} className="text-sm font-medium">
                              {form.district || 'Select District'}
                            </Text>
                          </Pressable>
                        ) : (
                          <TextInput
                            value={form.district}
                            onChangeText={(v) => setForm(f => ({ ...f, district: v }))}
                            placeholder="District"
                            editable={isMobileVerified}
                            className="rounded-2xl border border-primary-100 bg-white px-4 py-4 text-sm text-primary-900"
                            placeholderTextColor="#7a978b"
                          />
                        )}
                      </View>
                    </View>
                    <View>
                      <Text className="mb-2 ml-1 text-[10px] font-black uppercase tracking-[1px] text-primary-900/60">Pincode</Text>
                      <TextInput
                        value={form.pincode}
                        onChangeText={async (v) => {
                          if (!isMobileVerified) return;
                          const pincode = v.replace(/\D/g, '');
                          setForm(f => ({ ...f, pincode }));
                          if (pincode.length === 6) {
                            const result = await lookupPincode(pincode);
                            if (result) {
                              setForm(prev => ({
                                ...prev,
                                state: result.state,
                                district: result.district,
                              }));
                            }
                          }
                        }}
                        placeholder="400001"
                        keyboardType="number-pad"
                        maxLength={6}
                        editable={isMobileVerified}
                        className="rounded-2xl border border-primary-100 bg-white px-4 py-4 text-sm text-primary-900"
                        placeholderTextColor="#7a978b"
                      />
                    </View>
                  </View>
                </View>

                <SelectionModal
                  visible={stateModalVisible}
                  onClose={() => setStateModalVisible(false)}
                  title="Select State"
                  options={INDIAN_STATES}
                  selectedValue={form.state}
                  onSelect={(state) => setForm(f => ({ ...f, state, district: '' }))}
                />

                <SelectionModal
                  visible={districtModalVisible}
                  onClose={() => setDistrictModalVisible(false)}
                  title="Select District"
                  options={STATE_DISTRICTS[form.state] || []}
                  selectedValue={form.district}
                  onSelect={(district) => setForm(f => ({ ...f, district }))}
                />

                <View>
                  <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">Password</Text>
                  <View className="relative">
                    <TextInput
                      value={form.password}
                      onChangeText={(value) => setForm((current) => ({ ...current, password: value }))}
                      onFocus={onInputFocus}
                      placeholder="Password"
                      secureTextEntry={!showPassword}
                      editable={isMobileVerified}
                      className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4 pr-12 text-base text-primary-900"
                      placeholderTextColor="#7a978b"
                    />
                    <Pressable
                      onPress={() => isMobileVerified && setShowPassword((current) => !current)}
                      className="absolute right-4 top-1/2 -mt-3 h-6 w-6 items-center justify-center"
                      hitSlop={8}
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
                    editable={isMobileVerified}
                    className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
                    placeholderTextColor="#7a978b"
                  />
                </View>
              </View>
            </View>

            <Pressable
              onPress={async () => {
                if (!isMobileVerified) {
                  Alert.alert('Verification required', 'Please verify your mobile number first.');
                  return;
                }
                if (!form.name || !form.password) {
                  Alert.alert('Missing details', 'Please fill in your name and password.');
                  return;
                }
                setLoading(true);
                try {
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
              className="mt-6 rounded-full bg-primary-500 px-5 py-4"
            >
              <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">
                {loading ? 'Creating account...' : 'Create Account'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
