import { memo } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

const SUPPORT_WHATSAPP_PHONE = '919302228883';

export const WhatsAppFab = memo(function WhatsAppFab() {
  const { t } = useTranslation();

  const openWhatsApp = async () => {
    const message = encodeURIComponent(t('mobile.whatsapp.defaultMessage'));
    const url = `https://api.whatsapp.com/send?phone=${SUPPORT_WHATSAPP_PHONE}&text=${message}`;

    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    }
  };

  return (
    <View pointerEvents="box-none" className="absolute bottom-6 right-4">
      <Pressable
        onPress={() => void openWhatsApp()}
        accessibilityRole="button"
        accessibilityLabel={t('mobile.whatsapp.openChat')}
        className="h-14 w-14 items-center justify-center rounded-full bg-[#25D366]"
        style={{
          shadowColor: '#25D366',
          shadowOpacity: 0.35,
          shadowOffset: { width: 0, height: 10 },
          shadowRadius: 16,
          elevation: 9,
        }}
      >
        <FontAwesome name="whatsapp" size={30} color="#FFFFFF" />
      </Pressable>
      <Text className="mt-1 text-center text-[10px] font-black uppercase tracking-[1.3px] text-primary-500">
        WA
      </Text>
    </View>
  );
});
