import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_CONFIG: Record<string, { icon: keyof typeof Feather.glyphMap; label: string }> = {
  index:    { icon: 'home',       label: 'Home' },
  products: { icon: 'package',    label: 'Products' },
  orders:   { icon: 'shopping-bag', label: 'Orders' },
  invoices: { icon: 'file-text',  label: 'Invoices' },
  account:  { icon: 'user',       label: 'Account' },
};

export function DealerTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();

  const visibleRoutes = (state.routes || []).filter((r: any) => {
    const opts = descriptors[r.key]?.options;
    return opts?.href !== null;
  });

  return (
    <View
      style={{ paddingBottom: Math.max(insets.bottom, 6) + 8 }}
      className="bg-white px-3 pt-2 shadow-soft border-t border-primary-100"
    >
      <View className="flex-row rounded-[28px] border border-primary-100 bg-white px-1.5 py-1.5">
        {visibleRoutes.map((route: any) => {
          const isFocused = state.routes[state.index]?.name === route.name;
          const config = TAB_CONFIG[route.name] || { icon: 'circle', label: route.name };

          return (
            <Pressable
              key={route.key}
              onPress={() => navigation.navigate(route.name)}
              className={`flex-1 items-center gap-1 rounded-[20px] py-2 px-1 ${
                isFocused ? 'bg-primary-50' : ''
              }`}
            >
              <Feather
                name={config.icon}
                size={22}
                color={isFocused ? '#2D6A4F' : '#64748B'}
              />
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                className={`text-[10px] text-center ${
                  isFocused ? 'text-primary-700 font-black' : 'text-slate-500 font-bold'
                }`}
              >
                {config.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
