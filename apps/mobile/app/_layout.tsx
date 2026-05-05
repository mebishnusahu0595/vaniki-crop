import '../global.css';
import { useEffect } from 'react';
import { router, Stack, usePathname } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { bindOnlineManager, getQueryClient } from '../src/lib/queryClient';
import { useBootstrapSession } from '../src/hooks/useBootstrapSession';
import { useAuthStore } from '../src/store/useAuthStore';
import { useStaffAuthStore } from '../src/store/useStaffAuthStore';
import { OfflineBanner } from '../src/components/OfflineBanner';
import { StoreSelectorSheet } from '../src/components/StoreSelectorSheet';
import { usePushNotifications } from '../src/hooks/usePushNotifications';
import { LoadingScreen } from '../src/components/LoadingScreen';
import { hydrateAppLanguage } from '../src/i18n';
import { CheckInModal } from '../src/components/CheckInModal';

bindOnlineManager();

function RootNavigation() {
  const pathname = usePathname();
  const hydrated = useAuthStore((state) => state.hydrated);
  const user = useAuthStore((state) => state.user);
  const staffToken = useStaffAuthStore((state) => state.token);
  const isStaffApp = Constants.expoConfig?.extra?.appVariant === 'staff';

  useBootstrapSession();
  usePushNotifications(Boolean(user));

  useEffect(() => {
    if (!hydrated || !isStaffApp || pathname.startsWith('/delivery')) return;
    router.replace((staffToken ? '/delivery' : '/delivery/login') as never);
  }, [hydrated, isStaffApp, pathname, staffToken]);

  if (!hydrated) return <LoadingScreen />;

  return (
    <>
      <StatusBar style="dark" translucent={false} />
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false }}>
        {!isStaffApp && <Stack.Screen name="(tabs)" />}
        {!isStaffApp && <Stack.Screen name="(auth)" />}
        {!isStaffApp && <Stack.Screen name="product/[slug]" />}
        {!isStaffApp && <Stack.Screen name="products" />}
        {!isStaffApp && <Stack.Screen name="checkout" />}
        {!isStaffApp && <Stack.Screen name="order-success/[id]" />}
        {!isStaffApp && <Stack.Screen name="about" />}
        {!isStaffApp && <Stack.Screen name="contact" />}
        {!isStaffApp && <Stack.Screen name="privacy-policy" />}
        <Stack.Screen name="delivery" />
      </Stack>
      {!isStaffApp && <StoreSelectorSheet />}
      {!isStaffApp && <CheckInModal />}
    </>
  );
}

export default function RootLayout() {
  const queryClient = getQueryClient();

  useEffect(() => {
    useAuthStore.persist.rehydrate();
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
