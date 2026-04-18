import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useServiceModeStore } from '../store/useServiceModeStore';
import { useStoreStore } from '../store/useStoreStore';
import { formatStoreAddress } from '../utils/format';

export const ServiceModeBar = memo(function ServiceModeBar() {
  const { t } = useTranslation();
  const mode = useServiceModeStore((state) => state.mode);
  const address = useServiceModeStore((state) => state.address);
  const openSelector = useServiceModeStore((state) => state.openSelector);
  const barExpanded = useServiceModeStore((state) => state.barExpanded);
  const setBarExpanded = useServiceModeStore((state) => state.setBarExpanded);
  const selectedStore = useStoreStore((state) => state.selectedStore);
  const deliveryAddressText = formatStoreAddress(address);

  if (!barExpanded) {
    return (
      <View className="flex-row justify-end">
        <Pressable
          onPress={() => setBarExpanded(true)}
          className="flex-row items-center gap-2 rounded-full bg-primary-900 px-4 py-2 mb-2"
        >
          <Text className="text-[10px] font-black uppercase tracking-[1px] text-white">
            SERVICE MODE
          </Text>
          <Feather name="chevron-down" size={14} color="white" />
        </Pressable>
      </View>
    );
  }

  return (
    <View className="gap-2 rounded-[28px] border border-primary-100 bg-white px-4 py-4 relative">
      <Pressable 
        onPress={() => setBarExpanded(false)}
        className="absolute -right-1 -top-1 z-10 rounded-full bg-white border border-primary-100 p-1.5 shadow-sm"
        hitSlop={8}
      >
        <Feather name="x" size={14} color="#082018" />
      </Pressable>
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
      </View>
    </View>
  );
});
