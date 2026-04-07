import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CustomTabBar } from '../../src/components/CustomTabBar';

export default function TabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <CustomTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: t('mobile.tabs.home') }} />
      <Tabs.Screen name="categories" options={{ title: t('mobile.tabs.categories') }} />
      <Tabs.Screen name="cart" options={{ title: t('mobile.tabs.cart') }} />
      <Tabs.Screen name="account" options={{ title: t('mobile.tabs.account') }} />
    </Tabs>
  );
}
