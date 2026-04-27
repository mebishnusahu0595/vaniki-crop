import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SiteSettings {
  freeDeliveryThreshold: number;
  standardDeliveryCharge: number;
  platformName?: string;
  supportEmail?: string;
  supportPhone?: string;
}

interface SettingsState {
  settings: SiteSettings;
  setSettings: (settings: SiteSettings) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: {
        freeDeliveryThreshold: 200,
        standardDeliveryCharge: 50,
      },
      setSettings: (settings) => set({ settings }),
    }),
    {
      name: 'vaniki-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
