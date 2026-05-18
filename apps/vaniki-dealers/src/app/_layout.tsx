import 'react-native-gesture-handler';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Slot, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { ActivityIndicator, Text, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAdminAuthStore } from '../store/useAdminAuthStore';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../global.css';

const queryClient = new QueryClient();
void SplashScreen.preventAutoHideAsync();

function BootScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-[#2D6A4F] px-6">
      <ActivityIndicator size="large" color="#FFFFFF" />
      <Text className="mt-4 text-base font-semibold text-white">Starting dealer app...</Text>
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { user, hydrated, setHydrated } = useAdminAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    useAdminAuthStore.persist.rehydrate();

    const timer = setTimeout(() => {
      if (!useAdminAuthStore.persist.hasHydrated()) {
        setHydrated(true);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [setHydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    SplashScreen.hideAsync().catch(() => {
      // Ignore redundant hide failures during fast refresh or repeated mounts.
    });
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;

    const inAuthGroup = segments[0] === '(auth)';
    
    if (!user && !inAuthGroup) {
      // Redirect to the sign-in page.
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      // Redirect away from the sign-in page.
      router.replace('/(drawer)/');
    }
  }, [hydrated, router, segments, user]);

  if (!hydrated) {
    return <BootScreen />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Slot />
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
