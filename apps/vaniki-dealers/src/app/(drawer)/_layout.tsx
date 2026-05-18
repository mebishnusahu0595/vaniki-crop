import { Drawer } from 'expo-router/drawer';
import React from 'react';
import { useColorScheme, TouchableOpacity, Text, View } from 'react-native';
import { useAdminAuthStore } from '../../store/useAdminAuthStore';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

const Icon = Feather as any;
const DrawerComponent = Drawer as any;

export default function DrawerLayout() {
  const colorScheme = useColorScheme();
  const { clearSession } = useAdminAuthStore();
  const router = useRouter();

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
      {/* Redirect target (hidden from drawer UI) */}
      <Drawer.Screen 
        name="index" 
        options={{ 
          drawerItemStyle: { display: 'none' },
          headerShown: false,
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
