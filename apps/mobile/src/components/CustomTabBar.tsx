import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useCartStore } from '../store/useCartStore';
import { shadow } from '../constants/theme';

const icons: Record<string, keyof typeof Feather.glyphMap> = {
  index: 'home',
  categories: 'grid',
  cart: 'shopping-cart',
  account: 'user',
} as const;

interface TabRoute {
  key: string;
  name: string;
}

interface TabBarProps {
  state: {
    index: number;
    routes: TabRoute[];
  };
  descriptors: Record<
    string,
    {
      options: {
        tabBarLabel?: unknown;
        title?: string;
      };
    }
  >;
  navigation: {
    navigate: (name: string) => void;
  };
}

export function CustomTabBar({ state, descriptors, navigation }: TabBarProps) {
  const itemCount = useCartStore((store) => store.items.reduce((sum, item) => sum + item.qty, 0));

  return (
    <View style={shadow.card} className="bg-white px-4 pb-6 pt-3">
      <View className="flex-row rounded-[28px] border border-primary-100 bg-white px-2 py-2">
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : options.title || route.name;

          return (
            <Pressable
              key={route.key}
              onPress={() => navigation.navigate(route.name)}
              className="flex-1 items-center gap-1 rounded-[20px] py-3"
            >
              <View>
                <Feather
                  name={icons[route.name] || 'circle'}
                  size={18}
                  color={isFocused ? '#2D6A4F' : '#6D8A7D'}
                />
                {route.name === 'cart' && itemCount ? (
                  <View className="absolute -right-3 -top-2 min-w-[18px] rounded-full bg-rose-500 px-1.5 py-0.5">
                    <Text className="text-center text-[10px] font-black text-white">{itemCount}</Text>
                  </View>
                ) : null}
              </View>
              <Text
                className={`text-[10px] font-black uppercase tracking-[1px] ${
                  isFocused ? 'text-primary-500' : 'text-primary-900/45'
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
