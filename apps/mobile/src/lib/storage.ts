import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export const asyncStorage = {
  getItem: async (name: string) => {
    const value = await AsyncStorage.getItem(name);
    return value ?? null;
  },
  setItem: async (name: string, value: string) => {
    await AsyncStorage.setItem(name, value);
  },
  removeItem: async (name: string) => {
    await AsyncStorage.removeItem(name);
  },
};

export const secureStorage = {
  getItem: async (name: string) => {
    if (Platform.OS === 'web') {
      return AsyncStorage.getItem(name);
    }
    try {
      const value = await SecureStore.getItemAsync(name);
      return value ?? null;
    } catch {
      return AsyncStorage.getItem(name);
    }
  },
  setItem: async (name: string, value: string) => {
    if (Platform.OS === 'web') {
      return AsyncStorage.setItem(name, value);
    }
    try {
      await SecureStore.setItemAsync(name, value);
    } catch {
      await AsyncStorage.setItem(name, value);
    }
  },
  removeItem: async (name: string) => {
    if (Platform.OS === 'web') {
      return AsyncStorage.removeItem(name);
    }
    try {
      await SecureStore.deleteItemAsync(name);
    } catch {
      await AsyncStorage.removeItem(name);
    }
  },
};
