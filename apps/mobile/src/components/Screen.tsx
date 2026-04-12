import { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from './AppHeader';
import { ServiceModeBar } from './ServiceModeBar';
import { WhatsAppFab } from './WhatsAppFab';

interface ScreenProps {
  children: ReactNode;
  withServiceBar?: boolean;
  withHeader?: boolean;
  withWhatsAppFab?: boolean;
  scroll?: boolean;
}

export function Screen({
  children,
  withServiceBar = true,
  withHeader = true,
  withWhatsAppFab = true,
  scroll = true,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const bottomPadding = (withWhatsAppFab ? 88 : 24) + insets.bottom;

  const content = (
    <View className="flex-1 bg-offwhite px-4" style={{ paddingBottom: bottomPadding }}>
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

  return (
    <SafeAreaView className="flex-1 bg-offwhite" edges={['top', 'left', 'right']}>
      {scroll ? <ScrollView showsVerticalScrollIndicator={false}>{content}</ScrollView> : content}
      {withWhatsAppFab ? <WhatsAppFab /> : null}
    </SafeAreaView>
  );
}
