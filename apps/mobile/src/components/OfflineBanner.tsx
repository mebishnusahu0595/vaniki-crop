import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { Text, View } from 'react-native';

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOffline(!(state.isConnected && state.isInternetReachable !== false));
    });

    return unsubscribe;
  }, []);

  if (!offline) return null;

  return (
    <View className="bg-amber-500 px-4 py-2">
      <Text className="text-center text-xs font-bold uppercase tracking-[2px] text-white">
        No internet. We&apos;ll retry when you reconnect.
      </Text>
    </View>
  );
}
