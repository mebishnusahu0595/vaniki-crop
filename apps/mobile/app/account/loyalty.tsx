import { Alert, Platform, Pressable, Share, Text, View, ScrollView } from 'react-native';
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
    <Screen scroll={false}>
      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, width: '100%' }} contentContainerStyle={{ width: '100%', flexGrow: 1, paddingBottom: 40 }}>
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

        {/* Daily Rewards Claim section */}
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

        {/* Referral Program Card */}
        <View className="mt-5 rounded-[28px] bg-primary-50 border border-primary-100 p-5 shadow-sm">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View className="h-8 w-8 items-center justify-center rounded-full bg-primary-500">
                <Feather name="users" size={16} color="#FFFFFF" />
              </View>
              <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-600">Referral Program</Text>
            </View>
            <View className="bg-amber-100 px-3 py-1 rounded-full border border-amber-200">
              <Text className="text-[10px] font-black text-amber-800 uppercase tracking-[1px]">Earn Points</Text>
            </View>
          </View>

          <View className="mt-4 bg-white rounded-2xl p-4 border border-primary-100">
            <Text className="text-xs font-semibold text-primary-900/60">Your Referral Code</Text>
            <View className="flex-row items-center justify-between mt-1">
              <Text className="text-xl font-black text-primary-900 tracking-wider">
                Code: {user.referralCode || 'Generating'}
              </Text>
              <Pressable
                onPress={() => {
                  if (user.referralCode) {
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      navigator.clipboard.writeText(user.referralCode);
                      Alert.alert('Copied! 📋', `Referral code ${user.referralCode} copied to clipboard.`);
                    } else {
                      Alert.alert('Referral Code', user.referralCode);
                    }
                  } else {
                    Alert.alert('Referral Code', 'Code is being generated.');
                  }
                }}
                className="bg-primary-50 px-3 py-1.5 rounded-xl border border-primary-100 active:scale-95 flex-row items-center gap-1.5"
              >
                <Feather name="copy" size={13} color="#2D6A4F" />
                <Text className="text-xs font-black text-primary-700">Copy</Text>
              </Pressable>
            </View>
          </View>

          <View className="mt-3 flex-row items-center justify-between px-1">
            <Text className="text-xs font-semibold text-primary-900/75">
              Successful referrals: <Text className="font-black text-primary-900">{user.referralCount || 0}</Text>
            </Text>
          </View>

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
              } catch {
                if (typeof navigator !== 'undefined' && navigator.clipboard) {
                  await navigator.clipboard.writeText(referralLink);
                  Alert.alert('Link Copied! 📋', 'Referral link has been copied to your clipboard.');
                } else {
                  Alert.alert('Referral Link', referralLink);
                }
              }
            }}
            className="mt-4 rounded-full bg-primary-500 py-3.5 active:scale-95 shadow-sm flex-row items-center justify-center gap-2"
          >
            <Feather name="share-2" size={16} color="#FFFFFF" />
            <Text className="text-center text-xs font-black uppercase tracking-[1.5px] text-white">
              Share Invite Link
            </Text>
          </Pressable>
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
