import React, { useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl,
  SafeAreaView,
  Alert
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../utils/api';
import { currencyFormatter, formatDate } from '../../utils/format';
import { Feather } from '@expo/vector-icons';
import { API_BASE_URL } from '../../config/api';
import { useAdminAuthStore } from '../../store/useAdminAuthStore';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const Icon = Feather as any;

export default function InvoicesScreen() {
  const [search, setSearch] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-invoices', search],
    queryFn: () => adminApi.getB2BInvoices({ 
      search: search || undefined,
      limit: 100 
    }),
  });

  const handleDownloadInvoice = async (invoiceId: string, invoiceNumber: string) => {
    setDownloadingId(invoiceId);
    try {
      const url = `${API_BASE_URL}/b2b-invoices/download/${invoiceId}`;
      const token = useAdminAuthStore.getState().token;
      
      const cleanInvNum = invoiceNumber.replace(/[^a-zA-Z0-9-]/g, '_');
      const fileUri = `${FileSystem.documentDirectory}invoice-${cleanInvNum}.pdf`;

      const downloadRes = await FileSystem.downloadAsync(url, fileUri, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (downloadRes.status !== 200) {
        throw new Error('Failed to download B2B invoice');
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloadRes.uri);
      } else {
        Alert.alert('Download Complete', `Invoice saved to ${downloadRes.uri}`);
      }
    } catch (caughtError) {
      Alert.alert(
        'Download Failed', 
        caughtError instanceof Error ? caughtError.message : 'Please check your connection and try again.'
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const invoices = data?.data || [];

  // Total B2B spend & tax credit calculations
  const totalB2BSpend = invoices.reduce((sum: number, inv: any) => sum + (inv.totalAmount || inv.grandTotal || 0), 0);
  const totalTaxCredit = invoices.reduce((sum: number, inv: any) => sum + (inv.taxAmount || (inv.totalAmount || 0) * 0.18), 0);

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* ─── Search & Tax Summary Header ───────────────────────────────────── */}
      <View className="bg-white border-b border-slate-100 shadow-xs">
        <View className="px-4 pt-3 pb-2">
          <View className="flex-row items-center bg-slate-100 rounded-2xl px-4 py-2.5">
            <Icon name="search" size={17} color="#059669" />
            <TextInput
              placeholder="Search by Invoice #, order ID..."
              placeholderTextColor="#94a3b8"
              value={search}
              onChangeText={setSearch}
              className="flex-1 ml-2 text-slate-900 font-semibold text-sm"
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Icon name="x-circle" size={16} color="#94a3b8" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* GST Input Tax Credit Overview */}
        <View className="px-4 py-3 flex-row gap-3">
          <View className="flex-1 rounded-2xl bg-emerald-50 p-3 border border-emerald-100/60">
            <Text className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Total B2B Billing</Text>
            <Text className="text-base font-black text-emerald-950 mt-0.5">{currencyFormatter.format(totalB2BSpend)}</Text>
          </View>
          <View className="flex-1 rounded-2xl bg-purple-50 p-3 border border-purple-100/60">
            <Text className="text-[10px] font-black uppercase tracking-wider text-purple-700">100% ITC Eligible</Text>
            <Text className="text-base font-black text-purple-950 mt-0.5">{currencyFormatter.format(totalTaxCredit)}</Text>
          </View>
        </View>
      </View>

      {/* ─── Invoices List ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#143D2E" />
          <Text className="mt-3 text-slate-400 font-bold text-xs">Loading B2B tax invoices...</Text>
        </View>
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isFetching} onRefresh={refetch} colors={['#143D2E']} />
          }
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <View className="items-center justify-center py-20 px-6 rounded-3xl bg-white border border-dashed border-slate-200">
              <Icon name="file-text" size={40} color="#94a3b8" />
              <Text className="mt-4 font-black text-slate-800 text-base">No B2B Invoices Found</Text>
              <Text className="mt-1 text-center text-xs text-slate-400">
                Official GST invoices generated for factory dispatches will appear here.
              </Text>
            </View>
          }
          renderItem={({ item: invoice }) => {
            const isDownloading = downloadingId === invoice.id;
            const invNum = invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8).toUpperCase()}`;

            return (
              <View className="mb-4 rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-xs">
                {/* Header: Invoice Number & Date */}
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-base font-black text-slate-900 leading-none">
                      {invNum}
                    </Text>
                    <Text className="text-[11px] font-semibold text-slate-400 mt-1">
                      Issued: {formatDate(invoice.createdAt || invoice.invoiceDate)}
                    </Text>
                  </View>

                  <View className={`rounded-full px-3 py-1 ${
                    invoice.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    <Text className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                      {invoice.status || 'Active'}
                    </Text>
                  </View>
                </View>

                {/* Amount & ITC Breakdown */}
                <View className="mt-4 rounded-2xl bg-slate-50 p-3.5 border border-slate-100/60">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs font-bold text-slate-500">Gross Invoice Value</Text>
                    <Text className="text-base font-black text-slate-900">
                      {currencyFormatter.format(invoice.totalAmount || invoice.grandTotal || 0)}
                    </Text>
                  </View>

                  <View className="mt-2 flex-row items-center justify-between border-t border-slate-200/50 pt-2">
                    <Text className="text-[11px] font-semibold text-purple-700">GST Input Tax Credit (ITC)</Text>
                    <Text className="text-xs font-black text-purple-900">
                      {currencyFormatter.format(invoice.taxAmount || (invoice.totalAmount || 0) * 0.18)}
                    </Text>
                  </View>
                </View>

                {/* Download PDF Action */}
                <TouchableOpacity
                  onPress={() => handleDownloadInvoice(invoice.id, invNum)}
                  disabled={isDownloading}
                  activeOpacity={0.85}
                  className="mt-4 flex-row items-center justify-center gap-2 rounded-xl bg-[#143D2E] py-3 active:bg-emerald-900 shadow-xs"
                >
                  {isDownloading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Icon name="download" size={15} color="#ffffff" />
                      <Text className="text-xs font-black uppercase tracking-wider text-white">
                        Download GST Invoice (PDF)
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
