import React, { useState } from 'react';
import { MapPin, Truck, Store, ChevronRight, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useServiceModeStore } from '../../store/useServiceModeStore';
import { useStoreStore } from '../../store/useStoreStore';
import type { ServiceMode } from '../../types/storefront';
import { cn } from '../../utils/cn';
import { formatStoreAddress } from '../../utils/format';

interface ServiceModeBarProps {
  onOpenStoreSelector: (mode?: ServiceMode) => void;
  floating?: boolean;
}

const ServiceModeBar: React.FC<ServiceModeBarProps> = ({ onOpenStoreSelector, floating = false }) => {
  const { t } = useTranslation();
  const { mode, address } = useServiceModeStore();
  const { selectedStore } = useStoreStore();
  const [isExpanded, setIsExpanded] = useState(false);

  const summaryText =
    mode === 'delivery' ? formatStoreAddress(address) : selectedStore?.name || t('serviceModeBar.selectPickupStore');

  if (floating) {
    return (
      <div className="fixed left-4 top-1/2 z-30 hidden -translate-y-1/2 xl:block">
        <div className="surface-card w-[280px] p-4">
          <p className="section-kicker mb-3">{t('serviceModeBar.serviceMode')}</p>
          <div className="grid gap-2">
            {([
              { key: 'delivery', label: t('serviceModeBar.delivery'), icon: Truck },
              { key: 'pickup', label: t('serviceModeBar.pickup'), icon: Store },
            ] as const).map((item) => (
              <button
                key={item.key}
                onClick={() => onOpenStoreSelector(item.key)}
                className={cn(
                  'flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition',
                  mode === item.key ? 'bg-primary text-white' : 'bg-primary-50 text-primary-900 hover:bg-primary-100',
                )}
              >
                <item.icon size={18} />
                <div>
                  <p className="text-sm font-bold">{item.label}</p>
                  <p className={cn('text-xs', mode === item.key ? 'text-white/70' : 'text-primary-900/55')}>
                    {item.key === 'delivery' ? t('serviceModeBar.enterDeliveryAddress') : t('serviceModeBar.selectNearbyStore')}
                  </p>
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => onOpenStoreSelector(mode)}
            className="mt-4 flex w-full items-center justify-between rounded-2xl border border-primary-100 bg-white px-4 py-3 text-left"
          >
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-500">
                {mode === 'delivery' ? t('header.deliveringTo') : t('header.pickupFrom')}
              </p>
              <p className="truncate text-sm font-bold text-primary-900">{summaryText}</p>
            </div>
            <ChevronRight size={18} className="text-primary-900/30" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-primary-100 bg-white lg:hidden">
      <div className="container mx-auto px-4 py-1.5">
        <div className="rounded-[1.2rem] border border-primary-100 bg-primary-900 p-1.5 text-white shadow-lg shadow-primary-900/10">
          <button
            onClick={() => setIsExpanded((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              {mode === 'delivery' ? (
                <Truck size={14} className="shrink-0 text-primary-300" />
              ) : (
                <MapPin size={14} className="shrink-0 text-primary-300" />
              )}
              <div className="min-w-0">
                <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/60">
                  {mode === 'delivery' ? t('header.deliveringTo') : t('header.pickupFrom')}
                </p>
                <p className="truncate text-[12px] font-semibold text-white">{summaryText}</p>
              </div>
            </div>
            <ChevronDown size={15} className={cn('shrink-0 text-white/60 transition-transform', isExpanded && 'rotate-180')} />
          </button>

          {isExpanded && (
            <div className="mt-2 space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  { key: 'delivery', label: t('serviceModeBar.delivery'), icon: Truck },
                  { key: 'pickup', label: t('serviceModeBar.pickup'), icon: Store },
                ] as const).map((item) => (
                  <button
                    key={item.key}
                    onClick={() => onOpenStoreSelector(item.key)}
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-full px-2.5 py-2 text-[11px] font-black transition',
                      mode === item.key ? 'bg-white text-primary-900' : 'bg-white/10 text-white/65',
                    )}
                  >
                    <item.icon size={13} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => onOpenStoreSelector(mode)}
                className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left"
              >
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/60">
                    {mode === 'delivery' ? t('serviceModeBar.enterDeliveryAddress') : t('serviceModeBar.selectNearbyStore')}
                  </p>
                  <p className="truncate text-[12px] font-semibold text-white">{summaryText}</p>
                </div>
                <ChevronRight size={15} className="shrink-0 text-white/55" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ServiceModeBar;
