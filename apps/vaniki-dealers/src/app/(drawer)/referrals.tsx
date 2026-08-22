import React from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  Share, 
  ActivityIndicator, 
  RefreshControl,
  SafeAreaView,
  ScrollView
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAdminAuthStore } from '../../store/useAdminAuthStore';
import { adminApi } from '../../utils/api';
import { currencyFormatter, formatDate } from '../../utils/format';
import { Feather } from '@expo/vector-icons';

const Icon = Feather as any;

export default function ReferralsScreen() {
  const user = useAdminAuthStore((state) => state.user);

  // Fetch referrals from server
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-referrals'],
    queryFn: () => adminApi.referrals({ limit: 100 }),
  });

  const handleShareInvite = async () => {
    if (!user?.referralCode) {
      alert('Referral code is not available yet.');
      return;
    }
    try {
      const inviteUrl = `https://vanikicrop.com/signup?ref=${user.referralCode}`;
      await Share.share({
        message: `Join Vaniki Crop using my dealer referral link: ${inviteUrl}\nOr register with code: ${user.referralCode}`,
      });
    } catch (error) {
      alert('Failed to trigger invitation share.');
    }
  };

  const referrals = data?.data || [];

  return (
    <SafeAreaView className="flex-1 bg-zinc-50">
      
      {/* Scrollable Layout */}
      <ScrollView
        refreshControl={
          <RefreshControl 
            refreshing={isFetching} 
            onRefresh={refetch} 
            colors={['#143D2E']} 
          />
        }
        contentContainerStyle={{ padding: 20 }}
        className="flex-1"
      >
        
        {/* Referral Card */}
        <View className="bg-zinc-900 rounded-[2rem] border border-zinc-800 shadow-2xl p-6 overflow-hidden">
          <View className="flex-row items-center gap-3 mb-6">
            <View className="bg-emerald-500 p-2.5 rounded-2xl">
              <Icon name="gift" size={18} color="#fff" />
            </View>
            <View>
              <Text className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Share & Earn</Text>
              <Text className="text-white font-black text-lg mt-0.5">Your Referral Code</Text>
            </View>
          </View>

          {/* Code display row */}
          <View className="flex-row justify-between items-center bg-white/5 border border-white/10 rounded-2xl p-4">
            <View>
              <Text className="text-[9px] font-black uppercase tracking-wider text-zinc-400">Unique Invite Code</Text>
              <Text className="text-emerald-400 font-black text-3xl tracking-widest mt-1">
                {user?.referralCode || '...'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleShareInvite}
              className="bg-emerald-500 p-3.5 rounded-2xl active:scale-95"
            >
              <Icon name="share-2" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          <Text className="text-zinc-400 font-semibold text-xs leading-5 mt-4">
            Share this code with new growers. When they register with your code, you will earn <Text className="text-emerald-400 font-bold">1 Loyalty Point</Text> as commission.
          </Text>
        </View>

        {/* Loyalty Points Card */}
        <View className="bg-white border border-zinc-100 rounded-[2.5rem] p-6 shadow-sm mt-6">
          <View className="flex-row items-center gap-3 mb-4">
            <View className="bg-amber-100 p-2.5 rounded-2xl">
              <Icon name="award" size={18} color="#D97706" />
            </View>
            <View>
              <Text className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600">Loyalty Balance</Text>
              <Text className="text-zinc-900 font-black text-lg mt-0.5">Total Points Earned</Text>
            </View>
          </View>

          <View className="flex-row items-baseline gap-2">
            <Text className="text-amber-600 font-black text-5xl">{user?.loyaltyPoints || 0}</Text>
            <Text className="text-amber-400 font-black uppercase tracking-widest text-sm">Points</Text>
          </View>

          <View className="h-px bg-zinc-100 my-4" />

          {/* Stats Row */}
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-[9px] font-black uppercase tracking-wider text-zinc-400">Referred signups</Text>
              <Text className="text-zinc-900 font-black text-lg mt-0.5">{referrals.length}</Text>
            </View>
            <View className="h-8 w-px bg-zinc-200" />
            <View className="items-end">
              <Text className="text-[9px] font-black uppercase tracking-wider text-zinc-400">Conversion Rate</Text>
              <Text className="text-emerald-700 font-black text-lg mt-0.5">100%</Text>
            </View>
          </View>
        </View>

        {/* Referred Users List */}
        <View className="mt-8 space-y-4">
          <View className="flex-row items-center gap-2 px-1 mb-2">
            <Icon name="users" size={16} color="#143D2E" />
            <Text className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Referred Users List</Text>
          </View>

          {isLoading ? (
            <ActivityIndicator size="small" color="#143D2E" className="py-10" />
          ) : (
            <View className="space-y-4">
              {referrals.map((record: any) => (
                <View 
                  key={record.id}
                  className="bg-white border border-zinc-100 rounded-3xl p-5 shadow-sm"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <View className="h-12 w-12 bg-emerald-50 border border-emerald-100 rounded-2xl items-center justify-center mr-3">
                        <Text className="text-emerald-800 font-black text-lg">
                          {(record.name || 'A').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Text className="text-zinc-900 font-black text-base">{record.name}</Text>
                        <Text className="text-zinc-400 font-semibold text-xs mt-0.5">
                          Joined: {formatDate(record.joinedAt)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View className="h-px bg-zinc-100 my-4" />

                  {/* Purchase Metas */}
                  <View className="flex-row justify-between items-center bg-zinc-50/50 rounded-2xl p-4 border border-zinc-100">
                    <View>
                      <Text className="text-[9px] font-black uppercase tracking-wider text-zinc-400">Purchases</Text>
                      <Text className="text-zinc-800 font-black text-xs mt-0.5">{record.orderCount} Orders</Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-[9px] font-black uppercase tracking-wider text-zinc-400">Total Spend</Text>
                      <Text className="text-emerald-800 font-black text-xs mt-0.5">
                        {currencyFormatter.format(record.totalSpend)}
                      </Text>
                    </View>
                  </View>

                  {record.mostBoughtProduct && (
                    <View className="mt-3 flex-row items-center bg-emerald-50/40 rounded-xl px-3 py-2 border border-emerald-100 self-start">
                      <Icon name="tag" size={10} color="#047857" />
                      <Text className="text-[10px] text-emerald-800 font-black uppercase tracking-wide ml-1.5 truncate max-w-[250px]">
                        {record.mostBoughtProduct}
                      </Text>
                    </View>
                  )}
                </View>
              ))}

              {referrals.length === 0 && (
                <View className="justify-center items-center py-12 bg-white border border-zinc-100 border-dashed rounded-[2rem]">
                  <Icon name="users" size={32} color="#D4D4D8" />
                  <Text className="text-zinc-400 font-black text-[10px] uppercase tracking-wider mt-3">No invites yet</Text>
                  <Text className="text-zinc-400 font-semibold text-xs mt-1">Start sharing to build your referral network!</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
