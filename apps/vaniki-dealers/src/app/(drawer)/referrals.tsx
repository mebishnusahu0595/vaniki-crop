import React from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Share, 
  ActivityIndicator, 
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAdminAuthStore } from '../../store/useAdminAuthStore';
import { adminApi } from '../../utils/api';
import { currencyFormatter, formatDate } from '../../utils/format';
import { Feather } from '@expo/vector-icons';

const Icon = Feather as any;

export default function ReferralsScreen() {
  const user = useAdminAuthStore((state) => state.user);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-referrals'],
    queryFn: () => adminApi.referrals({ limit: 100 }),
  });

  const handleShareInvite = async () => {
    if (!user?.referralCode) {
      Alert.alert('Referral Code', 'Your referral code is being generated.');
      return;
    }
    try {
      const inviteUrl = `https://vanikicrop.com/signup?ref=${user.referralCode}`;
      await Share.share({
        message: `Namaste Kisan Bhai! Join Vaniki Crop using my verified dealer code: ${user.referralCode} to get genuine crop care products.\nLink: ${inviteUrl}`,
      });
    } catch {
      Alert.alert('Error', 'Could not open share dialog.');
    }
  };

  const referrals = data?.data || [];

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView
        refreshControl={
          <RefreshControl 
            refreshing={isFetching} 
            onRefresh={refetch} 
            colors={['#143D2E']} 
          />
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        className="flex-1"
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Share & Earn Card ────────────────────────────────────────────── */}
        <View className="rounded-3xl bg-[#143D2E] p-6 shadow-lg shadow-emerald-950/20">
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 rounded-2xl bg-white/10 items-center justify-center border border-white/20">
              <Icon name="gift" size={22} color="#34d399" />
            </View>
            <View>
              <Text className="text-[10px] font-black uppercase tracking-[2px] text-emerald-300">
                Customer Network Outreach
              </Text>
              <Text className="text-xl font-black text-white mt-0.5">Dealer Invite Code</Text>
            </View>
          </View>

          {/* Referral Code Row */}
          <View className="mt-5 flex-row items-center justify-between rounded-2xl bg-white/10 p-4 border border-white/15">
            <View>
              <Text className="text-[9px] font-black uppercase tracking-wider text-emerald-200">
                Your Referral Code
              </Text>
              <Text className="text-2xl font-black tracking-widest text-emerald-400 mt-0.5">
                {user?.referralCode || 'VANIKI-DEALER'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleShareInvite}
              activeOpacity={0.85}
              className="flex-row items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 active:bg-slate-100"
            >
              <Icon name="share-2" size={15} color="#143D2E" />
              <Text className="text-xs font-black uppercase tracking-wider text-[#143D2E]">
                Share
              </Text>
            </TouchableOpacity>
          </View>

          <Text className="mt-4 text-xs font-semibold leading-relaxed text-emerald-100/80">
            Share this code with farmers in your village. When they register and order online, you earn points and commission.
          </Text>
        </View>

        {/* ─── Referral Stats ────────────────────────────────────────────────── */}
        <View className="mt-5 flex-row gap-3">
          <View className="flex-1 rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
            <Text className="text-[10px] font-black uppercase tracking-wider text-slate-400">Referred Farmers</Text>
            <Text className="text-2xl font-black text-slate-900 mt-1">{referrals.length}</Text>
          </View>
          <View className="flex-1 rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
            <Text className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Farmer Orders</Text>
            <Text className="text-2xl font-black text-emerald-800 mt-1">
              {referrals.reduce((sum: number, r: any) => sum + (r.orderCount || 0), 0)}
            </Text>
          </View>
        </View>

        {/* ─── Referred Farmers List ────────────────────────────────────────── */}
        <View className="mt-6">
          <Text className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
            Registered Customers Ledger
          </Text>

          {isLoading ? (
            <View className="py-12 items-center justify-center">
              <ActivityIndicator size="large" color="#143D2E" />
            </View>
          ) : referrals.length === 0 ? (
            <View className="items-center justify-center py-16 px-6 rounded-3xl bg-white border border-dashed border-slate-200">
              <Icon name="users" size={36} color="#94a3b8" />
              <Text className="mt-3 font-black text-slate-800 text-sm">No Referrals Yet</Text>
              <Text className="mt-1 text-center text-xs text-slate-400">
                Share your referral link on WhatsApp to invite local farmers.
              </Text>
            </View>
          ) : (
            <View className="space-y-3">
              {referrals.map((r, i) => (
                <View
                  key={i}
                  className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs flex-row items-center justify-between"
                >
                  <View className="flex-1 pr-2">
                    <Text className="text-sm font-black text-slate-900">{r.name}</Text>
                    <Text className="text-xs font-semibold text-slate-400 mt-0.5">
                      {r.mobile} · Joined {formatDate(r.joinedAt)}
                    </Text>
                  </View>

                  <View className="items-end">
                    <Text className="text-sm font-black text-emerald-800">
                      {currencyFormatter.format(r.totalSpend || 0)}
                    </Text>
                    <Text className="text-[10px] font-bold text-slate-400 mt-0.5">
                      {r.orderCount || 0} orders
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
