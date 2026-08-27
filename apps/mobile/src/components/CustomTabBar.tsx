import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shadow } from '../constants/theme';
import { useTranslation } from 'react-i18next';
import { getAppLanguage } from '../i18n';

const icons: Record<string, keyof typeof Feather.glyphMap> = {
  index: 'home',
  'select-crop': 'sun',
  categories: 'grid',
  'agri-advisor': 'headphones',
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
        href?: unknown;
      };
    }
  >;
  navigation: {
    navigate: (name: string) => void;
  };
}

const TAB_LABELS_MAP: Record<string, { en: string; hi: string }> = {
  index: { en: 'Home', hi: 'होम' },
  'select-crop': { en: 'Select Crop', hi: 'फसल चुनें' },
  categories: { en: 'Categories', hi: 'श्रेणियां' },
  'agri-advisor': { en: 'Agri Advisor', hi: 'कृषि सलाह' },
};

const ALLOWED_TABS = ['index', 'select-crop', 'categories', 'agri-advisor'];

export function CustomTabBar({ state, descriptors, navigation }: TabBarProps) {
  const { i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isStaffApp = Constants.expoConfig?.extra?.appVariant === 'staff';

  if (isStaffApp) return null;

  const visibleRoutes = state.routes.filter((route) => ALLOWED_TABS.includes(route.name));
  const isHindi = getAppLanguage() === 'hi';

  return (
    <View
      style={[shadow.card, { paddingBottom: Math.max(insets.bottom, 6) + 8 }]}
      className="bg-white px-3 pt-2"
    >
      <View className="flex-row rounded-[28px] border border-primary-100 bg-white px-1.5 py-1.5">
        {visibleRoutes.map((route) => {
          const { options } = descriptors[route.key];
          const isFocused = state.routes[state.index]?.name === route.name;
          const tabConfig = TAB_LABELS_MAP[route.name];
          const label = tabConfig
            ? isHindi
              ? tabConfig.hi
              : tabConfig.en
            : typeof options.tabBarLabel === 'string'
            ? options.tabBarLabel
            : options.title || route.name;

          return (
            <Pressable
              key={route.key}
              onPress={() => navigation.navigate(route.name)}
              className="flex-1 items-center gap-1 rounded-[20px] py-2 px-1"
            >
              <Feather
                name={icons[route.name] || 'circle'}
                size={22}
                color={isFocused ? '#2D6A4F' : '#64748B'}
              />
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                className={`text-[11px] text-center ${
                  isFocused ? 'text-[#2D6A4F] font-black' : 'text-slate-600 font-bold'
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
