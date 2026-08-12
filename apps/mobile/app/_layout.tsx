import '../global.css';
import { useEffect } from 'react';
import { router, Stack, usePathname } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { bindOnlineManager, getQueryClient } from '../src/lib/queryClient';
import { useBootstrapSession } from '../src/hooks/useBootstrapSession';
import { useAuthStore } from '../src/store/useAuthStore';
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
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  const sessionQuery = useBootstrapSession();
  usePushNotifications(Boolean(user));

  if (!hydrated || (token && sessionQuery.isLoading && !sessionQuery.isError)) return <LoadingScreen />;

  return (
    <>
      <StatusBar style="dark" translucent={false} />
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="product/[slug]" />
        <Stack.Screen name="products" />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="order-success/[id]" />
        <Stack.Screen name="order/[id]" />
        <Stack.Screen name="account/orders" />
        <Stack.Screen name="account/loyalty" />
        <Stack.Screen name="account/wishlist" />
        <Stack.Screen name="account/profile" />
        <Stack.Screen name="account/password" />
        <Stack.Screen name="about" />
        <Stack.Screen name="contact" />
        <Stack.Screen name="privacy-policy" />
      </Stack>
      <StoreSelectorSheet />
      <CheckInModal />
    </>
  );
}

export default function RootLayout() {
  const queryClient = getQueryClient();

  useEffect(() => {
    Promise.resolve(useAuthStore.persist.rehydrate()).finally(() => {
      useAuthStore.getState().setHydrated(true);
    });
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
