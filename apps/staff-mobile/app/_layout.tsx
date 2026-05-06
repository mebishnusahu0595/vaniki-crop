import { useEffect, useState } from 'react';
import { Stack, router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { bindOnlineManager, getQueryClient } from '../src/lib/queryClient';
import { useStaffAuthStore } from '../src/store/useStaffAuthStore';
import { hydrateAppLanguage } from '../src/i18n';
import { LoadingScreen } from '../src/components/LoadingScreen';
import { OfflineBanner } from '../src/components/OfflineBanner';
import { usePushNotifications } from '../src/hooks/usePushNotifications';

import '../global.css';

export default function RootLayout() {
  const [queryClient] = useState(() => getQueryClient());

  useEffect(() => {
    bindOnlineManager();
    useStaffAuthStore.persist.rehydrate();
    void hydrateAppLanguage();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <RootNavigation />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigation() {
  const staffHydrated = useStaffAuthStore((state) => state.hydrated);
  const staffToken = useStaffAuthStore((state) => state.token);
  const pathname = usePathname();

  // Handle Push Notifications for Staff
  usePushNotifications(Boolean(staffToken));

  useEffect(() => {
    if (!staffHydrated) return;

    const isLoginPage = pathname === '/login';
    
    if (!staffToken && !isLoginPage) {
      router.replace('/login');
    } else if (staffToken && isLoginPage) {
      router.replace('/');
    }
  }, [staffHydrated, staffToken, pathname]);

  if (!staffHydrated) {
    return <LoadingScreen />;
  }

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
