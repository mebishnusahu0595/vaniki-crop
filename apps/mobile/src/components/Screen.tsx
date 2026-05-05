import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { usePathname } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from './AppHeader';
import { PersistentBottomNav } from './PersistentBottomNav';
import { ServiceModeBar } from './ServiceModeBar';
import { WhatsAppFab } from './WhatsAppFab';

interface ScreenProps {
  children: ReactNode;
  withServiceBar?: boolean;
  withHeader?: boolean;
  withWhatsAppFab?: boolean;
  scroll?: boolean;
  keyboardAware?: boolean;
}

export function Screen({
  children,
  withServiceBar = true,
  withHeader = true,
  withWhatsAppFab = true,
  scroll = true,
  keyboardAware = true,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';

  const matchesPath = (basePath: string) =>
    basePath === '/'
      ? normalizedPath === '/'
      : normalizedPath === basePath || normalizedPath.startsWith(`${basePath}/`);

  const isTabsRoute = [
    '/',
    '/categories',
    '/compare',
    '/cart',
    '/account',
    '/(tabs)',
    '/(tabs)/index',
    '/(tabs)/categories',
    '/(tabs)/compare',
    '/(tabs)/cart',
    '/(tabs)/account',
  ].some(matchesPath);

  const isAuthRoute = ['/login', '/signup', '/(auth)', '/(auth)/login', '/(auth)/signup'].some(matchesPath);
  const isDeliveryRoute = ['/delivery'].some(matchesPath);

  const showPersistentBottomNav = !isTabsRoute && !isAuthRoute && !isDeliveryRoute;
  const bottomPadding = (withWhatsAppFab ? 36 : 20) + insets.bottom;
  const contentClassName = scroll ? 'bg-offwhite px-4' : 'flex-1 bg-offwhite px-4';

  const content = (
    <View className={contentClassName} style={{ paddingBottom: bottomPadding }}>
      {withHeader ? (
        <View className="pb-4 pt-3">
          <AppHeader />
        </View>
      ) : null}
      {withServiceBar ? (
        <View className="pb-4">
          <ServiceModeBar />
        </View>
      ) : null}
      {children}
    </View>
  );

  const body = scroll ? (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {content}
    </ScrollView>
  ) : (
    content
  );

  return (
    <SafeAreaView className="flex-1 bg-offwhite" edges={['top', 'left', 'right']}>
      {keyboardAware ? (
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        >
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
      {showPersistentBottomNav ? <PersistentBottomNav /> : null}
      {withWhatsAppFab ? <WhatsAppFab /> : null}
    </SafeAreaView>
  );
}
