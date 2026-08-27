import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shadow } from '../constants/theme';
import { getAppLanguage } from '../i18n';

const navTabs = [
  {
    key: 'index',
    path: '/(tabs)' as const,
    icon: 'home' as const,
    labelEn: 'Home',
    labelHi: 'होम',
  },
  {
    key: 'select-crop',
    path: '/(tabs)/select-crop' as const,
    icon: 'sun' as const,
    labelEn: 'Select Crop',
    labelHi: 'फसल चुनें',
  },
  {
    key: 'categories',
    path: '/(tabs)/categories' as const,
    icon: 'grid' as const,
    labelEn: 'Categories',
    labelHi: 'श्रेणियां',
  },
  {
    key: 'agri-advisor',
    path: '/(tabs)/agri-advisor' as const,
    icon: 'headphones' as const,
    labelEn: 'Agri Advisor',
    labelHi: 'कृषि सलाह',
  },
] as const;

export function PersistentBottomNav() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const isHindi = getAppLanguage() === 'hi';

  const isFocused = (tabKey: string) => {
    if (tabKey === 'index') {
      return pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/index';
    }
    if (tabKey === 'categories') {
      return pathname.includes('categor') || pathname.startsWith('/products') || pathname.startsWith('/product/');
    }
    if (tabKey === 'select-crop') {
      return pathname.includes('select-crop') || pathname.includes('/crop/');
    }
    if (tabKey === 'agri-advisor') {
      return pathname.includes('agri-advisor');
    }
    return false;
  };

  return (
    <View
      style={[shadow.card, { paddingBottom: Math.max(insets.bottom, 6) + 8 }]}
      className="bg-white px-3 pt-2"
    >
      <View className="flex-row rounded-[28px] border border-primary-100 bg-white px-1.5 py-1.5">
        {navTabs.map((item) => {
          const focused = isFocused(item.key);
          const label = isHindi ? item.labelHi : item.labelEn;

          return (
            <Pressable
              key={item.key}
              onPress={() => router.push(item.path)}
              className="flex-1 items-center gap-1 rounded-[20px] py-2 px-1 active:scale-95"
            >
              <Feather
                name={item.icon}
                size={22}
                color={focused ? '#2D6A4F' : '#64748B'}
              />
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                className={`text-[11px] text-center ${
                  focused ? 'text-[#2D6A4F] font-black' : 'text-slate-600 font-bold'
                }`}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
