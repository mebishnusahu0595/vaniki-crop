import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CustomTabBar } from '../../src/components/CustomTabBar';

export default function TabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <CustomTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="select-crop" options={{ title: 'Select Crop' }} />
      <Tabs.Screen name="categories" options={{ title: 'Categories' }} />
      <Tabs.Screen name="agri-advisor" options={{ title: 'Agri Advisor' }} />
      <Tabs.Screen name="compare" options={{ href: null }} />
      <Tabs.Screen name="cart" options={{ href: null }} />
      <Tabs.Screen name="account" options={{ href: null }} />
    </Tabs>
  );
}
