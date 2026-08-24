import { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { dealerApi } from '../../src/lib/api';
import { currencyFormatter } from '../../src/utils/format';

const Icon = Feather as any;

export default function DealerInvoicesScreen() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const invoicesQuery = useQuery({
    queryKey: ['dealer-invoices'],
    queryFn: () => dealerApi.getInvoices({ limit: 50 }),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['dealer-invoices'] });
    setRefreshing(false);
  }, [queryClient]);

  const invoices = invoicesQuery.data?.data || [];

  const handleOpenPdf = (invoice: any) => {
    if (invoice.pdfUrl) {
      Linking.openURL(invoice.pdfUrl);
    } else {
      Alert.alert(
        'Invoice Notice',
        `Invoice #${invoice.invoiceNumber || invoice.id?.slice(-8)} is generated. Physical copy will be dispatched with shipment.`,
      );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-offwhite" edges={['top', 'left', 'right']}>
      {/* Header */}
      <View className="bg-white border-b border-primary-100 px-4 pt-3 pb-3">
        <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-500">
          Financial Records
        </Text>
        <Text className="text-xl font-black text-primary-900 leading-tight mt-0.5">
          B2B Invoices
        </Text>
      </View>

      {/* Invoices List */}
      {invoicesQuery.isLoading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color="#2D6A4F" />
          <Text className="mt-3 text-xs font-bold text-slate-500">Loading invoices...</Text>
        </View>
      ) : invoices.length === 0 ? (
        <View className="flex-1 items-center justify-center p-8">
          <View className="w-16 h-16 rounded-full bg-primary-50 items-center justify-center mb-3">
            <Icon name="file-text" size={32} color="#2D6A4F" />
          </View>
          <Text className="text-base font-black text-slate-800 text-center">No Invoices Found</Text>
          <Text className="text-xs font-semibold text-slate-500 text-center mt-1">
            Invoices generated for your B2B bulk orders will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={(item) => item.id || item._id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2D6A4F" />
          }
          renderItem={({ item }) => (
            <InvoiceCard invoice={item} onOpen={() => handleOpenPdf(item)} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Invoice Card ─────────────────────────────────────────────────────────

function InvoiceCard({ invoice, onOpen }: { invoice: any; onOpen: () => void }) {
  const isPaid = invoice.status?.toLowerCase() === 'paid';
  const dateStr = invoice.createdAt
    ? new Date(invoice.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

  return (
    <View className="rounded-[22px] border border-primary-100 bg-white p-4 shadow-xs">
      <View className="flex-row items-center justify-between pb-3 border-b border-slate-100">
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-2xl bg-primary-50 items-center justify-center">
            <Icon name="file-text" size={20} color="#2D6A4F" />
          </View>
          <div>
            <Text className="text-sm font-black text-primary-900">
              {invoice.invoiceNumber || `INV-${invoice.id?.slice(-6).toUpperCase()}`}
            </Text>
            <Text className="text-[10px] font-bold text-slate-400 mt-0.5">{dateStr}</Text>
          </div>
        </View>

        <View
          className={`rounded-full px-3 py-1 ${
            isPaid ? 'bg-emerald-100' : 'bg-amber-100'
          }`}
        >
          <Text
            className={`text-[10px] font-black uppercase tracking-wider ${
              isPaid ? 'text-emerald-800' : 'text-amber-800'
            }`}
          >
            {invoice.status || 'Generated'}
          </Text>
        </View>
      </View>

      {/* Invoice Details */}
      <View className="py-3 gap-1.5 border-b border-slate-100">
        {invoice.orderNumber ? (
          <View className="flex-row justify-between">
            <Text className="text-xs font-semibold text-slate-500">Order Ref</Text>
            <Text className="text-xs font-bold text-slate-800">#{invoice.orderNumber}</Text>
          </View>
        ) : null}
        {invoice.gstin ? (
          <View className="flex-row justify-between">
            <Text className="text-xs font-semibold text-slate-500">GSTIN</Text>
            <Text className="text-xs font-bold text-slate-800">{invoice.gstin}</Text>
          </View>
        ) : null}
      </View>

      {/* Amount & Download */}
      <View className="flex-row items-center justify-between pt-3">
        <div>
          <Text className="text-[10px] font-bold text-slate-400 uppercase">Total Amount</Text>
          <Text className="text-base font-black text-primary-800">
            {currencyFormatter.format(invoice.totalAmount || invoice.amount || 0)}
          </Text>
        </div>

        <Pressable
          onPress={onOpen}
          className="flex-row items-center gap-1.5 rounded-xl bg-primary-50 px-3 py-2 border border-primary-100 active:scale-95"
        >
          <Icon name="download" size={14} color="#2D6A4F" />
          <Text className="text-xs font-black text-primary-800">View Invoice</Text>
        </Pressable>
      </View>
    </View>
  );
}
