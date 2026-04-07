import { ReactNode } from 'react';
import { SafeAreaView, ScrollView, View } from 'react-native';
import { ServiceModeBar } from './ServiceModeBar';

interface ScreenProps {
  children: ReactNode;
  withServiceBar?: boolean;
  scroll?: boolean;
}

export function Screen({ children, withServiceBar = true, scroll = true }: ScreenProps) {
  const content = (
    <View className="flex-1 bg-offwhite px-4 pb-6">
      {withServiceBar ? (
        <View className="pb-4 pt-3">
          <ServiceModeBar />
        </View>
      ) : null}
      {children}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-offwhite">
      {scroll ? <ScrollView showsVerticalScrollIndicator={false}>{content}</ScrollView> : content}
    </SafeAreaView>
  );
}
