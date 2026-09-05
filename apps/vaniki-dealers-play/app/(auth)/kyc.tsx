import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { dealerApi } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/useAuthStore';

const Icon = Feather as any;

const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
];

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export default function DealerKYCScreen() {
  const params = useLocalSearchParams<{ phone?: string }>();
  const { setSession } = useAuthStore();

  const [mobile, setMobile] = useState(params.phone || '');
  const [storeName, setStoreName] = useState('');
  const [dealerName, setDealerName] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('');
  const [selectedState, setSelectedState] = useState('Chhattisgarh');
  const [pincode, setPincode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const [isMobileVerified, setIsMobileVerified] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [registrationOtp, setRegistrationOtp] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const [stateModalVisible, setStateModalVisible] = useState(false);
  const [stateSearch, setStateSearch] = useState('');
  const [detectingGps, setDetectingGps] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dealerPhotoUri, setDealerPhotoUri] = useState<string | null>(null);
  const [dealerPhotoBase64, setDealerPhotoBase64] = useState<string | null>(null);

  const handlePickImage = () => {
    Alert.alert(
      'Upload Store Photo',
      'Choose source for your Store Front or Dealer Photo for SuperAdmin verification.',
      [
        { text: '📷 Take Photo (Camera)', onPress: openCamera },
        { text: '🖼️ Choose from Gallery', onPress: openGallery },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true },
    );
  };

  const openCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow camera access to take your store photo.');
        return;
      }

      const res = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!res.canceled && res.assets && res.assets[0]) {
        const asset = res.assets[0];
        setDealerPhotoUri(asset.uri);
        setDealerPhotoBase64(asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : null);
      }
    } catch (err: any) {
      Alert.alert('Camera Error', 'Could not open camera: ' + (err?.message || err));
    }
  };

  const openGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow photo library access to upload your store photo.');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!res.canceled && res.assets && res.assets[0]) {
        const asset = res.assets[0];
        setDealerPhotoUri(asset.uri);
        setDealerPhotoBase64(asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : null);
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', 'Could not open photo gallery: ' + (err?.message || err));
    }
  };

  const handleSendRegistrationOtp = async () => {
    if (!mobile.trim() || mobile.trim().length !== 10) {
      Alert.alert('Validation Error', 'Please enter a valid 10-digit mobile number first.');
      return;
    }
    setSendingOtp(true);
    try {
      await dealerApi.sendRegistrationOtp(mobile.trim());
      setOtpSent(true);
      Alert.alert('OTP Sent', `A 4-digit verification code has been sent to +91 ${mobile.trim()}.`);
    } catch (err: any) {
      Alert.alert('OTP Error', err?.message || 'Failed to send verification OTP. Please try again.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyRegistrationOtp = async () => {
    if (!registrationOtp.trim() || registrationOtp.trim().length < 4) {
      Alert.alert('Validation Error', 'Please enter the 4-digit OTP received on your mobile.');
      return;
    }
    setVerifyingOtp(true);
    try {
      await dealerApi.verifyRegistrationOtp(mobile.trim(), registrationOtp.trim());
      setIsMobileVerified(true);
      Alert.alert('Mobile Verified ✓', 'Your mobile number has been verified successfully!');
    } catch (err: any) {
      Alert.alert('Verification Failed', err?.message || 'Invalid 4-digit OTP. Please check and try again.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Auto-detect GPS on screen load
  useEffect(() => {
    detectLocation(false);
  }, []);

  const detectLocation = async (userInitiated = true) => {
    setDetectingGps(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (userInitiated) {
          Alert.alert('Permission Denied', 'Please grant location access to detect your store GPS coordinates.');
        }
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLatitude(Number(loc.coords.latitude.toFixed(6)));
      setLongitude(Number(loc.coords.longitude.toFixed(6)));

      // Reverse geocode to prefill city & state if empty
      try {
        const reverse = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (reverse && reverse.length > 0) {
          const rev = reverse[0];
          if (!city && rev.city) setCity(rev.city);
          if (!pincode && rev.postalCode) setPincode(rev.postalCode);
          if (rev.region && INDIAN_STATES.includes(rev.region)) {
            setSelectedState(rev.region);
          }
          if (!area && (rev.street || rev.district)) {
            setArea([rev.street, rev.district].filter(Boolean).join(', '));
          }
        }
      } catch {
        // Reverse geocoding optional
      }
    } catch (err: any) {
      if (userInitiated) {
        Alert.alert('GPS Notice', 'Could not fetch GPS location. Ensure location is enabled on device.');
      }
    } finally {
      setDetectingGps(false);
    }
  };

  const handleSubmitKYC = async () => {
    if (!dealerName.trim()) {
      Alert.alert('Validation Error', 'Please enter Dealer full name.');
      return;
    }
    if (!mobile.trim() || mobile.length < 10) {
      Alert.alert('Validation Error', 'Please enter valid 10-digit mobile number.');
      return;
    }
    if (!storeName.trim()) {
      Alert.alert('Validation Error', 'Please enter your Store / Shop Name.');
      return;
    }

    const cleanGst = gstNumber.trim().toUpperCase();
    if (!cleanGst || cleanGst.length !== 15) {
      Alert.alert('Invalid GST Number', 'GSTIN must be exactly 15 characters long (e.g. 22AAAAA0000A1Z5).');
      return;
    }
    if (!GSTIN_REGEX.test(cleanGst)) {
      Alert.alert('Invalid GSTIN Format', 'Please enter a valid 15-character GSTIN format (e.g. 22AAAAA0000A1Z5).');
      return;
    }

    if (!city.trim()) {
      Alert.alert('Validation Error', 'Please enter your City / Town.');
      return;
    }
    if (!pincode.trim() || pincode.length !== 6) {
      Alert.alert('Validation Error', 'Please enter a valid 6-digit postal pincode.');
      return;
    }

    if (!isMobileVerified) {
      Alert.alert(
        'Mobile Verification Required',
        'Please verify your mobile number with the 4-digit OTP before submitting your store KYC.',
        [
          {
            text: 'Send 4-Digit OTP',
            onPress: () => handleSendRegistrationOtp(),
          },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: dealerName.trim(),
        mobile: mobile.trim(),
        otp: registrationOtp.trim() || undefined,
        storeName: storeName.trim(),
        gstNumber: cleanGst,
        sgstNumber: cleanGst,
        area: area.trim() || undefined,
        city: city.trim(),
        state: selectedState,
        pincode: pincode.trim(),
        latitude: latitude || 0,
        longitude: longitude || 0,
        password: password.trim() || undefined,
        profileImage: dealerPhotoBase64 || undefined,
        dealerPhoto: dealerPhotoBase64 || undefined,
      };

      const res: any = await dealerApi.dealerSignup(payload);
      const signedUpUser = res?.data?.user || res?.user;
      const token = res?.data?.accessToken || res?.accessToken;

      if (token && signedUpUser) {
        setSession({
          user: signedUpUser,
          token,
        });
      }

      if (Platform.OS === 'web') {
        alert(
          `KYC Submitted Successfully! 🎉\n\nYour store "${storeName}" has been submitted for SuperAdmin verification.\n\nOnce approved by SuperAdmin, full wholesale B2B pricing will be unlocked.`,
        );
        router.replace('/(tabs)');
      } else {
        Alert.alert(
          'KYC Submitted Successfully! 🎉',
          `Your store "${storeName}" has been submitted for SuperAdmin verification.\n\nOnce approved by SuperAdmin, full wholesale B2B pricing will be unlocked.`,
          [
            {
              text: 'Go to Dashboard',
              onPress: () => router.replace('/(tabs)'),
            },
          ],
        );
      }
    } catch (err: any) {
      Alert.alert('Registration Error', err?.message || 'Failed to submit dealer KYC. Please check your details.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredStates = INDIAN_STATES.filter((s) =>
    s.toLowerCase().includes(stateSearch.toLowerCase()),
  );

  return (
    <SafeAreaView className="flex-1 bg-offwhite" edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View className="bg-white border-b border-primary-100 px-4 py-3 flex-row items-center justify-between">
          <View className="flex-row items-center gap-2.5">
            <Pressable onPress={() => router.back()} className="p-1 rounded-xl bg-primary-50">
              <Icon name="arrow-left" size={20} color="#2D6A4F" />
            </Pressable>
            <Image
              source={require('../../assets/logo.png')}
              style={{ width: 95, height: 32 }}
              resizeMode="contain"
            />
          </View>

          <View className="rounded-full bg-amber-100 px-3 py-1 border border-amber-200">
            <Text className="text-[10px] font-black uppercase tracking-wider text-amber-800">
              Store KYC (Step 2/2)
            </Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Information Card */}
          <View className="bg-primary-50/80 rounded-3xl p-4 border border-primary-200/60 mb-5 flex-row items-start gap-3">
            <View className="w-8 h-8 rounded-xl bg-primary-600 items-center justify-center mt-0.5">
              <Icon name="shield" size={16} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-black text-primary-900">Official Dealer Verification</Text>
              <Text className="text-[11px] font-semibold text-primary-800 mt-0.5 leading-relaxed">
                Enter your registered store and GST details. SuperAdmin will verify your account to unlock wholesale B2B pricing and direct stock procurement.
              </Text>
            </View>
          </View>

          {/* Form Fields */}
          <View className="bg-white rounded-3xl p-5 border border-primary-100 shadow-xs space-y-4">
            {/* Dealer / Store Photo Upload */}
            <View>
              <Text className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">
                Dealer / Store Photo
              </Text>
              <Pressable
                onPress={handlePickImage}
                className="rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 p-4 items-center justify-center active:scale-[0.99]"
              >
                {dealerPhotoUri ? (
                  <View className="items-center">
                    <Image
                      source={{ uri: dealerPhotoUri }}
                      style={{ width: 90, height: 90, borderRadius: 20 }}
                      resizeMode="cover"
                    />
                    <View className="flex-row items-center gap-1.5 mt-2.5 bg-emerald-100 px-3 py-1 rounded-full">
                      <Icon name="check-circle" size={13} color="#15803D" />
                      <Text className="text-xs font-black text-emerald-800">Photo Selected • Tap to Change</Text>
                    </View>
                  </View>
                ) : (
                  <View className="items-center py-2">
                    <View className="w-12 h-12 rounded-2xl bg-emerald-100 items-center justify-center mb-2">
                      <Icon name="camera" size={22} color="#15803D" />
                    </View>
                    <Text className="text-xs font-black text-emerald-900">Upload Store Front or Dealer Photo</Text>
                    <Text className="text-[11px] font-semibold text-emerald-700/80 mt-0.5">
                      SuperAdmin will verify your store with this photo
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>

            {/* Dealer Full Name */}
            <View>
              <Text className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1">
                Dealer Full Name <Text className="text-rose-500">*</Text>
              </Text>
              <TextInput
                value={dealerName}
                onChangeText={setDealerName}
                placeholder="e.g. Ramesh Patel"
                placeholderTextColor="#94A3B8"
                className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs font-bold text-slate-900"
              />
            </View>

            {/* Mobile Number */}
            <View>
              <Text className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1">
                Mobile Number <Text className="text-rose-500">*</Text>
              </Text>
              <View className="flex-row items-center rounded-2xl border border-slate-200 bg-slate-50/80 px-3.5 py-0">
                <View className="flex-row items-center border-r border-slate-200 pr-2.5 py-3.5 mr-2.5 shrink-0" style={{ minWidth: 62 }}>
                  <Text className="text-base mr-1">🇮🇳</Text>
                  <Text className="text-xs font-black text-slate-900" numberOfLines={1}>+91</Text>
                </View>
                <TextInput
                  value={mobile}
                  onChangeText={(t) => {
                    const clean = t.replace(/\D/g, '').slice(0, 10);
                    setMobile(clean);
                    if (isMobileVerified) setIsMobileVerified(false);
                    if (otpSent) {
                      setOtpSent(false);
                      setRegistrationOtp('');
                    }
                  }}
                  placeholder="10-digit mobile number"
                  keyboardType="phone-pad"
                  maxLength={10}
                  placeholderTextColor="#94A3B8"
                  className="flex-1 text-xs font-bold text-slate-900 py-3.5"
                />
              </View>

              {/* Mobile Verification Status / Action */}
              {isMobileVerified ? (
                <View className="flex-row items-center gap-1.5 mt-2 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
                  <Icon name="check-circle" size={14} color="#15803D" />
                  <Text className="text-xs font-bold text-emerald-800">
                    Mobile Number Verified (4-Digit OTP) ✓
                  </Text>
                </View>
              ) : (
                <View className="mt-2">
                  {!otpSent ? (
                    <Pressable
                      onPress={handleSendRegistrationOtp}
                      disabled={sendingOtp || mobile.length !== 10}
                      className="rounded-xl py-2.5 px-3 flex-row items-center justify-center gap-1.5"
                      style={{
                        backgroundColor: mobile.length === 10 ? '#143D2E' : '#CBD5E1',
                      }}
                    >
                      {sendingOtp ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Icon name="shield" size={14} color="#FFFFFF" />
                          <Text className="text-xs font-black uppercase tracking-wider text-white">
                            Verify Number via 4-Digit OTP
                          </Text>
                        </>
                      )}
                    </Pressable>
                  ) : (
                    <View className="bg-emerald-50/70 p-3 rounded-2xl border border-emerald-200 space-y-2">
                      <Text className="text-[11px] font-bold text-emerald-900">
                        Enter 4-digit OTP sent to +91 {mobile}:
                      </Text>
                      <View className="flex-row items-center gap-2">
                        <TextInput
                          value={registrationOtp}
                          onChangeText={(t) => setRegistrationOtp(t.replace(/\D/g, '').slice(0, 4))}
                          placeholder="4-digit OTP"
                          keyboardType="number-pad"
                          maxLength={4}
                          placeholderTextColor="#94A3B8"
                          className="flex-1 rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm font-black text-center tracking-[8px] text-slate-900"
                        />
                        <Pressable
                          onPress={handleVerifyRegistrationOtp}
                          disabled={verifyingOtp || registrationOtp.length < 4}
                          className="rounded-xl px-4 py-2.5 bg-emerald-700 active:scale-95"
                          style={{
                            backgroundColor: registrationOtp.length >= 4 ? '#15803D' : '#94A3B8',
                          }}
                        >
                          {verifyingOtp ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text className="text-xs font-black text-white uppercase">Verify</Text>
                          )}
                        </Pressable>
                      </View>
                      <Pressable onPress={handleSendRegistrationOtp} disabled={sendingOtp} className="pt-1">
                        <Text className="text-[11px] font-bold text-emerald-800 text-center underline">
                          Resend 4-digit OTP
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Store / Shop Name */}
            <View>
              <Text className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1">
                Store / Shop Name <Text className="text-rose-500">*</Text>
              </Text>
              <TextInput
                value={storeName}
                onChangeText={setStoreName}
                placeholder="e.g. Kisan Krishi Kendra & Seeds"
                placeholderTextColor="#94A3B8"
                className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs font-bold text-slate-900"
              />
            </View>

            {/* GST Number */}
            <View>
              <View className="flex-row justify-between items-center mb-1">
                <Text className="text-xs font-black uppercase tracking-wider text-slate-500">
                  GST Number (GSTIN) <Text className="text-rose-500">*</Text>
                </Text>
                <Text className="text-[10px] font-bold text-slate-400">15 Characters</Text>
              </View>
              <TextInput
                value={gstNumber}
                onChangeText={(t) => setGstNumber(t.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15))}
                placeholder="e.g. 22AAAAA0000A1Z5"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
                maxLength={15}
                className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs font-mono font-bold text-slate-900"
              />
              {gstNumber.length > 0 && !GSTIN_REGEX.test(gstNumber) && (
                <Text className="text-[10px] font-bold text-rose-500 mt-1">
                  Format: 2 state digits + 10 PAN chars + 1 entity + Z + 1 check digit
                </Text>
              )}
            </View>

            {/* GPS Location Detection */}
            <View className="rounded-2xl border border-primary-200 bg-primary-50/60 p-3.5">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center gap-2">
                  <Icon name="map-pin" size={16} color="#2D6A4F" />
                  <Text className="text-xs font-black text-primary-900">Store GPS Coordinates</Text>
                </View>
                <Pressable
                  onPress={() => detectLocation(true)}
                  disabled={detectingGps}
                  className="flex-row items-center gap-1.5 bg-primary-600 px-3 py-1.5 rounded-xl active:scale-95"
                >
                  {detectingGps ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Icon name="crosshair" size={12} color="#FFFFFF" />
                      <Text className="text-[10px] font-black uppercase text-white">Detect GPS</Text>
                    </>
                  )}
                </Pressable>
              </View>

              {latitude && longitude ? (
                <View className="flex-row gap-2 mt-1">
                  <View className="flex-1 bg-white p-2 rounded-xl border border-primary-100">
                    <Text className="text-[9px] font-bold text-slate-400 uppercase">Latitude</Text>
                    <Text className="text-xs font-black text-slate-800 font-mono">{latitude}</Text>
                  </View>
                  <View className="flex-1 bg-white p-2 rounded-xl border border-primary-100">
                    <Text className="text-[9px] font-bold text-slate-400 uppercase">Longitude</Text>
                    <Text className="text-xs font-black text-slate-800 font-mono">{longitude}</Text>
                  </View>
                </View>
              ) : (
                <Text className="text-[11px] font-semibold text-primary-800/80">
                  Tap "Detect GPS" to capture your store coordinates automatically.
                </Text>
              )}
            </View>

            {/* Area / Street Address */}
            <View>
              <Text className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1">
                Area / Street / Market Location
              </Text>
              <TextInput
                value={area}
                onChangeText={setArea}
                placeholder="e.g. Near Main Mandi, Station Road"
                placeholderTextColor="#94A3B8"
                className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs font-bold text-slate-900"
              />
            </View>

            {/* City & State Row */}
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1">
                  City / Town <Text className="text-rose-500">*</Text>
                </Text>
                <TextInput
                  value={city}
                  onChangeText={setCity}
                  placeholder="e.g. Ambagarh Chauki"
                  placeholderTextColor="#94A3B8"
                  className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs font-bold text-slate-900"
                />
              </View>

              <View className="flex-1">
                <Text className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1">
                  State <Text className="text-rose-500">*</Text>
                </Text>
                <Pressable
                  onPress={() => setStateModalVisible(true)}
                  className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 flex-row items-center justify-between"
                >
                  <Text className="text-xs font-bold text-slate-900" numberOfLines={1}>
                    {selectedState}
                  </Text>
                  <Icon name="chevron-down" size={14} color="#64748B" />
                </Pressable>
              </View>
            </View>

            {/* Pincode & Optional Password */}
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1">
                  Pincode <Text className="text-rose-500">*</Text>
                </Text>
                <TextInput
                  value={pincode}
                  onChangeText={(t) => setPincode(t.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6 digits"
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholderTextColor="#94A3B8"
                  className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs font-bold text-slate-900 text-center"
                />
              </View>

              <View className="flex-1">
                <Text className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1">
                  Set Password
                </Text>
                <View className="flex-row items-center rounded-2xl border border-slate-200 bg-slate-50/80 px-2.5 py-0">
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="e.g. Vaniki@123"
                    secureTextEntry={!showPassword}
                    placeholderTextColor="#94A3B8"
                    className="flex-1 py-3.5 text-xs font-bold text-slate-900"
                  />
                  <Pressable onPress={() => setShowPassword(!showPassword)} className="p-1.5">
                    <Icon name={showPassword ? 'eye-off' : 'eye'} size={16} color="#64748B" />
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Submit Button */}
            <Pressable
              onPress={handleSubmitKYC}
              disabled={submitting}
              className="mt-4 mb-6 rounded-2xl bg-emerald-600 py-4 px-4 items-center justify-center shadow-lg shadow-emerald-600/30 active:scale-95"
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  className="text-xs font-black uppercase tracking-wider text-white text-center"
                >
                  Submit Store KYC
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>

        {/* State Selection Modal */}
        <Modal visible={stateModalVisible} transparent animationType="slide">
          <View className="flex-1 justify-end bg-black/50">
            <View className="bg-white rounded-t-[32px] p-6 max-h-[70%]">
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-base font-black text-slate-900">Select Indian State / UT</Text>
                <Pressable onPress={() => setStateModalVisible(false)} className="p-1">
                  <Icon name="x" size={20} color="#64748B" />
                </Pressable>
              </View>

              <View className="flex-row items-center rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 mb-3">
                <Icon name="search" size={16} color="#64748B" />
                <TextInput
                  value={stateSearch}
                  onChangeText={setStateSearch}
                  placeholder="Search state..."
                  placeholderTextColor="#94A3B8"
                  className="flex-1 ml-2 text-xs font-bold text-slate-900 py-0"
                />
              </View>

              <ScrollView keyboardShouldPersistTaps="handled">
                {filteredStates.map((st) => (
                  <Pressable
                    key={st}
                    onPress={() => {
                      setSelectedState(st);
                      setStateModalVisible(false);
                      setStateSearch('');
                    }}
                    className={`p-3.5 rounded-2xl mb-1.5 flex-row justify-between items-center ${
                      selectedState === st ? 'bg-primary-50 border border-primary-200' : 'bg-slate-50'
                    }`}
                  >
                    <Text className={`text-xs font-bold ${selectedState === st ? 'text-primary-900' : 'text-slate-700'}`}>
                      {st}
                    </Text>
                    {selectedState === st && <Icon name="check" size={16} color="#2D6A4F" />}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
