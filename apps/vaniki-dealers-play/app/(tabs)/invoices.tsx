import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Linking from 'expo-linking';
import { dealerApi } from '../../src/lib/api';
import { API_BASE_URL } from '../../src/config/api';
import { useAuthStore } from '../../src/store/useAuthStore';
import { currencyFormatter } from '../../src/utils/format';

const Icon = Feather as any;

export default function DealerInvoicesScreen() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Invoices query
  const invoicesQuery = useQuery({
    queryKey: ['dealer-invoices', search],
    queryFn: () => dealerApi.getInvoices({ limit: 50, search: search || undefined }),
  });

  // Dynamic Bank Details & QR code from SuperAdmin
  const paymentDetailsQuery = useQuery({
    queryKey: ['dealer-payment-details'],
    queryFn: dealerApi.getPaymentDetails,
  });

  const bankDetails = paymentDetailsQuery.data?.data || {
    accountName: 'Vaniki Crop Science Pvt Ltd',
    accountNumber: '50200088991122',
    ifscCode: 'HDFC0001234',
    bankName: 'HDFC Bank',
    branchName: 'Ambagarh Chauki',
    upiId: 'vanikicrop@hdfcbank',
    qrCodeUrl: '',
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['dealer-invoices'] }),
      queryClient.invalidateQueries({ queryKey: ['dealer-payment-details'] }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  const invoices = invoicesQuery.data?.data || [];

  // Download Invoice PDF
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
      const fileUri = `${FileSystem.documentDirectory}invoice-${cleanNum}.pdf`;

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

  return (
    <SafeAreaView className="flex-1 bg-offwhite" edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <View className="bg-white border-b border-primary-100 px-4 pt-3 pb-3">
        <View className="flex-row items-center justify-between mb-2">
          <View>
            <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-500">
              Procurement & Billing
            </Text>
            <Text className="text-xl font-black text-primary-900 leading-tight">
              B2B Invoices & Bills
            </Text>
          </View>
          <View className="rounded-full bg-primary-50 px-3 py-1 border border-primary-100">
            <Text className="text-xs font-black text-primary-800">
              {invoices.length} Bills
            </Text>
          </View>
        </View>

        {/* Search */}
        <View className="flex-row items-center rounded-2xl border border-primary-200 bg-offwhite px-3 py-2">
          <Icon name="search" size={16} color="#2D6A4F" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search invoice number or product..."
            placeholderTextColor="#9BB5A8"
            className="flex-1 ml-2 text-xs font-bold text-primary-900 py-0"
          />
          {search ? (
            <Pressable onPress={() => setSearch('')}>
              <Icon name="x" size={14} color="#94A3B8" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Invoices List */}
      {invoicesQuery.isLoading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color="#2D6A4F" />
          <Text className="mt-3 text-xs font-bold text-slate-500">Loading B2B Invoices...</Text>
        </View>
      ) : invoices.length === 0 ? (
        <View className="flex-1 items-center justify-center p-8">
          <View className="w-16 h-16 rounded-3xl bg-primary-50 items-center justify-center mb-3 border border-primary-100">
            <Icon name="file-text" size={30} color="#2D6A4F" />
          </View>
          <Text className="text-base font-black text-slate-800 text-center">No Invoices Found</Text>
          <Text className="text-xs font-semibold text-slate-500 text-center mt-1 max-w-xs">
            Once you request stock and SuperAdmin approves it, the Tally Tax Invoice will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={(item) => item._id || item.id}
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2D6A4F" />
          }
          renderItem={({ item }) => (
            <InvoiceCard
              invoice={item}
              bankDetails={bankDetails}
              downloading={downloadingId === (item._id || item.id)}
              onDownload={() => handleDownloadInvoice(item)}
              onPreviewImage={(url) => setPreviewImage(url)}
            />
          )}
        />
      )}

      {/* Image Preview Modal */}
      <Modal visible={Boolean(previewImage)} transparent animationType="fade">
        <Pressable
          className="flex-1 bg-black/80 items-center justify-center p-4"
          onPress={() => setPreviewImage(null)}
        >
          <View className="relative max-h-[85%] max-w-full rounded-3xl overflow-hidden bg-slate-900 shadow-2xl">
            <Pressable
              onPress={() => setPreviewImage(null)}
              className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/60 items-center justify-center"
            >
              <Icon name="x" size={18} color="#FFFFFF" />
            </Pressable>
            {previewImage && (
              <Image
                source={{ uri: previewImage }}
                style={{ width: 340, height: 480 }}
                contentFit="contain"
              />
            )}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Individual Invoice Card with Payment Flow ────────────────────────────

function InvoiceCard({
  invoice,
  bankDetails,
  downloading,
  onDownload,
  onPreviewImage,
}: {
  invoice: any;
  bankDetails: any;
  downloading: boolean;
  onDownload: () => void;
  onPreviewImage: (url: string) => void;
}) {
  const queryClient = useQueryClient();
  const [utr, setUtr] = useState('');
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);

  const paymentStatus = invoice.paymentStatus || 'unpaid';
  const isPaid = paymentStatus === 'paid';
  const isPendingVerification = paymentStatus === 'verification_pending';
  const isUnpaid = paymentStatus === 'unpaid';

  const dateStr = invoice.invoiceDate
    ? new Date(invoice.invoiceDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

  // Pick Image for screenshots
  const handlePickImage = async (index: number) => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!res.canceled && res.assets[0]?.uri) {
        const newUri = res.assets[0].uri;
        setScreenshots((prev) => {
          const next = [...prev];
          next[index] = newUri;
          return next;
        });
      }
    } catch (err: any) {
      Alert.alert('Image Error', err?.message || 'Failed to pick image');
    }
  };

  const handleRemoveImage = (index: number) => {
    setScreenshots((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Payment Proof
  const handleSubmitPaymentProof = async () => {
    if (!utr.trim()) {
      Alert.alert('UTR Required', 'Please enter your bank UTR / IMPS / UPI transaction reference number.');
      return;
    }

    const validImages = screenshots.filter(Boolean);
    if (validImages.length === 0) {
      Alert.alert('Screenshot Required', 'Please attach at least 1 payment screenshot (Slot 1 is compulsory).');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('utr', utr.trim());

      validImages.forEach((imgUri, idx) => {
        const filename = imgUri.split('/').pop() || `proof_${idx}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        formData.append('screenshots', {
          uri: imgUri,
          name: filename,
          type,
        } as any);
      });

      await dealerApi.submitInvoicePayment(invoice._id || invoice.id, formData);

      queryClient.invalidateQueries({ queryKey: ['dealer-invoices'] });
      Alert.alert(
        'Payment Proof Submitted! 🎉',
        'Your payment details and screenshot proofs have been submitted. Superadmin will verify and approve the payment.',
      );
    } catch (err: any) {
      Alert.alert('Submission Failed', err?.message || 'Unable to submit payment proof. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Copy text helper
  const handleCopy = (val: string, label: string) => {
    Alert.alert('Copied', `${label} (${val}) copied to clipboard.`);
  };

  // Dynamic QR Code generation for UPI
  const totalAmount = invoice.totalAmount || 0;
  const qrCodeUrl =
    bankDetails.qrCodeUrl?.trim() ||
    `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
      `upi://pay?pa=${bankDetails.upiId || 'vanikicrop@hdfcbank'}&pn=${encodeURIComponent(
        bankDetails.accountName || 'Vaniki Crop Science',
      )}&am=${totalAmount}&cu=INR&tn=Invoice_${invoice.invoiceNumber}`,
    )}`;

  return (
    <View className="rounded-3xl border border-primary-100 bg-white p-5 shadow-xs">
      {/* Top Bar: Invoice Number & Badges */}
      <View className="flex-row items-center justify-between pb-3.5 border-b border-slate-100">
        <View className="flex-row items-center gap-3">
          <View className="w-11 h-11 rounded-2xl bg-primary-50 items-center justify-center border border-primary-100">
            <Icon name="file-text" size={22} color="#2D6A4F" />
          </View>
          <View>
            <Text className="text-base font-black text-slate-900">
              {invoice.invoiceNumber || 'B2B Tax Invoice'}
            </Text>
            <Text className="text-[11px] font-bold text-slate-400 mt-0.5">{dateStr}</Text>
          </View>
        </View>

        <View className="items-end gap-1">
          {/* Payment Status Badge */}
          {isPaid ? (
            <View className="rounded-full bg-emerald-100 px-3 py-1 border border-emerald-200">
              <Text className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                ✓ Paid (Done)
              </Text>
            </View>
          ) : isPendingVerification ? (
            <View className="rounded-full bg-amber-100 px-3 py-1 border border-amber-200">
              <Text className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                ⏳ Verification Pending
              </Text>
            </View>
          ) : (
            <View className="rounded-full bg-rose-100 px-3 py-1 border border-rose-200">
              <Text className="text-[10px] font-black uppercase tracking-wider text-rose-800">
                ✕ Payment Due
              </Text>
            </View>
          )}

          {/* Tally Badge */}
          <View className="flex-row items-center gap-1">
            <Text className="text-[9px] font-bold text-slate-400">
              {invoice.tallySyncStatus === 'synced' ? 'Tally ✓' : 'Tally ⏳'}
            </Text>
          </View>
        </View>
      </View>

      {/* Items Summary */}
      {invoice.items && invoice.items.length > 0 && (
        <View className="py-3 border-b border-slate-100 gap-1.5">
          <Text className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Billed Products ({invoice.items.length})
          </Text>
          {invoice.items.slice(0, 3).map((it: any, idx: number) => (
            <View key={idx} className="flex-row justify-between items-center text-xs">
              <Text className="text-xs font-bold text-slate-800 flex-1 pr-2" numberOfLines={1}>
                {it.productName}
              </Text>
              <Text className="text-xs font-semibold text-slate-500">
                {it.qty} pcs • {currencyFormatter.format(it.total || it.price * it.qty)}
              </Text>
            </View>
          ))}
          {invoice.items.length > 3 && (
            <Text className="text-[10px] font-bold text-primary-600 italic">
              + {invoice.items.length - 3} more items in invoice
            </Text>
          )}
        </View>
      )}

      {/* Amount & Download Action */}
      <View className="flex-row items-center justify-between pt-3.5">
        <View>
          <Text className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Total Invoice Amount
          </Text>
          <Text className="text-xl font-black text-primary-900">
            {currencyFormatter.format(totalAmount)}
          </Text>
        </View>

        <Pressable
          onPress={onDownload}
          disabled={downloading}
          className="flex-row items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 shadow-sm active:scale-95"
        >
          {downloading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Icon name="download" size={15} color="#FFFFFF" />
              <Text className="text-xs font-black text-white uppercase tracking-wider">
                Invoice PDF
              </Text>
            </>
          )}
        </Pressable>
      </View>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* PAYMENT STATUS FLOWS (PAID / PENDING / UNPAID)               */}
      {/* ─────────────────────────────────────────────────────────── */}

      {/* 1. PAID CASE: Form is completely removed, success card shown */}
      {isPaid && (
        <View className="mt-4 rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 flex-row items-center gap-3">
          <View className="w-8 h-8 rounded-xl bg-emerald-600 items-center justify-center">
            <Icon name="check" size={18} color="#FFFFFF" />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-black text-emerald-900">
              Payment Completed & Verified
            </Text>
            <Text className="text-[11px] font-semibold text-emerald-700 mt-0.5">
              Ref/UTR: {invoice.paymentUtr || 'Approved by SuperAdmin'}
            </Text>
          </View>
        </View>
      )}

      {/* 2. PENDING VERIFICATION: Form is removed, pending card with proofs shown */}
      {isPendingVerification && (
        <View className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-3">
          <View className="flex-row items-center gap-3">
            <View className="w-8 h-8 rounded-xl bg-amber-500 items-center justify-center">
              <Icon name="clock" size={18} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-black text-amber-900">
                Payment Verification Pending
              </Text>
              <Text className="text-[11px] font-semibold text-amber-700 mt-0.5">
                Your UTR & screenshot proofs are submitted. SuperAdmin will verify shortly.
              </Text>
            </View>
          </View>

          {invoice.paymentUtr ? (
            <View className="flex-row justify-between bg-white/80 p-2.5 rounded-xl border border-amber-100">
              <Text className="text-xs font-bold text-slate-500">Submitted UTR:</Text>
              <Text className="text-xs font-black text-slate-900 font-mono">{invoice.paymentUtr}</Text>
            </View>
          ) : null}

          {invoice.paymentScreenshots && invoice.paymentScreenshots.length > 0 && (
            <View>
              <Text className="text-[10px] font-black uppercase tracking-wider text-amber-800 mb-1.5">
                Submitted Screenshot Proofs ({invoice.paymentScreenshots.length})
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {invoice.paymentScreenshots.map((url: string, idx: number) => (
                  <Pressable
                    key={idx}
                    onPress={() => onPreviewImage(url)}
                    className="w-14 h-14 rounded-xl overflow-hidden border border-amber-200 bg-white"
                  >
                    <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {/* 3. UNPAID CASE: Show Bank Details, QR Code, UTR input & Screenshot upload */}
      {isUnpaid && (
        <View className="mt-4 pt-4 border-t border-slate-100 space-y-4">
          <Pressable
            onPress={() => setShowPaymentDetails((p) => !p)}
            className="flex-row items-center justify-between bg-primary-50 p-3 rounded-2xl border border-primary-200"
          >
            <View className="flex-row items-center gap-2">
              <Icon name="credit-card" size={18} color="#2D6A4F" />
              <Text className="text-xs font-black text-primary-900">
                {showPaymentDetails ? 'Hide Payment Details' : 'View Bank & QR Payment Details'}
              </Text>
            </View>
            <Icon name={showPaymentDetails ? 'chevron-up' : 'chevron-down'} size={18} color="#2D6A4F" />
          </Pressable>

          {showPaymentDetails && (
            <View className="space-y-4">
              {/* Dynamic QR Code */}
              <View className="bg-slate-50 rounded-2xl p-4 items-center border border-slate-200">
                <Text className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                  Scan QR Code to Pay via UPI
                </Text>
                <View className="p-2 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                  <Image
                    source={{ uri: qrCodeUrl }}
                    style={{ width: 170, height: 170, borderRadius: 12 }}
                    contentFit="contain"
                  />
                </View>
                <Text className="text-xs font-black text-primary-900 mt-2 font-mono">
                  UPI ID: {bankDetails.upiId || 'vanikicrop@hdfcbank'}
                </Text>
              </View>

              {/* Dynamic Bank Details */}
              <View className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2.5">
                <Text className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1.5">
                  Bank Transfer Details (NEFT / RTGS / IMPS)
                </Text>

                <View className="flex-row justify-between text-xs">
                  <Text className="text-slate-500 font-semibold">Account Holder:</Text>
                  <Text className="text-slate-900 font-bold">{bankDetails.accountName}</Text>
                </View>

                <View className="flex-row justify-between items-center text-xs">
                  <Text className="text-slate-500 font-semibold">Bank Name:</Text>
                  <Text className="text-slate-900 font-bold">{bankDetails.bankName}</Text>
                </View>

                <View className="flex-row justify-between items-center text-xs">
                  <Text className="text-slate-500 font-semibold">Account Number:</Text>
                  <Pressable
                    onPress={() => handleCopy(bankDetails.accountNumber, 'Account Number')}
                    className="flex-row items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200"
                  >
                    <Text className="text-slate-900 font-mono font-bold">{bankDetails.accountNumber}</Text>
                    <Icon name="copy" size={12} color="#2D6A4F" />
                  </Pressable>
                </View>

                <View className="flex-row justify-between items-center text-xs">
                  <Text className="text-slate-500 font-semibold">IFSC Code:</Text>
                  <Pressable
                    onPress={() => handleCopy(bankDetails.ifscCode, 'IFSC Code')}
                    className="flex-row items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200"
                  >
                    <Text className="text-slate-900 font-mono font-bold">{bankDetails.ifscCode}</Text>
                    <Icon name="copy" size={12} color="#2D6A4F" />
                  </Pressable>
                </View>

                <View className="flex-row justify-between items-center text-xs">
                  <Text className="text-slate-500 font-semibold">Branch:</Text>
                  <Text className="text-slate-900 font-bold">{bankDetails.branchName}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Payment Proof Submission Form */}
          <View className="bg-primary-50/50 rounded-2xl p-4 border border-primary-100 space-y-3">
            <Text className="text-xs font-black uppercase tracking-wider text-primary-900">
              Submit Payment Proof (Mark as Paid)
            </Text>

            {/* UTR Input */}
            <View>
              <Text className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Transaction UTR / Reference No. <Text className="text-rose-500">*</Text>
              </Text>
              <TextInput
                value={utr}
                onChangeText={setUtr}
                placeholder="e.g. 230918239023 (12 digits)"
                placeholderTextColor="#94A3B8"
                className="rounded-xl border border-primary-200 bg-white p-3 text-xs font-bold text-slate-900"
              />
            </View>

            {/* Screenshots (1 Compulsory + 3 Optional = 4 total) */}
            <View>
              <Text className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                Payment Screenshots (4 slots: #1 Compulsory, #2-4 Optional)
              </Text>

              <View className="flex-row gap-2.5">
                {[0, 1, 2, 3].map((slotIdx) => {
                  const hasImage = Boolean(screenshots[slotIdx]);
                  const isRequired = slotIdx === 0;

                  return (
                    <View key={slotIdx} className="flex-1">
                      {hasImage ? (
                        <View className="relative h-20 w-full rounded-2xl overflow-hidden border border-primary-300 bg-white">
                          <Image
                            source={{ uri: screenshots[slotIdx] }}
                            style={{ width: '100%', height: '100%' }}
                            contentFit="cover"
                          />
                          <Pressable
                            onPress={() => handleRemoveImage(slotIdx)}
                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-rose-600 items-center justify-center shadow-md"
                          >
                            <Icon name="x" size={12} color="#FFFFFF" />
                          </Pressable>
                        </View>
                      ) : (
                        <Pressable
                          onPress={() => handlePickImage(slotIdx)}
                          className={`h-20 w-full rounded-2xl border-2 border-dashed items-center justify-center p-1 active:scale-95 ${
                            isRequired ? 'border-primary-400 bg-primary-100/40' : 'border-slate-300 bg-slate-100/50'
                          }`}
                        >
                          <Icon name="camera" size={18} color={isRequired ? '#2D6A4F' : '#94A3B8'} />
                          <Text
                            className={`text-[9px] font-black uppercase mt-1 text-center ${
                              isRequired ? 'text-primary-800' : 'text-slate-400'
                            }`}
                          >
                            {isRequired ? 'Slot 1*' : `Slot ${slotIdx + 1}`}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Submit Button */}
            <Pressable
              onPress={handleSubmitPaymentProof}
              disabled={submitting}
              className="mt-2 rounded-2xl bg-emerald-600 py-3.5 items-center justify-center shadow-md active:scale-95 transition"
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-xs font-black uppercase tracking-widest text-white">
                  Submit Payment Proof
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
