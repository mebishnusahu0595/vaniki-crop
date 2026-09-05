import { useEffect, useState } from 'react';
import { Stack, router, useSegments, useRootNavigationState } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import '../global.css';
import { useAuthStore } from '../src/store/useAuthStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 2,
    },
  },
});

function RootNavigation() {
  const { token, hydrated } = useAuthStore();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !navigationState?.key || !hydrated) return;

    const inAuthGroup = segments[0] === '(auth)';

    const timeout = setTimeout(() => {
      if (!token && !inAuthGroup && (segments[0] as string) !== 'index') {
        router.replace('/(auth)/login');
      } else if (token && inAuthGroup) {
        router.replace('/(tabs)');
      }
    }, 100);

    return () => clearTimeout(timeout);
  }, [isMounted, navigationState?.key, hydrated, token, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="product-request" />
      <Stack.Screen name="product/[slug]" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="dark" backgroundColor="#F8FAF9" />
          <RootNavigation />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
