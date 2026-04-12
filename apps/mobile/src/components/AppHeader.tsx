import { memo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/useAuthStore';
import { useCartStore } from '../store/useCartStore';
import { getLanguageToggleLabel, toggleAppLanguage } from '../i18n';

export const AppHeader = memo(function AppHeader() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const [switchingLanguage, setSwitchingLanguage] = useState(false);
  const cartCount = useCartStore((state) => state.items.reduce((sum, item) => sum + item.qty, 0));
  const user = useAuthStore((state) => state.user);

  const submitSearch = () => {
    const trimmed = query.trim();

    if (trimmed) {
      router.push({ pathname: '/products', params: { search: trimmed } });
      return;
    }

    router.push('/products');
  };

  const openCart = () => {
    if (pathname !== '/(tabs)/cart') {
      router.push('/(tabs)/cart');
    }
  };

  const openAccount = () => {
    if (user) {
      router.push('/(tabs)/account');
      return;
    }

    router.push('/(auth)/login');
  };

  const handleLanguageToggle = async () => {
    if (switchingLanguage) return;

    setSwitchingLanguage(true);
    try {
      await toggleAppLanguage();
    } finally {
      setSwitchingLanguage(false);
    }
  };

  return (
    <View>
      <View className="rounded-2xl bg-primary-900 px-4 py-2.5">
        <View className="flex-row flex-wrap items-center justify-between gap-y-1.5">
          <View className="flex-row items-center gap-1.5">
            <Feather name="truck" size={12} color="#52B788" />
            <Text className="text-[9px] font-black uppercase tracking-[1.6px] text-white">
              {t('mobile.topNotice.freeDelivery')}
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <Feather name="phone" size={12} color="#52B788" />
            <Text className="text-[9px] font-black uppercase tracking-[1.6px] text-white">
              {t('mobile.topNotice.call')}: +91 94061 02621
            </Text>
          </View>
        </View>
      </View>

      <View className="mt-3 flex-row items-center">
        <Pressable onPress={() => router.push('/(tabs)')} className="mr-2 flex-1">
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            className="text-[30px] leading-[32px] tracking-tight"
          >
            <Text className="font-black text-primary-900">Vaniki</Text>
            <Text className="font-semibold text-primary-700"> Crop</Text>
          </Text>
        </Pressable>

        <View className="shrink-0 flex-row items-center gap-2">
          <Pressable
            onPress={() => void handleLanguageToggle()}
            disabled={switchingLanguage}
            className="h-10 min-w-[56px] items-center justify-center rounded-2xl border border-primary-100 bg-white px-2"
          >
            <Text className="text-[10px] font-black uppercase tracking-[1.6px] text-primary-900">
              {getLanguageToggleLabel()}
            </Text>
          </Pressable>

          <Pressable
            onPress={submitSearch}
            className="h-10 w-10 items-center justify-center rounded-2xl border border-primary-100 bg-white"
          >
            <Feather name="search" size={18} color="#082018" />
          </Pressable>

          <Pressable
            onPress={openCart}
            className="relative h-10 w-10 items-center justify-center rounded-2xl bg-primary-900"
          >
            <Feather name="shopping-cart" size={18} color="#FFFFFF" />
            {cartCount > 0 ? (
              <View className="absolute -right-1 -top-1 min-w-[18px] rounded-full border border-white bg-rose-500 px-1 py-0.5">
                <Text className="text-center text-[10px] font-black text-white">{cartCount}</Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable
            onPress={openAccount}
            className="h-10 w-10 items-center justify-center rounded-2xl border border-primary-100 bg-white"
          >
            <Feather name="user" size={18} color="#082018" />
          </Pressable>
        </View>
      </View>

      <View className="mt-3 flex-row items-center rounded-2xl border border-primary-100 bg-white px-4 py-2">
        <Feather name="search" size={16} color="#527164" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('mobile.header.searchPlaceholder')}
          className="mx-3 flex-1 py-2 text-sm font-semibold text-primary-900"
          placeholderTextColor="#7a978b"
          returnKeyType="search"
          onSubmitEditing={submitSearch}
        />
        <Pressable onPress={submitSearch} className="h-8 w-8 items-center justify-center rounded-xl bg-primary-50">
          <MaterialIcons name="arrow-forward" size={18} color="#082018" />
        </Pressable>
      </View>
    </View>
  );
});
