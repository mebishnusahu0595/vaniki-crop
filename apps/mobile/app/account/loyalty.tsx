import { Pressable, Text, View, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { useAuthStore } from '../../src/store/useAuthStore';
import { currencyFormatter } from '../../src/utils/format';

export default function LoyaltyRewardsScreen() {
  const { user, setShowCheckInModal } = useAuthStore();

  if (!user) return null;

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const hasClaimedToday = user.lastCheckIn && new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(user.lastCheckIn)) === todayStr;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Back and Title */}
        <View className="flex-row items-center gap-3 mb-6">
          <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm border border-primary-50 active:scale-90">
            <Feather name="arrow-left" size={18} color="#082018" />
          </Pressable>
          <Text className="text-2xl font-black text-primary-900">Loyalty Rewards</Text>
        </View>

        {/* Loyalty Points Card */}
        <View className="rounded-[28px] bg-amber-500 p-6 shadow-md relative overflow-hidden">
          <View className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-amber-400 opacity-40" />
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-[10px] font-black uppercase tracking-[2px] text-white/70">Point Balance</Text>
              <Text className="mt-1 text-3xl font-black text-white">{user.loyaltyPoints || 0}</Text>
            </View>
            <Image source={require('../../assets/coin.png')} style={{ width: 56, height: 56 }} />
          </View>
          <Text className="mt-4 text-sm font-semibold text-white/80">
            1 point = {currencyFormatter.format(1)} discount on orders
          </Text>
        </View>

        {/* Claim section */}
        <View className="mt-5 rounded-[28px] bg-white border border-primary-100 p-5 shadow-sm items-center">
          <Text className="text-sm font-black text-primary-900 text-center">Daily Rewards</Text>
          <Text className="text-xs text-primary-900/60 mt-1.5 text-center leading-5 px-4">
            Earn points every day by checking in to the app! Points can be used as a discount on checkout.
          </Text>
          {hasClaimedToday ? (
            <View className="mt-5 w-full bg-emerald-50 border border-emerald-100 rounded-full py-4 flex-row justify-center items-center gap-2">
              <Feather name="check-circle" size={16} color="#059669" />
              <Text className="text-emerald-700 text-xs font-black uppercase tracking-[1.5px]">Claimed for today</Text>
            </View>
          ) : (
            <Pressable
              onPress={() => setShowCheckInModal(true)}
              className="mt-5 w-full rounded-full bg-primary-900 py-4 active:scale-95 shadow-sm"
            >
              <Text className="text-center text-xs font-black uppercase tracking-[1.5px] text-white">Claim Daily Points</Text>
            </Pressable>
          )}
        </View>

        {/* Check-in Calendar */}
        <View className="mt-5 rounded-[28px] bg-white border border-primary-100 p-6 shadow-sm">
          <View className="pb-4 border-b border-primary-50">
            <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-500">Check-in History</Text>
            <Text className="mt-2 text-lg font-black text-primary-900">
              {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
            </Text>
          </View>
          
          <View className="mt-5 flex-row flex-wrap gap-2 justify-center">
            {(() => {
              const now = new Date();
              const year = now.getFullYear();
              const month = now.getMonth();
              const daysInMonth = new Date(year, month + 1, 0).getDate();

              return Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                const isCheckedIn = (user.checkInHistory || []).some((d: string) => d.split('T')[0] === dateStr);
                const isToday = todayStr === dateStr;

                return (
                  <View 
                    key={day} 
                    className={`h-10 w-10 items-center justify-center rounded-xl border ${
                      isCheckedIn ? 'border-emerald-500 bg-emerald-50' : 
                      isToday ? 'border-primary-500 bg-primary-50' : 'border-primary-100 bg-primary-50/20'
                    }`}
                  >
                    {isCheckedIn ? (
                      <Feather name="check" size={16} color="#10B981" />
                    ) : (
                      <Text className={`text-xs font-black ${isToday ? 'text-primary-900' : 'text-primary-900/30'}`}>{day}</Text>
                    )}
                  </View>
                );
              });
            })()}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
