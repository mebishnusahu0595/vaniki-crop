import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shadow } from '../constants/theme';
import { useCartStore } from '../store/useCartStore';

const navItems: Array<{
  key: 'index' | 'categories' | 'compare' | 'cart' | 'account';
  path: '/(tabs)' | '/(tabs)/categories' | '/(tabs)/compare' | '/(tabs)/cart' | '/(tabs)/account';
  icon: keyof typeof Feather.glyphMap;
  labelKey: string;
}> = [
  { key: 'index', path: '/(tabs)', icon: 'home', labelKey: 'mobile.tabs.home' },
  { key: 'categories', path: '/(tabs)/categories', icon: 'grid', labelKey: 'mobile.tabs.categories' },
  { key: 'compare', path: '/(tabs)/compare', icon: 'sliders', labelKey: 'mobile.tabs.compare' },
  { key: 'cart', path: '/(tabs)/cart', icon: 'shopping-cart', labelKey: 'mobile.tabs.cart' },
  { key: 'account', path: '/(tabs)/account', icon: 'user', labelKey: 'mobile.tabs.account' },
];

function matchesRoute(pathname: string, routePath: string) {
  if (routePath === '/(tabs)') {
    return pathname === '/(tabs)' || pathname === '/';
  }

  return pathname === routePath || pathname.startsWith(`${routePath}/`);
}

function resolveActiveKey(pathname: string): (typeof navItems)[number]['key'] {
  const matched = navItems.find((item) => matchesRoute(pathname, item.path));
  if (matched) return matched.key;

  if (pathname.startsWith('/checkout') || pathname.startsWith('/order-success')) {
    return 'cart';
  }

  if (pathname.startsWith('/products') || pathname.startsWith('/product/')) {
    return 'categories';
  }

  return 'index';
}

export function PersistentBottomNav() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const itemCount = useCartStore((store) => store.items.reduce((sum, item) => sum + item.qty, 0));
  const activeKey = resolveActiveKey(pathname);

  return (
    <View
      style={[shadow.card, { paddingBottom: Math.max(insets.bottom, 8) + 12 }]}
      className="bg-white px-4 pt-3"
    >
      <View className="flex-row rounded-[28px] border border-primary-100 bg-white px-2 py-2">
        {navItems.map((item) => {
          const isFocused = activeKey === item.key;

          return (
            <Pressable
              key={item.key}
              onPress={() => router.push(item.path)}
              className="flex-1 items-center gap-1 rounded-[20px] py-3"
            >
              <View>
                <Feather name={item.icon} size={18} color={isFocused ? '#000000' : '#555555'} />
                {item.key === 'cart' && itemCount ? (
                  <View className="absolute -right-3 -top-2 min-w-[18px] rounded-full bg-rose-500 px-1.5 py-0.5">
                    <Text className="text-center text-[10px] font-black text-white">{itemCount}</Text>
                  </View>
                ) : null}
              </View>
              <Text
                className={`text-[10px] font-black uppercase tracking-[1px] ${
                  isFocused ? 'text-black' : 'text-black/50'
                }`}
              >
                {t(item.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
