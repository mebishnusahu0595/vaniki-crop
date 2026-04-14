import { memo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useServiceModeStore } from '../store/useServiceModeStore';
import { useStoreStore } from '../store/useStoreStore';
import { getLanguageToggleLabel, toggleAppLanguage } from '../i18n';
import { formatStoreAddress } from '../utils/format';

export const ServiceModeBar = memo(function ServiceModeBar() {
  const { t } = useTranslation();
  const mode = useServiceModeStore((state) => state.mode);
  const address = useServiceModeStore((state) => state.address);
  const openSelector = useServiceModeStore((state) => state.openSelector);
  const selectedStore = useStoreStore((state) => state.selectedStore);
  const [switchingLanguage, setSwitchingLanguage] = useState(false);

  const handleLanguageToggle = async () => {
    if (switchingLanguage) return;
    setSwitchingLanguage(true);
    try {
      await toggleAppLanguage();
    } finally {
      setSwitchingLanguage(false);
    }
  };

  const languageToggleLabel = getLanguageToggleLabel();
  const deliveryAddressText = formatStoreAddress(address);

  return (
    <View className="gap-2 rounded-[28px] border border-primary-100 bg-white px-4 py-4">
      <View className="flex-row rounded-full bg-primary-50 p-1">
        {([
          { key: 'delivery', label: t('mobile.serviceMode.delivery'), icon: 'truck' },
          { key: 'pickup', label: t('mobile.serviceMode.pickup'), icon: 'shopping-bag' },
        ] as const).map((item) => (
          <Pressable
            key={item.key}
            onPress={openSelector}
            className={`flex-1 rounded-full px-3 py-3 ${
              mode === item.key ? 'bg-white' : ''
            }`}
          >
            <View className="flex-row items-center justify-center gap-1.5">
              <Feather
                name={item.icon}
                size={13}
                color={mode === item.key ? '#082018' : '#6D8A7D'}
              />
              <Text
                className={`text-center text-xs font-black uppercase tracking-[2px] ${
                  mode === item.key ? 'text-primary-900' : 'text-primary-900/45'
                }`}
              >
                {item.label}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
      <View className="flex-row items-center justify-between gap-3">
        <Pressable onPress={openSelector} className="flex-1 flex-row items-center justify-between">
          <Text className="text-xs font-black uppercase tracking-[2px] text-primary-400">
            {mode === 'delivery'
              ? `${t('mobile.serviceMode.deliveringTo')}: ${deliveryAddressText || t('mobile.serviceMode.addAddress')}`
              : `${t('mobile.serviceMode.pickupFrom')}: ${selectedStore?.name || t('mobile.serviceMode.chooseStore')}`}
          </Text>
          <Text className="text-xs font-semibold text-primary-500">{t('mobile.serviceMode.change')}</Text>
        </Pressable>
        <Pressable
          onPress={() => void handleLanguageToggle()}
          disabled={switchingLanguage}
          className="rounded-full border border-primary-100 bg-primary-50 px-3 py-1.5"
        >
          <Text className="text-[10px] font-black uppercase tracking-[1.5px] text-primary-900">
            {languageToggleLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
});
