import { memo, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { storefrontApi } from '../lib/api';
import { useStoreStore } from '../store/useStoreStore';
import type { AvailableCoupon } from '../types/storefront';
import { getAppLanguage } from '../i18n';

interface AvailableCouponsListProps {
  cartTotal: number;
  appliedCode?: string;
  onApply: (code: string, discount: number) => void;
  onRemove: () => void;
}

export const AvailableCouponsList = memo(function AvailableCouponsList({
  cartTotal,
  appliedCode = '',
  onApply,
  onRemove,
}: AvailableCouponsListProps) {
  const { t, i18n } = useTranslation();
  const isHindi = (i18n.language || getAppLanguage()) === 'hi';
  const selectedStore = useStoreStore((state) => state.selectedStore);

  const [coupons, setCoupons] = useState<AvailableCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyingCode, setApplyingCode] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadCoupons() {
      try {
        setLoading(true);
        const list = await storefrontApi.availableCoupons({
          storeId: selectedStore?.id,
          cartTotal,
        });
        if (isMounted) {
          setCoupons(list);
        }
      } catch (err) {
        // Silently fallback if coupons endpoint has no items
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadCoupons();
    return () => {
      isMounted = false;
    };
  }, [selectedStore?.id, cartTotal]);

  const handleApply = async (coupon: AvailableCoupon) => {
    setApplyingCode(coupon.code);
    try {
      const res = await storefrontApi.validateCoupon({
        code: coupon.code,
        storeId: selectedStore?.id,
        cartTotal,
      });

      if (res.valid) {
        onApply(coupon.code, res.discount || 0);
        Alert.alert(
          isHindi ? 'कूपन लागू हुआ!' : 'Coupon Applied!',
          isHindi
            ? `बधाई! '${coupon.code}' कूपन से आपको ₹${res.discount || 0} की छूट मिली।`
            : `Coupon '${coupon.code}' applied! You saved ₹${res.discount || 0}.`,
        );
      } else {
        Alert.alert(
          isHindi ? 'कूपन लागू नहीं हुआ' : 'Coupon Error',
          res.message || (isHindi ? 'यह कूपन अमान्य है' : 'Invalid coupon'),
        );
      }
    } catch (err: any) {
      Alert.alert(
        isHindi ? 'त्रुटि' : 'Error',
        err?.message || (isHindi ? 'कूपन लागू करने में समस्या आई' : 'Failed to apply coupon'),
      );
    } finally {
      setApplyingCode(null);
    }
  };

  if (loading) {
    return (
      <View className="py-3 items-center justify-center">
        <ActivityIndicator size="small" color="#10B981" />
      </View>
    );
  }

  if (!coupons.length) return null;

  return (
    <View className="mt-4">
      <View className="flex-row items-center justify-between mb-2.5 px-0.5">
        <View className="flex-row items-center gap-1.5">
          <Feather name="tag" size={13} color="#047857" />
          <Text className="text-xs font-black uppercase tracking-[1.5px] text-emerald-800">
            {isHindi ? 'उपलब्ध कूपन और ऑफर्स' : 'AVAILABLE COUPONS & OFFERS'}
          </Text>
        </View>
        <Text className="text-[10px] font-bold text-slate-500">
          {coupons.length} {isHindi ? 'ऑफर' : 'available'}
        </Text>
      </View>

      <View className="gap-2.5">
        {coupons.map((coupon) => {
          const isCurrentApplied = appliedCode.toUpperCase() === coupon.code.toUpperCase();
          const isEligible = cartTotal >= (coupon.minOrderAmount || 0);
          const deficit = Math.max(0, (coupon.minOrderAmount || 0) - cartTotal);

          return (
            <View
              key={coupon._id || coupon.code}
              style={[
                styles.ticketContainer,
                isCurrentApplied ? styles.ticketApplied : styles.ticketDefault,
              ]}
            >
              {/* Left Ticket Notch Cutout */}
              <View style={[styles.notch, styles.notchLeft]} />
              {/* Right Ticket Notch Cutout */}
              <View style={[styles.notch, styles.notchRight]} />

              <View className="flex-row items-center justify-between gap-2">
                <View className="flex-1 pr-2">
                  <View className="flex-row items-center gap-2 mb-1">
                    <View className="self-start rounded-md border border-dashed border-emerald-600 bg-emerald-100/90 px-2 py-0.5">
                      <Text className="text-xs font-black tracking-widest text-emerald-900 uppercase">
                        {coupon.code}
                      </Text>
                    </View>

                    <Text className="text-xs font-black text-emerald-800">
                      {coupon.type === 'percentage'
                        ? `${coupon.value}% OFF`
                        : `₹${coupon.value} FLAT OFF`}
                    </Text>
                  </View>

                  <Text className="text-[11px] font-semibold text-slate-700 leading-tight">
                    {coupon.description ||
                      (coupon.minOrderAmount > 0
                        ? isHindi
                          ? `₹${coupon.minOrderAmount} से अधिक के आर्डर पर लागू`
                          : `Applicable on orders above ₹${coupon.minOrderAmount}`
                        : isHindi
                          ? 'सभी आर्डर्स पर लागू'
                          : 'Applicable on all orders')}
                  </Text>

                  {!isEligible && deficit > 0 ? (
                    <Text className="text-[10px] font-bold text-amber-700 mt-1">
                      {isHindi
                        ? `₹${deficit} और जोड़ें इस कूपन को पाने के लिए`
                        : `Add ₹${deficit} more to unlock this coupon`}
                    </Text>
                  ) : null}
                </View>

                {/* Apply / Remove Action Button */}
                <View>
                  {isCurrentApplied ? (
                    <View className="items-end gap-1">
                      <View className="flex-row items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 shadow-xs">
                        <Feather name="check" size={12} color="#FFFFFF" />
                        <Text className="text-[11px] font-black uppercase text-white tracking-wider">
                          {isHindi ? 'लागू है' : 'APPLIED'}
                        </Text>
                      </View>
                      <Pressable onPress={onRemove} hitSlop={8}>
                        <Text className="text-[10px] font-black uppercase text-rose-600 underline">
                          {isHindi ? 'हटाएं' : 'Remove'}
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => handleApply(coupon)}
                      disabled={!isEligible || applyingCode === coupon.code}
                      className={`rounded-xl px-4 py-2 border items-center justify-center active:scale-95 ${
                        isEligible
                          ? 'border-emerald-700 bg-emerald-700 shadow-xs'
                          : 'border-slate-200 bg-slate-100 opacity-60'
                      }`}
                    >
                      <Text
                        className={`text-xs font-black uppercase tracking-wider ${
                          isEligible ? 'text-white' : 'text-slate-400'
                        }`}
                      >
                        {applyingCode === coupon.code
                          ? '...'
                          : isHindi
                            ? 'लागू करें'
                            : 'APPLY'}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  ticketContainer: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    position: 'relative',
    overflow: 'hidden',
  },
  ticketDefault: {
    borderColor: '#34D399',
    backgroundColor: '#F0FDF4',
  },
  ticketApplied: {
    borderColor: '#059669',
    backgroundColor: '#ECFDF5',
  },
  notch: {
    position: 'absolute',
    top: '50%',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    transform: [{ translateY: -7 }],
  },
  notchLeft: {
    left: -8,
  },
  notchRight: {
    right: -8,
  },
});
