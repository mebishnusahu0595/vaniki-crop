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
import { useStaffAuthStore } from '../src/store/useStaffAuthStore';
import { OfflineBanner } from '../src/components/OfflineBanner';
import { usePushNotifications } from '../src/hooks/usePushNotifications';
import { LoadingScreen } from '../src/components/LoadingScreen';
import { hydrateAppLanguage } from '../src/i18n';

bindOnlineManager();

function RootNavigation() {
  const pathname = usePathname();
  const staffHydrated = useStaffAuthStore((state) => state.hydrated);
  const staffToken = useStaffAuthStore((state) => state.token);

  useBootstrapSession();
  usePushNotifications(Boolean(staffToken));

  useEffect(() => {
    if (!staffHydrated) return;
    const isLoginPage = pathname === '/login';
    if (!staffToken && !isLoginPage) {
      router.replace('/login' as never);
    } else if (staffToken && isLoginPage) {
      router.replace('/' as never);
    }
  }, [staffHydrated, pathname, staffToken]);

  if (!staffHydrated) return <LoadingScreen />;

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

export default function RootLayout() {
  const queryClient = getQueryClient();

  useEffect(() => {
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
