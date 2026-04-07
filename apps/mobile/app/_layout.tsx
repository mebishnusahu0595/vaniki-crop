import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
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
import { hydrateAppLanguage } from '../src/i18n';

bindOnlineManager();

function RootNavigation() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const user = useAuthStore((state) => state.user);

  useBootstrapSession();
  usePushNotifications(Boolean(user));

  if (!hydrated) return null;

  return (
    <>
      <StatusBar style="dark" />
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="product/[slug]" />
        <Stack.Screen name="products" />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="order-success/[id]" />
      </Stack>
      <StoreSelectorSheet />
    </>
  );
}

export default function RootLayout() {
  const queryClient = getQueryClient();

  useEffect(() => {
    useAuthStore.persist.rehydrate();
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
