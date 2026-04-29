import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SiteSettings {
  freeDeliveryThreshold: number;
  standardDeliveryCharge: number;
  platformName?: string;
  supportEmail?: string;
  supportPhone?: string;
  loyaltyPointRupeeValue?: number;
}

interface SettingsState {
  settings: SiteSettings;
  setSettings: (settings: SiteSettings) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: {
        freeDeliveryThreshold: 200, // New default per user request
        standardDeliveryCharge: 50,
        loyaltyPointRupeeValue: 1,
      },
      setSettings: (settings) => set({ settings }),
    }),
    {
      name: 'vaniki-settings',
    }
  )
);
