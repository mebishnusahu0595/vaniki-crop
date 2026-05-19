import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
  Image,
} from 'react-native';
import { adminApi } from '../../utils/api';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

const Icon = Feather as any;

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export default function SignupScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  
  // Feedback States
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [storeName, setStoreName] = useState('');
  const [storeLocation, setStoreLocation] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [sgstNumber, setSgstNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  
  // Image State
  const [selectedImage, setSelectedImage] = useState<{ uri: string; name: string; type: string } | null>(null);

  // 1. Native Geolocation & Address Suggestion
  const handleDetectLocation = async () => {
    setLocating(true);
    setError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission is required to detect coordinates.');
        setLocating(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude: lat, longitude: lng } = location.coords;
      setLatitude(lat);
      setLongitude(lng);

      // Perform Address Reverse Geocoding for automatic address suggestion!
      const [addressDetails] = await Location.reverseGeocodeAsync({
        latitude: lat,
        longitude: lng,
      });

      if (addressDetails) {
        const parts = [
          addressDetails.streetNumber,
          addressDetails.street,
          addressDetails.name,
          addressDetails.subregion,
          addressDetails.city,
          addressDetails.district,
          addressDetails.region,
          addressDetails.postalCode,
        ].filter(Boolean);

        const suggestedAddress = parts.join(', ');
        if (suggestedAddress) {
          setStoreLocation(suggestedAddress);
        } else {
          setStoreLocation(`Detected at Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`);
        }
      } else {
        setStoreLocation(`Detected at Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`);
      }
    } catch (err: any) {
      setError(err.message || 'Unable to retrieve your current location.');
    } finally {
      setLocating(false);
    }
  };

  // 2. Native Image Picker Flow
  const handleSelectImage = async () => {
    setError('');
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setError('Storage permissions are required to upload a profile image.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        // Extract native parameters for multipart file creation
        const uri = asset.uri;
        const fileType = asset.mimeType || 'image/jpeg';
        const fileName = asset.fileName || `dealer_${Date.now()}.jpg`;

        setSelectedImage({
          uri,
          name: fileName,
          type: fileType,
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to open image gallery.');
    }
  };

  // 3. Complete validations
  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!name.trim()) errors.name = 'Full name is required';
    
    if (!mobile.trim()) {
      errors.mobile = 'Mobile number is required';
    } else if (!/^[6-9]\d{9}$/.test(mobile.trim())) {
      errors.mobile = 'Enter a valid 10-digit Indian mobile number';
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Enter a valid email address';
    }

    if (!storeName.trim()) errors.storeName = 'Store name is required';
    if (!storeLocation.trim()) errors.storeLocation = 'Store address is required';

    const gstUpper = gstNumber.toUpperCase().trim();
    const sgstUpper = sgstNumber.toUpperCase().trim();

    if (!gstUpper) {
      errors.gstNumber = 'GST number is required';
    } else if (!GSTIN_PATTERN.test(gstUpper)) {
      errors.gstNumber = 'Enter a valid 15-digit GSTIN (e.g., 27ABCDE1234F1Z5)';
    }

    if (!sgstUpper) {
      errors.sgstNumber = 'SGST number is required';
    } else if (!GSTIN_PATTERN.test(sgstUpper)) {
      errors.sgstNumber = 'Enter a valid 15-digit SGSTIN (e.g., 27ABCDE1234F1Z5)';
    }

    if (gstUpper && sgstUpper && gstUpper.slice(0, 2) !== sgstUpper.slice(0, 2)) {
      errors.sgstNumber = 'SGST state code must match GST state code';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    if (!selectedImage) {
      errors.image = 'Store profile photo is required';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSignup = async () => {
    if (!validateForm()) {
      setError('Please resolve all validation errors highlighted below.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const payload = new FormData();
      payload.append('name', name.trim());
      payload.append('mobile', mobile.trim());
      if (email.trim()) {
        payload.append('email', email.trim().toLowerCase());
      }
      payload.append('storeName', storeName.trim());
      payload.append('storeLocation', storeLocation.trim());
      
      // Send location coordinates
      payload.append('longitude', String(longitude ?? 78.9629));
      payload.append('latitude', String(latitude ?? 20.5937));
      
      payload.append('gstNumber', gstNumber.toUpperCase().trim());
      payload.append('sgstNumber', sgstNumber.toUpperCase().trim());
      payload.append('password', password);

      // Append selected profile image using the native standard file object schema
      if (selectedImage) {
        payload.append('profileImage', {
          uri: Platform.OS === 'android' ? selectedImage.uri : selectedImage.uri.replace('file://', ''),
          name: selectedImage.name,
          type: selectedImage.type,
        } as any);
      }

      await adminApi.dealerSignup(payload);
      setSuccessMsg('Registration request submitted! Please wait for Super Admin approval before logging in.');
    } catch (err: any) {
      setError(err.message || 'Failed to submit dealer registration request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View className="mb-6 flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => router.back()}
              className="rounded-full bg-emerald-50 p-2 text-emerald-800"
            >
              <Icon name="arrow-left" size={20} color="#065f46" />
            </TouchableOpacity>
            <Text className="text-lg font-black text-[#1b4d3a] tracking-wider uppercase">Dealer Register</Text>
            <View className="w-9" />
          </View>

          {/* Intro Card */}
          <View className="bg-white p-6 rounded-[2rem] shadow-sm border border-emerald-50 mb-6">
            <Text className="text-xl font-black text-slate-900">Store Onboarding</Text>
            <Text className="text-xs font-semibold text-slate-400 mt-1">
              Submit your request to join the dealer network.
            </Text>
          </View>

          {/* Feedback Messages */}
          {error ? (
            <View className="bg-rose-50 border border-rose-100 p-4 rounded-2xl mb-5">
              <Text className="text-rose-700 font-semibold text-sm">{error}</Text>
            </View>
          ) : null}

          {successMsg ? (
            <View className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl mb-5">
              <Text className="text-emerald-800 font-black text-sm">{successMsg}</Text>
              <TouchableOpacity
                onPress={() => router.replace('/(auth)/login')}
                className="mt-4 bg-[#1b4d3a] rounded-xl py-3 items-center"
              >
                <Text className="text-white font-black text-xs uppercase tracking-wider">Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Form */}
          {!successMsg && (
            <View className="bg-white p-6 rounded-[2rem] shadow-sm border border-emerald-50 space-y-5">
              
              {/* Image Picker */}
              <View className="items-center pb-2">
                <Text className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2 align-self-start w-full text-left">Store Profile Photo *</Text>
                
                {selectedImage ? (
                  <View className="relative w-28 h-28 rounded-2xl border-2 border-emerald-500 overflow-hidden shadow-inner bg-slate-100">
                    <Image source={{ uri: selectedImage.uri }} className="w-full h-full object-cover" />
                    <TouchableOpacity
                      onPress={handleSelectImage}
                      className="absolute bottom-0 right-0 left-0 bg-emerald-900/80 py-1.5 items-center"
                    >
                      <Text className="text-[10px] font-black text-white uppercase tracking-wider">Change</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={handleSelectImage}
                    className="w-full h-24 border border-dashed border-slate-300 rounded-xl justify-center items-center bg-slate-50"
                  >
                    <Icon name="camera" size={24} color="#64748b" />
                    <Text className="text-xs font-bold text-slate-500 mt-1">Select Store Image</Text>
                  </TouchableOpacity>
                )}
                
                {fieldErrors.image ? (
                  <Text className="text-rose-600 text-xs font-semibold mt-1.5 w-full text-left">{fieldErrors.image}</Text>
                ) : null}
              </View>

              {/* Dealer Name */}
              <View>
                <Text className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Dealer Name *</Text>
                <TextInput
                  className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-slate-900 text-sm font-semibold ${
                    fieldErrors.name ? 'border-rose-300 bg-rose-50/20' : 'border-slate-100'
                  }`}
                  placeholder="Enter your full name"
                  value={name}
                  onChangeText={setName}
                />
                {fieldErrors.name ? (
                  <Text className="text-rose-600 text-xs font-semibold mt-1">{fieldErrors.name}</Text>
                ) : null}
              </View>

              {/* Mobile Number */}
              <View>
                <Text className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Mobile Number *</Text>
                <TextInput
                  className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-slate-900 text-sm font-semibold ${
                    fieldErrors.mobile ? 'border-rose-300 bg-rose-50/20' : 'border-slate-100'
                  }`}
                  placeholder="Enter 10-digit mobile"
                  value={mobile}
                  onChangeText={setMobile}
                  keyboardType="numeric"
                />
                {fieldErrors.mobile ? (
                  <Text className="text-rose-600 text-xs font-semibold mt-1">{fieldErrors.mobile}</Text>
                ) : null}
              </View>

              {/* Email */}
              <View>
                <Text className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Email Address</Text>
                <TextInput
                  className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-slate-900 text-sm font-semibold ${
                    fieldErrors.email ? 'border-rose-300 bg-rose-50/20' : 'border-slate-100'
                  }`}
                  placeholder="Enter email (optional)"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {fieldErrors.email ? (
                  <Text className="text-rose-600 text-xs font-semibold mt-1">{fieldErrors.email}</Text>
                ) : null}
              </View>

              {/* Store Name */}
              <View>
                <Text className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Store Name *</Text>
                <TextInput
                  className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-slate-900 text-sm font-semibold ${
                    fieldErrors.storeName ? 'border-rose-300 bg-rose-50/20' : 'border-slate-100'
                  }`}
                  placeholder="Enter store designation"
                  value={storeName}
                  onChangeText={setStoreName}
                />
                {fieldErrors.storeName ? (
                  <Text className="text-rose-600 text-xs font-semibold mt-1">{fieldErrors.storeName}</Text>
                ) : null}
              </View>

              {/* Store Location */}
              <View>
                <View className="flex-row items-center justify-between mb-1.5">
                  <Text className="text-xs font-black uppercase tracking-wider text-slate-500">Store Address *</Text>
                  
                  {/* Live Detect Location Button */}
                  <TouchableOpacity
                    onPress={handleDetectLocation}
                    disabled={locating}
                    className="flex-row items-center bg-emerald-50 px-3 py-1 rounded-full"
                  >
                    {locating ? (
                      <ActivityIndicator size="small" color="#047857" className="mr-1" />
                    ) : (
                      <Icon name="map-pin" size={10} color="#047857" className="mr-1" />
                    )}
                    <Text className="text-[10px] font-black text-emerald-800 uppercase">
                      {locating ? 'Detecting...' : 'Detect GPS Location'}
                    </Text>
                  </TouchableOpacity>
                </View>
                
                <TextInput
                  className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-slate-900 text-sm font-semibold ${
                    fieldErrors.storeLocation ? 'border-rose-300 bg-rose-50/20' : 'border-slate-100'
                  }`}
                  placeholder="Enter detailed address or auto-detect GPS"
                  value={storeLocation}
                  onChangeText={setStoreLocation}
                  multiline
                />
                
                {fieldErrors.storeLocation ? (
                  <Text className="text-rose-600 text-xs font-semibold mt-1">{fieldErrors.storeLocation}</Text>
                ) : null}
                
                {latitude && longitude ? (
                  <Text className="text-[10px] font-bold text-slate-400 mt-1">
                    Geo Coordinates Captured: {latitude.toFixed(5)}, {longitude.toFixed(5)}
                  </Text>
                ) : null}
              </View>

              {/* GST Number */}
              <View>
                <Text className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">GST Number *</Text>
                <TextInput
                  className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-slate-900 text-sm font-semibold uppercase ${
                    fieldErrors.gstNumber ? 'border-rose-300 bg-rose-50/20' : 'border-slate-100'
                  }`}
                  placeholder="27ABCDE1234F1Z5"
                  value={gstNumber}
                  onChangeText={setGstNumber}
                  autoCapitalize="characters"
                />
                {fieldErrors.gstNumber ? (
                  <Text className="text-rose-600 text-xs font-semibold mt-1">{fieldErrors.gstNumber}</Text>
                ) : null}
              </View>

              {/* SGST Number */}
              <View>
                <Text className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">SGST Number *</Text>
                <TextInput
                  className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-slate-900 text-sm font-semibold uppercase ${
                    fieldErrors.sgstNumber ? 'border-rose-300 bg-rose-50/20' : 'border-slate-100'
                  }`}
                  placeholder="27ABCDE1234F1Z5"
                  value={sgstNumber}
                  onChangeText={setSgstNumber}
                  autoCapitalize="characters"
                />
                {fieldErrors.sgstNumber ? (
                  <Text className="text-rose-600 text-xs font-semibold mt-1">{fieldErrors.sgstNumber}</Text>
                ) : null}
              </View>

              {/* Password */}
              <View>
                <Text className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Secure Password *</Text>
                <View className={`flex-row items-center bg-slate-50 border rounded-xl px-4 ${
                  fieldErrors.password ? 'border-rose-300 bg-rose-50/20' : 'border-slate-100'
                }`}>
                  <TextInput
                    className="flex-1 py-3 text-slate-900 text-sm font-semibold"
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(p => !p)} className="p-1">
                    <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
                {fieldErrors.password ? (
                  <Text className="text-rose-600 text-xs font-semibold mt-1">{fieldErrors.password}</Text>
                ) : null}
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleSignup}
                disabled={loading}
                className="w-full bg-[#1b4d3a] rounded-2xl py-4 items-center mt-4 shadow-sm"
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-black text-base uppercase tracking-wider">Submit Request</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Switch Back to Login */}
          <View className="flex-row justify-center items-center mt-6">
            <Text className="text-sm text-slate-500 font-semibold">Already have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
              <Text className="text-sm text-[#1b4d3a] font-black">Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
