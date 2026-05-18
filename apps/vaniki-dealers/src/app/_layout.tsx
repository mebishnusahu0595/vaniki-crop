import 'react-native-gesture-handler';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Slot, useRouter, useSegments } from 'expo-router';
import React, { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { useAdminAuthStore } from '../store/useAdminAuthStore';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../global.css';

const queryClient = new QueryClient();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { user, hydrated } = useAdminAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Safely force rehydration after 1 second if AsyncStorage rehydration gets stuck
    const timer = setTimeout(() => {
      if (!useAdminAuthStore.getState().hydrated) {
        useAdminAuthStore.setState({ hydrated: true });
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

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
  }, [user, hydrated, segments]);

  if (!hydrated) {
    return null; // Or a splash screen
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Slot />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
