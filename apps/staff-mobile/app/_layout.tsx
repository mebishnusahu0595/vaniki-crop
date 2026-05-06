import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { bindOnlineManager, getQueryClient } from '../src/lib/queryClient';
import { useStaffAuthStore } from '../src/store/useStaffAuthStore';
import { hydrateAppLanguage } from '../src/i18n';
import { OfflineBanner } from '../src/components/OfflineBanner';
import { usePushNotifications } from '../src/hooks/usePushNotifications';

export default function RootLayout() {
  const [queryClient] = useState(() => getQueryClient());

  useEffect(() => {
    bindOnlineManager();
    useStaffAuthStore.persist.rehydrate();
    void hydrateAppLanguage();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <RootNavigation />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigation() {
  const staffToken = useStaffAuthStore((state) => state.token);

  // Handle Push Notifications for Staff
  usePushNotifications(Boolean(staffToken));

  return (
    <>
      <StatusBar style="dark" translucent={false} />
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
      </Stack>
    </>
  );
}
