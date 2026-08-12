import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { storefrontApi } from '../lib/api';
import { useServiceModeStore } from '../store/useServiceModeStore';
import { useStoreStore } from '../store/useStoreStore';
import { useAuthStore } from '../store/useAuthStore';
import type { Address, ServiceMode } from '../types/storefront';
import { buildStoreDirectionsUrl, formatStoreAddress } from '../utils/format';
import { useFocusAwareScroll } from '../hooks/useFocusAwareScroll';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { LocationMapPicker } from './LocationMapPicker';

const emptyAddress: Address = {
  street: '',
  city: '',
  district: '',
  state: '',
  pincode: '',
  landmark: '',
};

const PLACEHOLDER_VALUES = new Set(['pending', 'na', 'n/a', 'none', 'null', 'undefined']);

const SCREEN_HEIGHT = Dimensions.get('window').height;

function normalizeAddressToken(value?: string): string {
  return (value || '').trim().toLowerCase();
}

function isSelectablePickupStore(store: { address: Address }): boolean {
  const street = normalizeAddressToken(store.address.street);
  const city = normalizeAddressToken(store.address.city);
  const state = normalizeAddressToken(store.address.state);

  if (!street || !city || !state) return false;
  if (PLACEHOLDER_VALUES.has(city) || PLACEHOLDER_VALUES.has(state)) return false;

  return true;
}

export function StoreSelectorSheet() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isOpen = useServiceModeStore((state) => state.selectorOpen);
  const mode = useServiceModeStore((state) => state.mode);
  const address = useServiceModeStore((state) => state.address);
  const setMode = useServiceModeStore((state) => state.setMode);
  const setAddress = useServiceModeStore((state) => state.setAddress);
  const closeSelector = useServiceModeStore((state) => state.closeSelector);
  const setHasChosenMode = useServiceModeStore((state) => state.setHasChosenMode);
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
  const { scrollRef, onInputFocus } = useFocusAwareScroll(100);
  const debouncedSearch = useDebouncedValue(search, 300);

  const topGap = insets.top + 12;
  const MAX_HEIGHT = SCREEN_HEIGHT - topGap;
  const DEFAULT_HEIGHT = Math.round(MAX_HEIGHT * 0.62);
  const CLOSE_THRESHOLD = Math.round(DEFAULT_HEIGHT * 0.7);

  const height = useSharedValue(0);
  const startHeight = useSharedValue(0);

  const animateClose = () => {
    height.value = withTiming(0, { duration: 220 }, (finished) => {
      if (finished) runOnJS(closeSelector)();
    });
  };

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
    setSearch('');
    setError('');
    height.value = 0;
    height.value = withSpring(DEFAULT_HEIGHT, { damping: 22, stiffness: 220 });
  }, [address, isOpen, mode, selectedStore?.id, user?.savedAddress]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          startHeight.value = height.value;
        })
        .onUpdate((event) => {
          // Dragging up (negative translationY) grows the sheet toward the top.
          const next = startHeight.value - event.translationY;
          height.value = Math.min(Math.max(next, 0), MAX_HEIGHT);
        })
        .onEnd((event) => {
          if (event.velocityY > 1100 || height.value < CLOSE_THRESHOLD) {
            height.value = withTiming(0, { duration: 220 }, (finished) => {
              if (finished) runOnJS(closeSelector)();
            });
            return;
          }

          if (event.velocityY < -400 || height.value > (DEFAULT_HEIGHT + MAX_HEIGHT) / 2) {
            height.value = withSpring(MAX_HEIGHT, { damping: 22, stiffness: 220 });
            return;
          }

          height.value = withSpring(DEFAULT_HEIGHT, { damping: 22, stiffness: 220 });
        }),
    [MAX_HEIGHT, DEFAULT_HEIGHT, CLOSE_THRESHOLD],
  );

  const sheetStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

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
    const term = debouncedSearch.trim().toLowerCase();
    if (!term) return availableStores;

    return availableStores.filter((store) =>
      [
        store.name,
        store.address.street,
        store.address.city,
        store.address.district,
        store.address.state,
        store.address.pincode,
        store.address.landmark,
        store.phone,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [availableStores, debouncedSearch]);

  const openDirections = (store: (typeof availableStores)[number]) => {
    const url = buildStoreDirectionsUrl(store);
    Linking.openURL(url).catch(() => undefined);
  };

  const handleSave = async () => {
    setError('');
    if (draftMode === 'delivery') {
      if (!draftAddress.street || !draftAddress.city || !draftAddress.state || !draftAddress.pincode) {
        setError('Please complete your delivery address.');
        return;
      }
    } else if (!draftStoreId) {
      setError('Please pick a store.');
      return;
    }

    const chosenStore = availableStores.find((store) => store.id === draftStoreId) || null;

    if (draftMode === 'pickup' && !chosenStore) {
      setError('Please pick an active approved store.');
      return;
    }

    setSaving(true);
    try {
      setMode(draftMode);
      if (draftMode === 'delivery') {
        setAddress(draftAddress);
        setStore(null);
        setDraftStoreId('');
      }
      if (draftMode === 'pickup' && chosenStore) {
        setStore(chosenStore);
      }

      if (user) {
        const updatedModeUser = await storefrontApi.updateServiceMode(draftMode);
        let nextUser = updatedModeUser;

        if (draftMode === 'delivery') {
          nextUser = await storefrontApi.updateMe({ savedAddress: draftAddress });
        }

        if (draftMode === 'pickup' && chosenStore) {
          nextUser = await storefrontApi.updateSelectedStore(chosenStore.id);
          await storefrontApi.selectStore(chosenStore.id);
        }

        setUser(nextUser);
      }

      animateClose();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not save your preference.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={isOpen} animationType="fade" transparent onRequestClose={animateClose}>
      <View className="flex-1 justify-end bg-primary-900/40">
        <Pressable className="flex-1" onPress={animateClose} />
        <Animated.View
          style={[sheetStyle, { maxHeight: MAX_HEIGHT }]}
          className="w-full rounded-t-[32px] bg-offwhite px-5 pb-8 pt-3"
        >
          <GestureDetector gesture={panGesture}>
            <View className="pb-2">
              <View className="mb-4 mt-1 h-1.5 w-14 self-center rounded-full bg-primary-100" />
              <View className="flex-row rounded-full bg-primary-50 p-1">
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
            </View>
          </GestureDetector>

          {draftMode === 'pickup' && (
            <View className="mb-4 mt-2">
              <TextInput
                value={search}
                onChangeText={setSearch}
                onFocus={onInputFocus}
                placeholder={t('mobile.serviceMode.searchStore')}
                className="rounded-[20px] border border-primary-100 bg-white px-4 py-4 text-base text-primary-900"
                placeholderTextColor="#7a978b"
              />
            </View>
          )}

          <ScrollView
            ref={scrollRef}
            className="flex-1"
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {draftMode === 'delivery' ? (
              <View className="gap-3 pb-4">
                <LocationMapPicker
                  currentPincode={draftAddress.pincode}
                  currentState={draftAddress.state}
                  currentCity={draftAddress.city}
                  onLocationSelect={(res) => {
                    setDraftAddress((current) => ({
                      ...current,
                      street: res.street || current.street,
                      city: res.city || current.city,
                      state: res.state || current.state,
                      pincode: res.pincode || current.pincode,
                      landmark: res.landmark || current.landmark,
                    }));
                  }}
                />

                {([
                  ['street', 'Street Address'],
                  ['city', 'City / District'],
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
                      onFocus={onInputFocus}
                      placeholder={label}
                      className="rounded-[20px] border border-primary-100 bg-white px-4 py-4 text-base text-primary-900"
                      placeholderTextColor="#7a978b"
                    />
                  </View>
                ))}
              </View>
            ) : (
              <View className="gap-3 pb-4">
                {storesQuery.isLoading ? (
                  <View className="py-10">
                    <ActivityIndicator color="#2D6A4F" />
                  </View>
                ) : filteredStores.length === 0 ? (
                  <Text className="py-10 text-center text-sm text-primary-900/55">
                    {t('mobile.serviceMode.noStores')}
                  </Text>
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
                        <View className="flex-row items-start justify-between gap-3">
                          <View className="flex-1">
                            <Text className={`text-base font-black ${active ? 'text-white' : 'text-primary-900'}`}>
                              {store.name}
                            </Text>
                            <Text className={`mt-2 text-sm ${active ? 'text-white/80' : 'text-primary-900/60'}`}>
                              {formatStoreAddress(store.address)}
                            </Text>
                            <Text
                              className={`mt-2 text-xs font-semibold ${active ? 'text-white/80' : 'text-primary-500'}`}
                            >
                              {store.phone}
                            </Text>
                          </View>
                          <Pressable
                            onPress={() => openDirections(store)}
                            hitSlop={10}
                            accessibilityLabel={t('mobile.serviceMode.getDirections')}
                            className={`h-11 w-11 items-center justify-center rounded-full ${
                              active ? 'bg-white/20' : 'bg-primary-50'
                            }`}
                          >
                            <Feather name="navigation" size={18} color={active ? '#ffffff' : '#2D6A4F'} />
                          </Pressable>
                        </View>
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
        </Animated.View>
      </View>
    </Modal>
  );
}
