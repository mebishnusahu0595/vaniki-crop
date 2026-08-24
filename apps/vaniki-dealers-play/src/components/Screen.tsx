import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  keyboardAware?: boolean;
}

export function Screen({
  children,
  scroll = true,
  keyboardAware = true,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const bottomPadding = 20 + insets.bottom;

  const content = (
    <View
      className="w-full bg-offwhite px-4"
      style={{ paddingBottom: bottomPadding, width: '100%' }}
    >
      {children}
    </View>
  );

  const body = scroll ? (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={{ flexGrow: 1, width: '100%' }}
      style={{ flex: 1, width: '100%' }}
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
    </SafeAreaView>
  );
}
