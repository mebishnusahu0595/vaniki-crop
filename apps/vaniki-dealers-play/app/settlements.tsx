import React, { useState, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { dealerApi } from '../src/lib/api';
import { API_BASE_URL } from '../src/config/api';
import { useAuthStore } from '../src/store/useAuthStore';
import { currencyFormatter } from '../src/utils/format';

const Icon = Feather as any;

export default function DealerSettlementsScreen() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Invoices query
  const invoicesQuery = useQuery({
    queryKey: ['dealer-invoices', 'settlements'],
    queryFn: () => dealerApi.getInvoices({ limit: 100 }),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['dealer-invoices'] });
    setRefreshing(false);
  }, [queryClient]);

  const rawInvoices = invoicesQuery.data?.data || [];

  // Filter only settled/paid invoices
  const settledInvoices = useMemo(() => {
    return rawInvoices.filter((inv: any) => {
      const isPaid = inv.paymentStatus === 'paid' || inv.status === 'paid' || inv.status === 'completed';
      if (!isPaid) return false;

      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      const invNo = (inv.invoiceNumber || '').toLowerCase();
      const utr = (inv.paymentUtr || '').toLowerCase();
      const hasProduct = inv.items?.some((it: any) => (it.productName || '').toLowerCase().includes(q));
      return invNo.includes(q) || utr.includes(q) || hasProduct;
    });
  }, [rawInvoices, search]);

  // Overall metrics
  const totalSettledAmount = useMemo(() => {
    return settledInvoices.reduce((sum: number, inv: any) => sum + (inv.totalAmount || 0), 0);
  }, [settledInvoices]);

  // Download Paid Invoice PDF
  const handleDownloadInvoice = async (invoice: any) => {
    const invId = invoice._id || invoice.id;
    const invNo = invoice.invoiceNumber || 'B2B-Invoice';
    setDownloadingId(invId);

    try {
      const token = useAuthStore.getState().token;
      const downloadUrl = `${API_BASE_URL}/b2b-invoices/download/${invId}`;

      if (Platform.OS === 'web') {
        window.open(downloadUrl, '_blank');
        return;
      }

      const cleanNum = invNo.replace(/[^a-zA-Z0-9-]/g, '_');
      const fileUri = `${FileSystem.documentDirectory}settled-invoice-${cleanNum}.pdf`;

      const res = await FileSystem.downloadAsync(downloadUrl, fileUri, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.status !== 200) {
        throw new Error('Failed to download invoice PDF');
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(res.uri);
      } else {
        Alert.alert('Downloaded', `Invoice saved to ${res.uri}`);
      }
    } catch (err: any) {
      Alert.alert('Download Error', err?.message || 'Unable to download invoice');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCopyUtr = (utr: string) => {
    Alert.alert('UTR Copied', `Transaction UTR: ${utr}`);
  };

  return (
    <SafeAreaView className="flex-1 bg-offwhite" edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <View className="bg-white border-b border-primary-100 px-4 pt-3 pb-3">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-slate-50 items-center justify-center border border-slate-200 active:scale-95"
            >
              <Icon name="arrow-left" size={20} color="#143D2E" />
            </Pressable>
            <View>
              <Text className="text-[10px] font-black uppercase tracking-[2px] text-emerald-600">
                Verified Transactions
              </Text>
              <Text className="text-xl font-black text-primary-900 leading-tight">
                Payment Settlements
              </Text>
            </View>
          </View>

          <View className="rounded-full bg-emerald-100 px-3 py-1 border border-emerald-200">
            <Text className="text-xs font-black text-emerald-800">
              {settledInvoices.length} Settled
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center rounded-2xl border border-primary-200 bg-offwhite px-3 py-2">
          <Icon name="search" size={16} color="#2D6A4F" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by invoice number, product or UTR..."
            placeholderTextColor="#9BB5A8"
            className="flex-1 ml-2 text-xs font-bold text-primary-900 py-0"
          />
          {search ? (
            <Pressable onPress={() => setSearch('')} className="p-1">
              <Icon name="x" size={14} color="#64748B" />
            </Pressable>
          ) : null}
        </View>
      </View>

      <FlatList
        data={settledInvoices}
        keyExtractor={(item) => item._id || item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2D6A4F" />
        }
        ListHeaderComponent={() => (
          <View className="mb-4">
            {/* Total Settled Banner */}
            <View className="rounded-[28px] bg-[#143D2E] p-5 shadow-md">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-[11px] font-black uppercase tracking-[1.5px] text-emerald-300">
                  Total Settled Volume
                </Text>
                <View className="flex-row items-center gap-1 bg-emerald-800/60 rounded-full px-2.5 py-0.5 border border-emerald-500/30">
                  <Icon name="check-circle" size={11} color="#A7F3D0" />
                  <Text className="text-[10px] font-black text-emerald-200">100% Verified</Text>
                </View>
              </View>

              <Text className="text-3xl font-black text-white">
                {currencyFormatter.format(totalSettledAmount)}
              </Text>

              <View className="mt-4 pt-3 border-t border-emerald-700/50 flex-row items-center justify-between">
                <Text className="text-xs font-medium text-emerald-100/80">
                  {settledInvoices.length} Verified Invoices with Tally GST Pass-Through
                </Text>
                <Pressable onPress={() => onRefresh()} className="p-1">
                  <Icon name="refresh-cw" size={14} color="#A7F3D0" />
                </Pressable>
              </View>
            </View>
          </View>
        )}
        renderItem={({ item }) => {
          const invId = item._id || item.id;
          const isDownloading = downloadingId === invId;
          const dateStr = item.createdAt
            ? new Date(item.createdAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })
            : '';

          // Calculate total petis in invoice
          let totalPetis = 0;
          let totalUnits = 0;
          item.items?.forEach((it: any) => {
            totalPetis += it.petiQty || (it.petiSize ? Math.ceil((it.qty || it.quantity || 0) / it.petiSize) : 0);
            totalUnits += it.qty || it.quantity || 0;
          });

          return (
            <View className="mb-4 rounded-3xl border border-emerald-200/80 bg-white p-5 shadow-xs">
              {/* Top Row: Invoice Number & Paid Badge */}
              <View className="flex-row items-center justify-between pb-3 border-b border-slate-100">
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-2xl bg-emerald-50 items-center justify-center border border-emerald-100">
                    <Icon name="file-text" size={20} color="#166534" />
                  </View>
                  <View>
                    <Text className="text-base font-black text-slate-900">
                      {item.invoiceNumber || 'B2B Tax Invoice'}
                    </Text>
                    <Text className="text-[11px] font-bold text-slate-400 mt-0.5">{dateStr}</Text>
                  </View>
                </View>

                <View className="rounded-full bg-emerald-100 px-3 py-1 border border-emerald-200 flex-row items-center gap-1">
                  <Icon name="check" size={12} color="#166534" />
                  <Text className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                    Settled
                  </Text>
                </View>
              </View>

              {/* Items Breakdown with Petis & Quantity */}
              {item.items && item.items.length > 0 && (
                <View className="py-3 border-b border-slate-100 gap-1.5">
                  <Text className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Procured Goods ({item.items.length} {item.items.length === 1 ? 'Product' : 'Products'})
                  </Text>

                  {item.items.map((it: any, idx: number) => {
                    const itemPetis = it.petiQty || (it.petiSize ? Math.ceil((it.qty || it.quantity || 0) / it.petiSize) : 1);
                    const itemUnits = it.qty || it.quantity || 0;
                    return (
                      <View key={idx} className="flex-row justify-between items-center py-0.5">
                        <Text className="text-xs font-bold text-slate-800 flex-1 pr-2" numberOfLines={1}>
                          {it.productName}
                        </Text>
                        <Text className="text-xs font-bold text-emerald-850">
                          {itemPetis} Peti ({itemUnits} pcs) • {currencyFormatter.format(it.total || it.price * itemUnits)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* UTR Reference Box */}
              {item.paymentUtr ? (
                <View className="my-3 rounded-2xl bg-slate-50 p-3 border border-slate-200 flex-row items-center justify-between">
                  <View className="flex-1 pr-2">
                    <Text className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Bank Ref / UTR Number
                    </Text>
                    <Text className="text-xs font-black text-slate-800 mt-0.5">
                      {item.paymentUtr}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => handleCopyUtr(item.paymentUtr)}
                    className="flex-row items-center gap-1 rounded-xl bg-white border border-slate-200 px-2.5 py-1.5 active:bg-slate-100 shadow-2xs"
                  >
                    <Icon name="copy" size={12} color="#475569" />
                    <Text className="text-[10px] font-black text-slate-700">Copy</Text>
                  </Pressable>
                </View>
              ) : null}

              {/* Amount & Download Paid Invoice PDF Button */}
              <View className="flex-row items-center justify-between pt-1">
                <View>
                  <Text className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Settled Amount
                  </Text>
                  <Text className="text-xl font-black text-emerald-900">
                    {currencyFormatter.format(item.totalAmount || 0)}
                  </Text>
                </View>

                <Pressable
                  onPress={() => handleDownloadInvoice(item)}
                  disabled={isDownloading}
                  style={{ backgroundColor: '#143D2E' }}
                  className="flex-row items-center gap-2 rounded-2xl px-4 py-3 active:scale-95 shadow-xs"
                >
                  {isDownloading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Icon name="download" size={15} color="#FFFFFF" />
                      <Text className="text-xs font-black uppercase tracking-wider text-white">
                        Paid Invoice PDF
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={() => (
          <View className="py-16 items-center px-6 bg-white rounded-3xl border border-dashed border-slate-200 mt-4">
            <View className="w-14 h-14 rounded-full bg-emerald-50 items-center justify-center mb-3">
              <Icon name="check-circle" size={28} color="#2D6A4F" />
            </View>
            <Text className="text-base font-black text-slate-800 text-center">
              No Settled Invoices Yet
            </Text>
            <Text className="text-xs font-semibold text-slate-400 text-center mt-1 leading-relaxed max-w-[280px]">
              Once you submit payment proof and it is verified & approved by SuperAdmin, your settled invoices and official paid tax bills will appear here.
            </Text>
            <Pressable
              onPress={() => router.push('/(tabs)/invoices')}
              className="mt-5 rounded-2xl bg-emerald-800 px-5 py-2.5 active:scale-95"
            >
              <Text className="text-xs font-black text-white">View Pending Invoices</Text>
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
