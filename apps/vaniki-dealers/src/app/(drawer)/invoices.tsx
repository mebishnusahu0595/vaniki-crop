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
      
      // Clean invoice number for path compliance
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

  return (
    <SafeAreaView className="flex-1 bg-zinc-50">
      {/* Search Header */}
      <View className="bg-white px-4 py-4 border-b border-zinc-100 shadow-sm">
        <View className="flex-row items-center bg-zinc-100 rounded-2xl px-4 py-3">
          <Icon name="search" size={18} color="#71717A" />
          <TextInput
            placeholder="Search B2B invoices..."
            placeholderTextColor="#A1A1AA"
            value={search}
            onChangeText={setSearch}
            className="flex-1 ml-2 text-zinc-900 font-semibold text-sm"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Icon name="x-circle" size={16} color="#A1A1AA" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Invoices List */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#143D2E" />
          <Text className="mt-3 text-zinc-400 font-bold">Loading B2B invoices...</Text>
        </View>
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl 
              refreshing={isFetching} 
              onRefresh={refetch} 
              colors={['#143D2E']} 
            />
          }
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center py-20">
              <Icon name="file-text" size={48} color="#D4D4D8" />
              <Text className="text-zinc-500 font-black mt-4 uppercase tracking-widest text-xs">No Invoices Found</Text>
            </View>
          }
          renderItem={({ item: invoice }) => (
            <View className="bg-white border border-zinc-100 rounded-[2rem] p-5 mb-4 shadow-sm">
              <View className="flex-row justify-between items-start">
                <View>
                  <Text className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Invoice No.</Text>
                  <Text className="text-zinc-900 font-black text-lg mt-0.5">{invoice.invoiceNumber}</Text>
                  <Text className="text-[10px] text-zinc-400 font-semibold mt-1">
                    Date: {formatDate(invoice.invoiceDate)}
                  </Text>
                </View>

                {/* Download PDF Trigger */}
                <TouchableOpacity
                  onPress={() => handleDownloadInvoice(invoice.id, invoice.invoiceNumber)}
                  disabled={downloadingId === invoice.id}
                  className="bg-emerald-50 border border-emerald-100 p-3 rounded-2xl active:scale-95 flex-row items-center"
                >
                  {downloadingId === invoice.id ? (
                    <ActivityIndicator size="small" color="#143D2E" />
                  ) : (
                    <>
                      <Icon name="download" size={14} color="#143D2E" />
                      <Text className="text-[10px] font-black uppercase tracking-widest text-emerald-800 ml-1.5">PDF</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <View className="h-px bg-zinc-100 my-4" />

              {/* Financial Breakdowns */}
              <View className="flex-row justify-between items-center bg-zinc-50/50 rounded-2xl p-4 border border-zinc-100">
                <View className="items-start">
                  <Text className="text-[9px] font-black uppercase tracking-wider text-zinc-400">Subtotal</Text>
                  <Text className="text-zinc-700 font-bold text-sm mt-0.5">
                    {currencyFormatter.format(invoice.subtotal)}
                  </Text>
                </View>
                <View className="items-center border-l border-zinc-200 pl-4">
                  <Text className="text-[9px] font-black uppercase tracking-wider text-zinc-400">Tax</Text>
                  <Text className="text-zinc-700 font-bold text-sm mt-0.5">
                    {currencyFormatter.format(invoice.totalTax)}
                  </Text>
                </View>
                <View className="items-end border-l border-zinc-200 pl-4">
                  <Text className="text-[9px] font-black uppercase tracking-wider text-zinc-400">Total Amount</Text>
                  <Text className="text-emerald-800 font-black text-sm mt-0.5">
                    {currencyFormatter.format(invoice.totalAmount)}
                  </Text>
                </View>
              </View>

              <View className="mt-3.5 px-1 flex-row items-center">
                <Icon name="user" size={12} color="#71717A" />
                <Text className="text-xs text-zinc-500 font-bold ml-1.5">
                  Dealer: {invoice.dealerName || 'Store Admin'}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
