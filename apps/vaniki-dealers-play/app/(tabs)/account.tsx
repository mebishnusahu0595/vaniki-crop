import React, { useState, useEffect } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../src/store/useAuthStore';
import { dealerApi } from '../../src/lib/api';
import { currencyFormatter } from '../../src/utils/format';

const Icon = Feather as any;

export default function DealerAccountScreen() {
  const { user, logout, setSession, token } = useAuthStore();
  const queryClient = useQueryClient();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Fetch latest dealer profile
  const profileQuery = useQuery({
    queryKey: ['dealer-profile'],
    queryFn: dealerApi.getProfile,
  });

  useEffect(() => {
    if (profileQuery.data?.data) {
      const updatedUser = profileQuery.data.data;
      if (token) {
        setSession({ user: updatedUser, token });
      }
    }
  }, [profileQuery.data]);

  const currentUser = profileQuery.data?.data || user;
  const isApproved =
    currentUser?.approvalStatus === 'approved' ||
    currentUser?.dealerProfile?.approvalStatus === 'approved' ||
    currentUser?.role === 'storeAdmin';

  // Fetch 30-day analytics snapshot
  const analyticsQuery = useQuery({
    queryKey: ['dealer-analytics', '30d'],
    queryFn: () => dealerApi.getAnalytics('30d'),
  });

  const analytics = analyticsQuery.data?.data || analyticsQuery.data;

  const stats = [
    {
      label: 'Total Orders',
      value: analytics?.stats?.totalOrders ?? '0',
      icon: 'shopping-bag',
      color: '#2D6A4F',
      bg: '#F0FAF5',
    },
    {
      label: 'Total Revenue',
      value: analytics?.stats?.totalRevenue
        ? currencyFormatter.format(analytics.stats.totalRevenue)
        : '₹0',
      icon: 'trending-up',
      color: '#2563EB',
      bg: '#EFF6FF',
    },
    {
      label: 'Pending Orders',
      value: analytics?.stats?.pendingOrders ?? '0',
      icon: 'clock',
      color: '#D97706',
      bg: '#FFFBEB',
    },
    {
      label: 'This Month',
      value: analytics?.stats?.monthlyRevenue
        ? currencyFormatter.format(analytics.stats.monthlyRevenue)
        : '₹0',
      icon: 'calendar',
      color: '#7C3AED',
      bg: '#F5F3FF',
    },
  ];

  // Resolve Profile Image
  const profileImageUrl =
    currentUser?.profileImage?.url ||
    currentUser?.avatar?.url ||
    (typeof currentUser?.avatar === 'string' && currentUser.avatar.startsWith('http')
      ? currentUser.avatar
      : undefined) ||
    currentUser?.dealerProfile?.dealerPhoto?.url ||
    currentUser?.dealerProfile?.dealerPhoto;

  const storeName =
    currentUser?.dealerProfile?.storeName ||
    currentUser?.storeName ||
    'Registered Agro Store';

  const gstNumber =
    currentUser?.dealerProfile?.gstNumber ||
    currentUser?.gstNumber ||
    '';

  const formattedSavedAddress = currentUser?.savedAddress
    ? [
        currentUser.savedAddress.street,
        currentUser.savedAddress.landmark,
        currentUser.savedAddress.city,
        currentUser.savedAddress.district,
        currentUser.savedAddress.state,
        currentUser.savedAddress.pincode,
      ]
        .filter(Boolean)
        .join(', ')
    : '';

  const rawLocation =
    currentUser?.dealerProfile?.storeLocation ||
    currentUser?.storeLocation ||
    '';

  const storeLocation =
    rawLocation && rawLocation.trim().toLowerCase() !== 'store location'
      ? rawLocation.trim()
      : formattedSavedAddress || 'Supela, Bhilai, Durg, Chhattisgarh - 490023';

  // Edit Store Details Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editStoreName, setEditStoreName] = useState(storeName);
  const [editStoreLocation, setEditStoreLocation] = useState(storeLocation);
  const [editGstNumber, setEditGstNumber] = useState(gstNumber);
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  const handleOpenEditModal = () => {
    setEditStoreName(storeName);
    setEditStoreLocation(storeLocation);
    setEditGstNumber(gstNumber);
    setIsEditModalOpen(true);
  };

  const handleSaveStoreDetails = async () => {
    if (!editStoreName.trim()) {
      Alert.alert('Validation Error', 'Please enter a valid store name.');
      return;
    }
    if (!editStoreLocation.trim()) {
      Alert.alert('Validation Error', 'Please enter your store address/location.');
      return;
    }

    setIsSavingDetails(true);
    try {
      const response: any = await dealerApi.dealerSignup({
        name: currentUser?.name || 'Dealer Admin',
        mobile: currentUser?.mobile,
        storeName: editStoreName.trim(),
        storeLocation: editStoreLocation.trim(),
        gstNumber: editGstNumber.trim() || '22AAAAA0000A1Z5',
      });

      const updatedUser = response?.data?.user || response?.user;
      if (updatedUser && token) {
        setSession({ user: updatedUser, token });
      }

      await queryClient.invalidateQueries({ queryKey: ['dealer-profile'] });
      setIsEditModalOpen(false);
      Alert.alert('Profile Updated', 'Store details and location updated successfully!');
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not update store details.');
    } finally {
      setIsSavingDetails(false);
    }
  };

  const handleUpdatePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please grant photo access to upload your store photo.');
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
        setUploadingPhoto(true);
        const photoData = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;

        const response: any = await dealerApi.dealerSignup({
          name: currentUser?.name || 'Dealer Admin',
          mobile: currentUser?.mobile,
          storeName: storeName,
          gstNumber: gstNumber || '22AAAAA0000A1Z5',
          profileImage: photoData,
          dealerPhoto: photoData,
        });

        const updatedUser = response?.data?.user || response?.user;
        if (updatedUser && token) {
          setSession({ user: updatedUser, token });
        }

        await queryClient.invalidateQueries({ queryKey: ['dealer-profile'] });
        Alert.alert('Photo Updated', 'Your store picture has been updated successfully!');
      }
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not update photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out from Vaniki Dealers?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: () => {
          logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const menuSections = [
    {
      title: 'Business & Operations',
      items: [
        {
          icon: 'shopping-bag',
          label: 'My Bulk Orders',
          subtitle: 'Track order statuses and dispatches',
          onPress: () => router.push('/(tabs)/orders'),
        },
        {
          icon: 'file-text',
          label: 'B2B Invoices',
          subtitle: 'GST tax invoices and credit notes',
          onPress: () => router.push('/(tabs)/invoices'),
        },
        {
          icon: 'package',
          label: 'Bulk Catalogue',
          subtitle: 'View all products with MOQ pricing',
          onPress: () => router.push('/(tabs)/products'),
        },
        {
          icon: 'map-pin',
          label: 'Store Details & Location',
          subtitle: storeLocation || 'Update store address & GSTIN',
          onPress: handleOpenEditModal,
        },
      ],
    },
    {
      title: 'Support & Help',
      items: [
        {
          icon: 'phone',
          label: 'Dealer Helpline',
          subtitle: '+91 98765 43210 (Toll Free)',
          onPress: () => Linking.openURL('tel:9876543210'),
        },
        {
          icon: 'mail',
          label: 'Email Support',
          subtitle: 'support@vanikicrop.com',
          onPress: () => Linking.openURL('mailto:support@vanikicrop.com'),
        },
        {
          icon: 'shield',
          label: 'Privacy Policy',
          subtitle: 'Terms of service & privacy',
          onPress: () => Linking.openURL('https://vanikicrop.com/privacy-policy'),
        },
      ],
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-offwhite" edges={['top', 'left', 'right']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        {/* ─── Profile Header (Light Green Theme) ─── */}
        <View className="bg-[#EBF5EE] border-b border-emerald-200/80 px-5 pt-3 pb-6 rounded-b-[28px] shadow-2xs">
          <View className="flex-row items-start gap-4">
            {/* Dealer / Store Avatar with Edit Camera Button */}
            <Pressable
              onPress={handleUpdatePhoto}
              disabled={uploadingPhoto}
              className="relative active:scale-95"
            >
              <View className="w-[72px] h-[72px] rounded-[24px] overflow-hidden bg-white border-2 border-emerald-300 items-center justify-center shadow-xs">
                {uploadingPhoto ? (
                  <ActivityIndicator size="small" color="#15803D" />
                ) : profileImageUrl ? (
                  <Image
                    source={{ uri: profileImageUrl }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                    transition={200}
                  />
                ) : (
                  <View className="w-full h-full bg-emerald-100 items-center justify-center">
                    <Text className="text-2xl font-black text-emerald-800">
                      {(currentUser?.name || 'D').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>

              {/* Camera Icon Overlay */}
              <View className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-700 items-center justify-center border-2 border-white shadow-2xs">
                <Icon name="camera" size={11} color="#FFFFFF" />
              </View>
            </Pressable>

            {/* Dealer Details */}
            <View className="flex-1">
              <View className="flex-row items-center gap-2 flex-wrap">
                <Text className="text-xl font-black text-emerald-950">
                  {currentUser?.name || 'Dealer Admin'}
                </Text>
                <View
                  className={`rounded-full px-2.5 py-0.5 border ${
                    isApproved
                      ? 'bg-emerald-100 border-emerald-300'
                      : 'bg-amber-100 border-amber-300'
                  }`}
                >
                  <Text
                    className={`text-[9px] font-black uppercase tracking-wider ${
                      isApproved ? 'text-emerald-800' : 'text-amber-800'
                    }`}
                  >
                    {isApproved ? '✓ VERIFIED' : '⏳ KYC PENDING'}
                  </Text>
                </View>
              </View>

              <Text className="text-xs font-bold text-emerald-850 mt-0.5" numberOfLines={1}>
                🏪 {storeName}
              </Text>

              <Text className="text-xs font-semibold text-slate-600 mt-0.5">
                📞 +91 {currentUser?.mobile || '—'}
              </Text>

              {gstNumber ? (
                <View className="self-start mt-1.5 rounded-lg bg-emerald-100/70 px-2 py-0.5 border border-emerald-200">
                  <Text className="text-[10px] font-black tracking-wide text-emerald-900">
                    GSTIN: {gstNumber}
                  </Text>
                </View>
              ) : null}

              <Pressable
                onPress={handleOpenEditModal}
                className="mt-1 flex-row items-center gap-1 active:opacity-75"
              >
                <Text className="text-[11px] font-semibold text-slate-600 flex-1 leading-tight" numberOfLines={2}>
                  📍 {storeLocation}
                </Text>
                <Icon name="edit-2" size={12} color="#2D6A4F" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* ─── Dealer Performance Snapshot (Moved from Homepage) ─── */}
        <View className="px-4 mt-4">
          <View className="bg-white rounded-[24px] p-4 shadow-soft border border-primary-100">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-xs font-black uppercase tracking-[2px] text-primary-700">
                Dealer Performance Snapshot
              </Text>
              <Text className="text-xs font-bold text-slate-400">Last 30 Days</Text>
            </View>
            <View className="flex-row flex-wrap gap-2.5">
              {stats.map((s) => (
                <View
                  key={s.label}
                  className="flex-1 min-w-[44%] rounded-2xl p-3.5"
                  style={{ backgroundColor: s.bg }}
                >
                  <View
                    className="w-8 h-8 rounded-lg items-center justify-center mb-1.5"
                    style={{ backgroundColor: s.color + '22' }}
                  >
                    <Icon name={s.icon} size={16} color={s.color} />
                  </View>
                  <Text className="text-lg font-black text-slate-900">{s.value}</Text>
                  <Text className="text-xs font-semibold text-slate-600 mt-0.5">{s.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ─── B2B Invoices & Tax Bills Card ─── */}
        <View className="px-4 mt-4">
          <Pressable
            onPress={() => router.push('/(tabs)/invoices')}
            className="bg-primary-900 rounded-[24px] p-4 shadow-soft active:scale-[0.98] border border-primary-800"
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3.5 flex-1 pr-2">
                <View className="w-12 h-12 rounded-2xl bg-primary-800 border border-primary-700 items-center justify-center">
                  <Icon name="file-text" size={22} color="#52B788" />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-base font-black text-white">
                      B2B Invoices & Bills
                    </Text>
                    <View className="bg-emerald-500 rounded-full px-2 py-0.5">
                      <Text className="text-[10px] font-black text-white">
                        TAX BILLS
                      </Text>
                    </View>
                  </View>
                  <Text className="text-xs text-primary-200 font-medium mt-0.5">
                    Download Tally GST Invoices, View QR & Bank Details
                  </Text>
                </View>
              </View>
              <Icon name="chevron-right" size={20} color="#95D5B2" />
            </View>
          </Pressable>
        </View>

        {/* ─── Menu Sections ─── */}
        <View className="px-4 mt-5 gap-5">
          {menuSections.map((section) => (
            <View key={section.title}>
              <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-500 mb-2 px-1">
                {section.title}
              </Text>
              <View className="rounded-[24px] border border-primary-100 bg-white overflow-hidden shadow-xs divide-y divide-slate-100">
                {section.items.map((item) => (
                  <Pressable
                    key={item.label}
                    onPress={item.onPress}
                    className="flex-row items-center justify-between p-4 active:bg-slate-50"
                  >
                    <View className="flex-row items-center gap-3.5 flex-1 pr-2">
                      <View className="w-10 h-10 rounded-2xl bg-primary-50 items-center justify-center">
                        <Icon name={item.icon} size={18} color="#2D6A4F" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-black text-primary-900">{item.label}</Text>
                        {item.subtitle ? (
                          <Text className="text-[11px] font-semibold text-slate-400 mt-0.5">
                            {item.subtitle}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <Icon name="chevron-right" size={18} color="#CBD5E1" />
                  </Pressable>
                ))}
              </View>
            </View>
          ))}

          {/* Logout Button */}
          <Pressable
            onPress={handleLogout}
            className="flex-row items-center justify-center gap-2 rounded-[20px] border border-rose-200 bg-rose-50 py-4 active:scale-98 mt-2 shadow-2xs"
          >
            <Icon name="log-out" size={18} color="#E11D48" />
            <Text className="text-sm font-black uppercase tracking-wider text-rose-700">
              Log Out
            </Text>
          </Pressable>

          {/* App Version Info & Brand Logo */}
          <View className="items-center py-6">
            <Image
              source={require('../../assets/logo.png')}
              style={{ width: 100, height: 32, opacity: 0.8 }}
              contentFit="contain"
            />
            <Text className="text-[11px] font-bold text-slate-400 mt-2">
              Vaniki Dealers (Play Edition) • v1.0.0
            </Text>
            <Text className="text-[10px] font-semibold text-slate-400 mt-0.5">
              Secure B2B Agri-Input Trading Platform
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Edit Store Details & Location Modal */}
      <Modal
        visible={isEditModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/75 justify-end"
          onPress={() => setIsEditModalOpen(false)}
        >
          <Pressable
            className="w-full bg-white rounded-t-[32px] border-t-2 border-emerald-300 p-5 max-h-[90%]"
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View className="flex-row items-center justify-between pb-3 border-b border-slate-100">
              <View>
                <Text className="text-lg font-black text-slate-900">Edit Store Profile</Text>
                <Text className="text-xs font-semibold text-slate-500">Update store address & B2B details</Text>
              </View>
              <Pressable onPress={() => setIsEditModalOpen(false)} className="p-1.5 active:bg-slate-100 rounded-full">
                <Icon name="x" size={22} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="py-4 gap-4">
              {/* Store Name Input */}
              <View>
                <Text className="text-[10px] font-black uppercase tracking-[1.5px] text-slate-400 mb-1.5">
                  Store / Shop Name
                </Text>
                <TextInput
                  value={editStoreName}
                  onChangeText={setEditStoreName}
                  placeholder="e.g. Kisan Agro Agency"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900"
                />
              </View>

              {/* Store Location / Address Input */}
              <View className="mt-3">
                <Text className="text-[10px] font-black uppercase tracking-[1.5px] text-slate-400 mb-1.5">
                  Store Location / Physical Address
                </Text>
                <TextInput
                  value={editStoreLocation}
                  onChangeText={setEditStoreLocation}
                  placeholder="e.g. Market Road, Supela, Bhilai, Durg, CG - 490023"
                  multiline
                  numberOfLines={3}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 min-h-[75px]"
                />
              </View>

              {/* GSTIN Input */}
              <View className="mt-3">
                <Text className="text-[10px] font-black uppercase tracking-[1.5px] text-slate-400 mb-1.5">
                  GST Number (GSTIN)
                </Text>
                <TextInput
                  value={editGstNumber}
                  onChangeText={setEditGstNumber}
                  autoCapitalize="characters"
                  placeholder="e.g. 22AAAAA0000A1Z5"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900"
                />
              </View>

              {/* Save Button */}
              <Pressable
                disabled={isSavingDetails}
                onPress={handleSaveStoreDetails}
                style={{ backgroundColor: '#1B4332' }}
                className="w-full rounded-2xl py-4 items-center justify-center active:scale-[0.98] shadow-md mt-5 mb-2"
              >
                {isSavingDetails ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-xs font-black uppercase tracking-[2px] text-white">
                    SAVE STORE DETAILS
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
