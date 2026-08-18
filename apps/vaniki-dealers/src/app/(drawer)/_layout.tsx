import { Drawer } from 'expo-router/drawer';
import React, { useEffect } from 'react';
import { useColorScheme, TouchableOpacity, Text, View, Platform } from 'react-native';
import { useAdminAuthStore } from '../../store/useAdminAuthStore';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { adminApi } from '../../utils/api';

const Icon = Feather as any;
const DrawerComponent = Drawer as any;

// Configure Notification Handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    console.log('Must use physical device for Push Notifications');
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    return tokenData.data;
  } catch (error) {
    console.error('Error getting Expo push token:', error);
    return null;
  }
}

export default function DrawerLayout() {
  const colorScheme = useColorScheme();
  const { clearSession, token } = useAdminAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (token) {
      registerForPushNotificationsAsync().then((pushToken) => {
        if (pushToken) {
          adminApi.updatePushToken(pushToken).catch((err) => {
            console.error('Failed to update push token on backend:', err);
          });
        }
      });
      Notifications.getDevicePushTokenAsync().then((deviceToken) => {
        if (deviceToken?.data) {
          adminApi.updateFcmToken(deviceToken.data).catch((err) => {
            console.error('Failed to update FCM token on backend:', err);
          });
        }
      }).catch((err) => {
        console.log('[PUSH] FCM token registration not supported on this platform/device:', err.message);
      });
    }
  }, [token]);

  const handleLogout = () => {
    clearSession();
    router.replace('/(auth)/login');
  };

  const isDark = colorScheme === 'dark';

  return (
    <DrawerComponent
      screenOptions={{
        headerStyle: {
          backgroundColor: '#143D2E', // Deep premium brand emerald
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          fontWeight: '900',
          fontSize: 18,
          letterSpacing: 0.5,
        },
        headerTintColor: '#fff',
        drawerActiveTintColor: '#143D2E',
        drawerActiveBackgroundColor: '#F0FDF4', // Very light mint green background for active item
        drawerInactiveTintColor: isDark ? '#A1A1AA' : '#4B5563',
        drawerStyle: {
          backgroundColor: isDark ? '#18181B' : '#fff',
          width: 280,
        },
        drawerLabelStyle: {
          fontWeight: '700',
          fontSize: 14,
          marginLeft: -10,
        },
        headerRight: () => (
          <TouchableOpacity 
            onPress={handleLogout} 
            className="mr-4 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/25 active:scale-95"
          >
            <Text className="text-red-500 font-bold text-xs uppercase tracking-wider">Logout</Text>
          </TouchableOpacity>
        ),
      }}
    >
      <Drawer.Screen 
        name="index" 
        options={{ 
          title: 'Home', 
          drawerLabel: 'Home',
          drawerIcon: ({ color, size }) => <Icon name="home" size={size} color={color} />
        }} 
      />

      <Drawer.Screen 
        name="dashboard" 
        options={{ 
          title: 'Performance & Analytics', 
          drawerLabel: 'Dashboard',
          drawerIcon: ({ color, size }) => <Icon name="grid" size={size} color={color} />
        }} 
      />

      <Drawer.Screen 
        name="orders" 
        options={{ 
          title: 'Orders', 
          drawerLabel: 'Orders',
          drawerIcon: ({ color, size }) => <Icon name="shopping-cart" size={size} color={color} />
        }} 
      />

      <Drawer.Screen 
        name="inventory" 
        options={{ 
          title: 'Inventory', 
          drawerLabel: 'Inventory',
          drawerIcon: ({ color, size }) => <Icon name="package" size={size} color={color} />
        }} 
      />

      <Drawer.Screen 
        name="invoices" 
        options={{ 
          title: 'Invoices', 
          drawerLabel: 'Invoices',
          drawerIcon: ({ color, size }) => <Icon name="file-text" size={size} color={color} />
        }} 
      />

      <Drawer.Screen 
        name="product-requests" 
        options={{ 
          title: 'Product Requests', 
          drawerLabel: 'Product Requests',
          drawerIcon: ({ color, size }) => <Icon name="plus-circle" size={size} color={color} />
        }} 
      />

      <Drawer.Screen 
        name="request-history" 
        options={{ 
          title: 'Request History', 
          drawerLabel: 'Request History',
          drawerIcon: ({ color, size }) => <Icon name="clock" size={size} color={color} />
        }} 
      />

      <Drawer.Screen 
        name="settlement" 
        options={{ 
          title: 'Settlements', 
          drawerLabel: 'Settlements',
          drawerIcon: ({ color, size }) => <Icon name="wallet" size={size} color={color} />
        }} 
      />

      <Drawer.Screen 
        name="referrals" 
        options={{ 
          title: 'Referrals', 
          drawerLabel: 'Referrals',
          drawerIcon: ({ color, size }) => <Icon name="users" size={size} color={color} />
        }} 
      />

      <Drawer.Screen 
        name="staff" 
        options={{ 
          title: 'Manage Staff', 
          drawerLabel: 'Manage Staff',
          drawerIcon: ({ color, size }) => <Icon name="users" size={size} color={color} />
        }} 
      />

      <Drawer.Screen 
        name="profile" 
        options={{ 
          title: 'Profile', 
          drawerLabel: 'Profile',
          drawerIcon: ({ color, size }) => <Icon name="user" size={size} color={color} />
        }} 
      />
    </DrawerComponent>
  );
}
