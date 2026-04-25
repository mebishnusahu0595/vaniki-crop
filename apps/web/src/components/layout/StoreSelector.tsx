import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Search,
  Phone,
  CheckCircle2,
  Clock3,
  Truck,
  Store as StoreIcon,
  Navigation,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useStoreStore } from '../../store/useStoreStore';
import { useServiceModeStore } from '../../store/useServiceModeStore';
import { useAuthStore } from '../../store/useAuthStore';
import { storefrontApi } from '../../utils/api';
import type { Address, ServiceMode, Store } from '../../types/storefront';
import { cn } from '../../utils/cn';
import { formatStoreAddress } from '../../utils/format';

interface StoreSelectorProps {
  isOpen: boolean;
  preferredMode?: ServiceMode;
  onClose: () => void;
}

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

function isSelectablePickupStore(store: Store): boolean {
  const street = normalizeAddressToken(store.address.street);
  const city = normalizeAddressToken(store.address.city);
  const state = normalizeAddressToken(store.address.state);

  if (!street || !city || !state) return false;
  if (PLACEHOLDER_VALUES.has(city) || PLACEHOLDER_VALUES.has(state)) return false;

  return true;
}

function getOpenHoursText(store: Store) {
  const openHours = store.openHours || {};
  return openHours.monday || openHours.friday || openHours.saturday || '9am - 7pm';
}

function buildDirectionsUrl(store: Store) {
  const coordinates = store.location?.coordinates;
  if (coordinates) {
    return `https://www.google.com/maps?q=${coordinates[1]},${coordinates[0]}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatStoreAddress(store.address))}`;
}

const mobileSheetVariants = {
  hidden: { y: '100%', opacity: 1 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring' as const, damping: 25, stiffness: 300 },
  },
  exit: {
    y: '100%',
    transition: { duration: 0.2 },
  },
};

const desktopSheetVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.16 } },
};

const StoreSelector: React.FC<StoreSelectorProps> = ({ isOpen, preferredMode, onClose }) => {
  const { t } = useTranslation();
  const { selectedStore, setStore } = useStoreStore();
  const { mode, address, setMode, setAddress } = useServiceModeStore();
  const { user, isAuthenticated, updateUser } = useAuthStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [draftMode, setDraftMode] = useState<ServiceMode>(preferredMode || mode);
  const [draftAddress, setDraftAddress] = useState<Address>(address || user?.savedAddress || emptyAddress);
  const [draftStoreId, setDraftStoreId] = useState<string>(selectedStore?.id || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches,
  );

  const { data: stores = [], isLoading } = useQuery({
    queryKey: ['stores'],
    queryFn: storefrontApi.stores,
    enabled: isOpen,
  });

  const availableStores = useMemo(() => stores.filter((store) => isSelectablePickupStore(store)), [stores]);

  useEffect(() => {
    if (!isOpen) return;

    setDraftMode(preferredMode || mode);
    setDraftAddress(address || user?.savedAddress || emptyAddress);
    setDraftStoreId(selectedStore?.id || '');
  }, [address, isOpen, mode, preferredMode, selectedStore?.id, user?.savedAddress]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const handleMediaChange = () => {
      setIsDesktop(mediaQuery.matches);
    };

    handleMediaChange();
    mediaQuery.addEventListener('change', handleMediaChange);

    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const filteredStores = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return availableStores;

    return availableStores.filter((store) =>
      [store.name, store.address.street, store.address.city, store.address.state]
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [availableStores, searchTerm]);

  useEffect(() => {
    if (!isOpen || draftMode !== 'pickup' || !draftStoreId) return;
    if (!availableStores.some((store) => store.id === draftStoreId)) {
      setDraftStoreId('');
    }
  }, [availableStores, draftMode, draftStoreId, isOpen]);

  const activeStore =
    filteredStores.find((store) => store.id === draftStoreId)
    || availableStores.find((store) => store.id === draftStoreId);

  const handleSave = async () => {
    if (draftMode === 'pickup' && !draftStoreId) {
      toast.error(t('storeSelector.choosePickupStore'));
      return;
    }

    if (
      draftMode === 'delivery' &&
      (!draftAddress.street || !draftAddress.city || !draftAddress.state || !draftAddress.pincode)
    ) {
      toast.error(t('storeSelector.completeDeliveryAddress'));
      return;
    }

    const chosenStore = availableStores.find((store) => store.id === draftStoreId) || null;

    if (draftMode === 'pickup' && !chosenStore) {
      toast.error(t('storeSelector.choosePickupStore'));
      return;
    }

    setIsSaving(true);
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

      if (isAuthenticated) {
        const modeUser = await storefrontApi.updateServiceMode(draftMode);
        updateUser(modeUser);

        if (draftMode === 'delivery') {
          const updatedUser = await storefrontApi.updateMe({ savedAddress: draftAddress });
          updateUser(updatedUser);
        }

        if (draftMode === 'pickup' && chosenStore) {
          await storefrontApi.selectStore(chosenStore.id);
          updateUser({ selectedStore: chosenStore });
        }
      }

      toast.success(draftMode === 'delivery' ? t('storeSelector.deliverySaved') : t('storeSelector.pickupSaved'));
      onClose();
    } catch {
      toast.error(t('storeSelector.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[200] bg-primary-900/60 backdrop-blur-md"
          />
          <motion.div
            variants={isDesktop ? desktopSheetVariants : mobileSheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-x-4 bottom-4 top-14 z-[201] flex flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl md:inset-auto md:left-1/2 md:top-1/2 md:max-h-[88vh] md:w-full md:max-w-5xl md:-translate-x-1/2 md:-translate-y-1/2"
          >
            <div className="flex items-center justify-between border-b border-primary-100 bg-primary-50/60 px-5 py-4 sm:px-8">
              <div>
                <p className="section-kicker mb-1">{t('storeSelector.serviceMode')}</p>
                <h2 className="text-2xl font-black text-primary-900">{t('storeSelector.deliveryOrPickup')}</h2>
              </div>
              <button onClick={onClose} className="rounded-full p-2 transition hover:bg-white">
                <X size={22} />
              </button>
            </div>

            <div className="flex flex-col gap-0 overflow-hidden md:flex-row md:divide-x md:divide-primary-100">
              <div className="w-full space-y-6 overflow-y-auto p-5 sm:p-8 md:w-[380px]">
                <div className="grid grid-cols-2 gap-2 rounded-[1.5rem] border border-primary-100 bg-primary-50 p-1">
                  {([
                    { key: 'delivery', label: t('storeSelector.delivery'), icon: Truck },
                    { key: 'pickup', label: t('storeSelector.pickup'), icon: StoreIcon },
                  ] as const).map((item) => (
                    <button
                      key={item.key}
                      onClick={() => setDraftMode(item.key)}
                      className={cn(
                        'flex items-center justify-center gap-2 rounded-[1.25rem] px-4 py-3 text-sm font-black transition',
                        draftMode === item.key ? 'bg-white text-primary-900 shadow-sm' : 'text-primary-900/55',
                      )}
                    >
                      <item.icon size={16} />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>

                {draftMode === 'delivery' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-primary-500">
                        {t('storeSelector.streetAddress')}
                      </label>
                      <input
                        value={draftAddress.street}
                        onChange={(event) => setDraftAddress((current) => ({ ...current, street: event.target.value }))}
                        placeholder={t('storeSelector.streetPlaceholder')}
                        className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-primary-500">
                          {t('storeSelector.city')}
                        </label>
                        <input
                          value={draftAddress.city}
                          onChange={(event) => setDraftAddress((current) => ({ ...current, city: event.target.value }))}
                          className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-primary-500">
                          {t('storeSelector.state')}
                        </label>
                        <input
                          value={draftAddress.state}
                          onChange={(event) => setDraftAddress((current) => ({ ...current, state: event.target.value }))}
                          className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-primary-500">
                          {t('storeSelector.pincode')}
                        </label>
                        <input
                          value={draftAddress.pincode}
                          onChange={(event) => setDraftAddress((current) => ({ ...current, pincode: event.target.value }))}
                          className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-primary-500">
                          {t('storeSelector.landmark')}
                        </label>
                        <input
                          value={draftAddress.landmark || ''}
                          onChange={(event) => setDraftAddress((current) => ({ ...current, landmark: event.target.value }))}
                          className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900"
                        />
                      </div>
                    </div>
                    <div className="rounded-[1.5rem] border border-primary-100 bg-primary-50/60 p-4 text-sm font-medium text-primary-900/65">
                      {t('storeSelector.addressHint')}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-900/25" size={18} />
                      <input
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder={t('storeSelector.searchStore')}
                        className="w-full rounded-2xl border border-primary-100 bg-primary-50 py-3 pl-11 pr-4 font-semibold text-primary-900"
                      />
                    </div>

                    <div className="space-y-3 pr-1">
                      {isLoading ? (
                        [...Array(4)].map((_, index) => (
                          <div key={index} className="h-24 animate-pulse rounded-[1.5rem] bg-primary-50" />
                        ))
                      ) : (
                        filteredStores.map((store) => {
                          const isActive = draftStoreId === store.id;

                          return (
                            <button
                              key={store.id}
                              onClick={() => setDraftStoreId(store.id)}
                              className={cn(
                                'w-full rounded-[1.5rem] border p-4 text-left transition',
                                isActive ? 'border-primary bg-primary text-white' : 'border-primary-100 bg-white hover:bg-primary-50',
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3 className="text-base font-black">{store.name}</h3>
                                    {isActive && <CheckCircle2 size={16} />}
                                  </div>
                                  <p className={cn('mt-1 text-sm font-medium', isActive ? 'text-white/70' : 'text-primary-900/55')}>
                                    {formatStoreAddress(store.address)}
                                  </p>
                                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-bold uppercase tracking-[0.18em]">
                                    <span className="inline-flex items-center gap-1.5">
                                      <Phone size={13} />
                                      {store.phone}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5">
                                      <Clock3 size={13} />
                                      {getOpenHoursText(store)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-black uppercase tracking-[0.22em] text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-100"
                >
                  {isSaving
                    ? t('storeSelector.saving')
                    : draftMode === 'delivery'
                      ? t('storeSelector.saveDeliveryDetails')
                      : t('storeSelector.savePickupStore')}
                </button>
              </div>

              <div className="hidden flex-1 bg-[linear-gradient(180deg,_rgba(240,250,245,0.9),_rgba(255,255,255,0.96))] p-8 md:block">
                <div className="surface-card h-full overflow-hidden p-6">
                  {draftMode === 'delivery' ? (
                    <div className="flex h-full flex-col justify-between">
                      <div>
                        <p className="section-kicker mb-2">{t('storeSelector.deliverySnapshot')}</p>
                        <h3 className="font-heading text-4xl text-primary-900">{t('storeSelector.deliverySnapshotTitle')}</h3>
                        <p className="mt-4 max-w-lg text-base font-medium leading-7 text-primary-900/65">
                          {t('storeSelector.deliverySnapshotDescription')}
                        </p>
                      </div>
                      <div className="rounded-[2rem] bg-primary-900 p-6 text-white">
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-primary-300">{t('storeSelector.currentAddress')}</p>
                        <p className="mt-3 text-lg font-semibold">
                          {formatStoreAddress(draftAddress) || t('storeSelector.addAddressPrompt')}
                        </p>
                      </div>
                    </div>
                  ) : activeStore ? (
                    <div className="flex h-full flex-col justify-between">
                      <div>
                        <p className="section-kicker mb-2">{t('storeSelector.selectedStore')}</p>
                        <h3 className="font-heading text-4xl text-primary-900">{activeStore.name}</h3>
                        <p className="mt-4 max-w-lg text-base font-medium leading-7 text-primary-900/65">
                          {formatStoreAddress(activeStore.address)}
                        </p>
                        <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold text-primary-900/70">
                          <span className="rounded-full bg-primary-50 px-4 py-2">{activeStore.phone}</span>
                          <span className="rounded-full bg-primary-50 px-4 py-2">{getOpenHoursText(activeStore)}</span>
                        </div>
                      </div>
                      <div className="rounded-[2rem] bg-primary-900/5 p-4">
                        <a
                          href={buildDirectionsUrl(activeStore)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-xs font-black uppercase tracking-[0.22em] text-white"
                        >
                          <Navigation size={14} />
                          {t('storeSelector.getDirections')}
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-[2rem] border border-dashed border-primary-100 bg-primary-50/40 text-center">
                      <div className="max-w-sm px-8">
                        <StoreIcon size={28} className="mx-auto text-primary-400" />
                        <h3 className="mt-4 text-xl font-black text-primary-900">{t('storeSelector.chooseStore')}</h3>
                        <p className="mt-2 text-sm font-medium leading-6 text-primary-900/60">
                          {t('storeSelector.chooseStoreDescription')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default StoreSelector;
