import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { storefrontApi } from '../lib/api';
import { useServiceModeStore } from '../store/useServiceModeStore';
import { useStoreStore } from '../store/useStoreStore';
import { useAuthStore } from '../store/useAuthStore';
import type { Address, ServiceMode } from '../types/storefront';
import { formatStoreAddress } from '../utils/format';

const emptyAddress: Address = {
  street: '',
  city: '',
  state: '',
  pincode: '',
  landmark: '',
};

const PLACEHOLDER_VALUES = new Set(['pending', 'na', 'n/a', 'none', 'null', 'undefined']);

function normalizeAddressToken(value?: string): string {
  return (value || '').trim().toLowerCase();
}

function isSelectablePickupStore(store: { address: Address }): boolean {
  const street = normalizeAddressToken(store.address.street);
  const city = normalizeAddressToken(store.address.city);
  const state = normalizeAddressToken(store.address.state);
  const pincode = normalizeAddressToken(store.address.pincode);

  if (!street || !city || !state || !pincode) return false;
  if (PLACEHOLDER_VALUES.has(city) || PLACEHOLDER_VALUES.has(state)) return false;
  if (pincode === '000000') return false;

  return true;
}

export function StoreSelectorSheet() {
  const { t } = useTranslation();
  const isOpen = useServiceModeStore((state) => state.selectorOpen);
  const mode = useServiceModeStore((state) => state.mode);
  const address = useServiceModeStore((state) => state.address);
  const setMode = useServiceModeStore((state) => state.setMode);
  const setAddress = useServiceModeStore((state) => state.setAddress);
  const closeSelector = useServiceModeStore((state) => state.closeSelector);
  const selectedStore = useStoreStore((state) => state.selectedStore);
  const setStore = useStoreStore((state) => state.setStore);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [draftMode, setDraftMode] = useState<ServiceMode>(mode);
  const [draftAddress, setDraftAddress] = useState<Address>(address || user?.savedAddress || emptyAddress);
  const [draftStoreId, setDraftStoreId] = useState(selectedStore?.id || '');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const storesQuery = useQuery({
    queryKey: ['mobile-stores'],
    queryFn: storefrontApi.stores,
    enabled: isOpen,
  });

  useEffect(() => {
    if (!isOpen) return;
    setDraftMode(mode);
    setDraftAddress(address || user?.savedAddress || emptyAddress);
    setDraftStoreId(selectedStore?.id || '');
    setError('');
  }, [address, isOpen, mode, selectedStore?.id, user?.savedAddress]);

  const availableStores = useMemo(
    () => (storesQuery.data || []).filter((store) => isSelectablePickupStore(store)),
    [storesQuery.data],
  );

  useEffect(() => {
    if (!isOpen || draftMode !== 'pickup' || !draftStoreId) return;
    if (!availableStores.some((store) => store.id === draftStoreId)) {
      setDraftStoreId('');
    }
  }, [availableStores, draftMode, draftStoreId, isOpen]);

  const filteredStores = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return availableStores;

    return availableStores.filter((store) =>
      [store.name, store.address.city, store.address.state, store.address.street]
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [availableStores, search]);

  const handleSave = async () => {
    setError('');
    if (draftMode === 'delivery') {
      if (!draftAddress.street || !draftAddress.city || !draftAddress.state || !draftAddress.pincode) {
        setError('Please complete your delivery address.');
        return;
      }
    } else if (!draftStoreId) {
      setError('Please pick a store for pickup.');
      return;
    }

    const chosenStore = availableStores.find((store) => store.id === draftStoreId) || null;

    if (draftMode === 'pickup' && !chosenStore) {
      setError('Please pick an active approved store for pickup.');
      return;
    }

    setSaving(true);
    try {
      setMode(draftMode);
      if (draftMode === 'delivery') {
        setAddress(draftAddress);
      }
      if (chosenStore) {
        setStore(chosenStore);
      }

      if (user) {
        const updatedModeUser = await storefrontApi.updateServiceMode(draftMode);
        let nextUser = updatedModeUser;

        if (draftMode === 'delivery') {
          nextUser = await storefrontApi.updateMe({ savedAddress: draftAddress });
        }

        if (chosenStore) {
          nextUser = await storefrontApi.updateSelectedStore(chosenStore.id);
          await storefrontApi.selectStore(chosenStore.id);
        }

        setUser(nextUser);
      }

      closeSelector();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not save your preference.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={isOpen} animationType="slide" transparent onRequestClose={closeSelector}>
      <View className="flex-1 justify-end bg-primary-900/40">
        <Pressable className="flex-1" onPress={closeSelector} />
        <View className="max-h-[90%] rounded-t-[32px] bg-offwhite px-5 pb-8 pt-5">
          <View className="mb-5 h-1.5 w-14 self-center rounded-full bg-primary-100" />
          <View className="mb-5 flex-row rounded-full bg-primary-50 p-1">
            {(['delivery', 'pickup'] as const).map((item) => (
              <Pressable
                key={item}
                onPress={() => setDraftMode(item)}
                className={`flex-1 rounded-full px-3 py-3 ${draftMode === item ? 'bg-white' : ''}`}
              >
                <View className="flex-row items-center justify-center gap-1.5">
                  <Feather
                    name={item === 'delivery' ? 'truck' : 'shopping-bag'}
                    size={13}
                    color={draftMode === item ? '#082018' : '#6D8A7D'}
                  />
                  <Text
                    className={`text-center text-xs font-black uppercase tracking-[2px] ${
                      draftMode === item ? 'text-primary-900' : 'text-primary-900/45'
                    }`}
                  >
                    {item === 'delivery' ? t('mobile.serviceMode.delivery') : t('mobile.serviceMode.pickup')}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {draftMode === 'delivery' ? (
              <View className="gap-3">
                {([
                  ['street', 'Street Address'],
                  ['city', 'City'],
                  ['state', 'State'],
                  ['pincode', 'Pincode'],
                  ['landmark', 'Landmark'],
                ] as const).map(([key, label]) => (
                  <View key={key}>
                    <Text className="mb-2 text-[11px] font-black uppercase tracking-[2px] text-primary-500">
                      {label}
                    </Text>
                    <TextInput
                      value={draftAddress[key] || ''}
                      onChangeText={(value) =>
                        setDraftAddress((current) => ({ ...current, [key]: value }))
                      }
                      placeholder={label}
                      className="rounded-[20px] border border-primary-100 bg-white px-4 py-4 text-base text-primary-900"
                      placeholderTextColor="#7a978b"
                    />
                  </View>
                ))}
              </View>
            ) : (
              <View className="gap-3">
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search by city, area, or store"
                  className="rounded-[20px] border border-primary-100 bg-white px-4 py-4 text-base text-primary-900"
                  placeholderTextColor="#7a978b"
                />
                {storesQuery.isLoading ? (
                  <View className="py-10">
                    <ActivityIndicator color="#2D6A4F" />
                  </View>
                ) : (
                  filteredStores.map((store) => {
                    const active = draftStoreId === store.id;

                    return (
                      <Pressable
                        key={store.id}
                        onPress={() => setDraftStoreId(store.id)}
                        className={`rounded-[24px] border px-4 py-4 ${
                          active ? 'border-primary-500 bg-primary-500' : 'border-primary-100 bg-white'
                        }`}
                      >
                        <Text className={`text-base font-black ${active ? 'text-white' : 'text-primary-900'}`}>
                          {store.name}
                        </Text>
                        <Text className={`mt-2 text-sm ${active ? 'text-white/80' : 'text-primary-900/60'}`}>
                          {formatStoreAddress(store.address)}
                        </Text>
                        <Text className={`mt-2 text-xs font-semibold ${active ? 'text-white/80' : 'text-primary-500'}`}>
                          {store.phone}
                        </Text>
                      </Pressable>
                    );
                  })
                )}
              </View>
            )}
          </ScrollView>

          {Boolean(error) && (
            <Text className="mt-4 text-center text-sm font-semibold text-red-600">{error}</Text>
          )}

          <Pressable
            onPress={handleSave}
            disabled={saving}
            className="mt-5 rounded-full bg-primary-500 px-5 py-4"
          >
            <Text className="text-center text-sm font-black uppercase tracking-[2px] text-white">
              {saving ? 'Saving...' : 'Save Preference'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
