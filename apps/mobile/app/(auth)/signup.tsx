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

  const handleDetectLocation = async () => {
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
              {([
                ['name', 'Full Name'],
                ['email', 'Email Address'],
                ['mobile', 'Mobile Number'],
              ] as const).map(([key, label]) => (
                <View key={key}>
                  <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">{label}</Text>
                  <TextInput
                    value={form[key]}
                    onChangeText={(value) => setForm((current) => ({ ...current, [key]: value }))}
                    onFocus={onInputFocus}
                    placeholder={label}
                    keyboardType={key === 'mobile' ? 'number-pad' : 'default'}
                    className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
                    placeholderTextColor="#7a978b"
                  />
                </View>
              ))}

              <View className="mt-2 rounded-3xl bg-primary-50/50 p-4 border border-primary-100">
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-xs font-black uppercase tracking-widest text-primary-900">Address Details</Text>
                  <Pressable 
                    onPress={handleDetectLocation} 
                    disabled={detecting}
                    className="flex-row items-center bg-primary-500 px-3 py-2 rounded-full"
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
                      className="rounded-2xl border border-primary-100 bg-white px-4 py-4 text-sm text-primary-900"
                      placeholderTextColor="#7a978b"
                    />
                  </View>
                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <Text className="mb-2 ml-1 text-[10px] font-black uppercase tracking-[1px] text-primary-900/60">District</Text>
                      <TextInput
                        value={form.district}
                        onChangeText={(v) => setForm(f => ({ ...f, district: v }))}
                        placeholder="District"
                        className="rounded-2xl border border-primary-100 bg-white px-4 py-4 text-sm text-primary-900"
                        placeholderTextColor="#7a978b"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="mb-2 ml-1 text-[10px] font-black uppercase tracking-[1px] text-primary-900/60">State</Text>
                      <TextInput
                        value={form.state}
                        onChangeText={(v) => setForm(f => ({ ...f, state: v }))}
                        placeholder="State"
                        className="rounded-2xl border border-primary-100 bg-white px-4 py-4 text-sm text-primary-900"
                        placeholderTextColor="#7a978b"
                      />
                    </View>
                  </View>
                  <View>
                    <Text className="mb-2 ml-1 text-[10px] font-black uppercase tracking-[1px] text-primary-900/60">Pincode</Text>
                    <TextInput
                      value={form.pincode}
                      onChangeText={(v) => setForm(f => ({ ...f, pincode: v.replace(/\D/g, '') }))}
                      placeholder="400001"
                      keyboardType="number-pad"
                      maxLength={6}
                      className="rounded-2xl border border-primary-100 bg-white px-4 py-4 text-sm text-primary-900"
                      placeholderTextColor="#7a978b"
                    />
                  </View>
                </View>
              </View>

              <View>
                <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">Password</Text>
                <View className="relative">
                  <TextInput
                    value={form.password}
                    onChangeText={(value) => setForm((current) => ({ ...current, password: value }))}
                    onFocus={onInputFocus}
                    placeholder="Password"
                    secureTextEntry={!showPassword}
                    className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4 pr-12 text-base text-primary-900"
                    placeholderTextColor="#7a978b"
                  />
                  <Pressable
                    onPress={() => setShowPassword((current) => !current)}
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
                  className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
                  placeholderTextColor="#7a978b"
                />
              </View>
            </View>

            <Pressable
              onPress={async () => {
                setLoading(true);
                try {
                  const response = await storefrontApi.signup({
                    name: form.name,
                    email: form.email,
                    mobile: form.mobile,
                    password: form.password,
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
              disabled={loading}
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
