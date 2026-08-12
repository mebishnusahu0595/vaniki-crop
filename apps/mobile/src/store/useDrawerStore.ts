import { create } from 'zustand';

interface DrawerState {
  isOpen: boolean;
  languageModalOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  openLanguageModal: () => void;
  closeLanguageModal: () => void;
}

export const useDrawerStore = create<DrawerState>((set) => ({
  isOpen: false,
  languageModalOpen: false,
  openDrawer: () => set({ isOpen: true }),
  closeDrawer: () => set({ isOpen: false }),
  toggleDrawer: () => set((state) => ({ isOpen: !state.isOpen })),
  openLanguageModal: () => set({ languageModalOpen: true }),
  closeLanguageModal: () => set({ languageModalOpen: false }),
}));
