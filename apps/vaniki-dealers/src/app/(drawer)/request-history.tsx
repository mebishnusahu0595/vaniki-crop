import React, { useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  Modal, 
  ScrollView, 
  ActivityIndicator, 
  RefreshControl,
  SafeAreaView
} from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../utils/api';
import { formatDateTime } from '../../utils/format';
import { resolveMediaUrl } from '../../utils/media';
import { Feather } from '@expo/vector-icons';
import type { DealerProductRequest } from '../../types/admin';

const Icon = Feather as any;
const ImageComponent = Image as any;

export default function RequestHistoryScreen() {
  const [selectedRequest, setSelectedRequest] = useState<DealerProductRequest | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-product-requests-history'],
    queryFn: () => adminApi.productRequests({ limit: 50 }),
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'fulfilled': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'rejected': return 'bg-rose-100 text-rose-800 border-rose-200';
      default: return 'bg-zinc-100 text-zinc-800 border-zinc-200';
    }
  };

  const requests = data?.data || [];

  return (
    <SafeAreaView className="flex-1 bg-zinc-50">
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#143D2E" />
          <Text className="mt-3 text-zinc-400 font-bold">Loading request history...</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
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
              <Icon name="clock" size={48} color="#D4D4D8" />
              <Text className="text-zinc-500 font-black mt-4 uppercase tracking-widest text-xs">No Requests Yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setSelectedRequest(item)}
              className="bg-white border border-zinc-100 rounded-3xl p-5 mb-4 shadow-sm active:scale-[0.98] transition"
            >
              <View className="flex-row justify-between items-start gap-2">
                <View className="flex-1">
                  <Text className="text-zinc-900 font-black text-base">{item.productName}</Text>
                  <Text className="text-zinc-500 font-bold text-xs mt-1">
                    {item.petiQuantity} Peti × {item.petiSize || 0} {item.petiUnit || 'Liter'}
                  </Text>
                  <Text className="text-[10px] text-zinc-400 font-semibold mt-1">
                    Garage: {item.garageName || 'N/A'} · {formatDateTime(item.createdAt)}
                  </Text>
                </View>
                <View className={`px-2.5 py-1 rounded-full border ${getStatusColor(item.status)}`}>
                  <Text className="text-[9px] font-black uppercase tracking-wider">{item.status}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Details Modal */}
      <Modal
        visible={Boolean(selectedRequest)}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedRequest(null)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-[2.5rem] h-[75%] border-t border-zinc-200 shadow-2xl overflow-hidden">
            {/* Header */}
            {selectedRequest ? (() => {
              const requestProduct = (selectedRequest as any).productId;
              const productShortDesc = requestProduct?.shortDescription || '';
              const firstImage = requestProduct?.images?.find((img: any) => img.isPrimary) || requestProduct?.images?.[0];
              const productImage = firstImage?.url || '';

              return (
                <View className="flex-row justify-between items-center px-6 py-5 border-b border-zinc-100">
                  <View className="flex-row items-center flex-1 mr-4">
                    <View className="h-12 w-12 bg-zinc-50 border border-zinc-100 rounded-xl overflow-hidden mr-3 justify-center items-center">
                      {productImage ? (
                        <ImageComponent
                          source={{ uri: resolveMediaUrl(productImage) }}
                          style={{ width: '100%', height: '100%' }}
                          contentFit="cover"
                        />
                      ) : (
                        <Icon name="package" size={20} color="#D4D4D8" />
                      )}
                    </View>
                    <View className="flex-1">
                      <Text className="text-zinc-900 font-black text-sm leading-tight" numberOfLines={1}>
                        {selectedRequest.productName}
                      </Text>
                      {productShortDesc ? (
                        <Text className="text-zinc-500 font-medium text-[10px] mt-0.5" numberOfLines={1}>
                          {productShortDesc}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <TouchableOpacity 
                    onPress={() => setSelectedRequest(null)}
                    className="bg-zinc-100 p-2 rounded-full"
                  >
                    <Icon name="x" size={16} color="#71717A" />
                  </TouchableOpacity>
                </View>
              );
            })() : null}

            {/* Scroll view */}
            <ScrollView contentContainerStyle={{ padding: 24 }} className="flex-1">
              {selectedRequest ? (() => {
                const requestProduct = (selectedRequest as any).productId;
                const productShortDesc = requestProduct?.shortDescription || '';
                const firstImage = requestProduct?.images?.find((img: any) => img.isPrimary) || requestProduct?.images?.[0];
                const productImage = firstImage?.url || '';
                
                return (
                  <View className="space-y-6">
                    {/* Details Breakdown */}
                    <View className="flex-row flex-wrap justify-between gap-y-4">
                      <View className="w-[48%] rounded-2xl bg-zinc-50 border border-zinc-100 p-4">
                        <Text className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Variant Pack</Text>
                        <Text className="text-zinc-900 font-black text-sm mt-1">{selectedRequest.requestedPack || 'N/A'}</Text>
                      </View>
                      <View className="w-[48%] rounded-2xl bg-zinc-50 border border-zinc-100 p-4">
                        <Text className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Garage</Text>
                        <Text className="text-zinc-900 font-black text-sm mt-1">{selectedRequest.garageName || 'N/A'}</Text>
                      </View>
                      {selectedRequest.dealerPrice ? (
                        <View className="w-[48%] rounded-2xl bg-zinc-50 border border-zinc-100 p-4">
                          <Text className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Dealer Price</Text>
                          <Text className="text-zinc-900 font-black text-sm mt-1">₹{selectedRequest.dealerPrice}</Text>
                        </View>
                      ) : null}
                      {selectedRequest.offerPrice ? (
                        <View className="w-[48%] rounded-2xl bg-zinc-50 border border-zinc-100 p-4">
                          <Text className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Offer Price</Text>
                          <Text className="text-emerald-700 font-black text-sm mt-1">₹{selectedRequest.offerPrice}</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Volume breakdown summary */}
                    <View className="bg-emerald-950 rounded-3xl p-5 text-white shadow-xl mt-4">
                      <View className="flex-row justify-between items-center">
                        <View>
                          <Text className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-1">Request Volume</Text>
                          <Text className="text-2xl font-black text-white">{selectedRequest.petiQuantity} <Text className="text-sm font-semibold uppercase text-emerald-300">Peti</Text></Text>
                        </View>
                        <View className="border-l border-white/10 pl-5 items-end">
                          <Text className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-1">Total {selectedRequest.petiUnit || 'Volume'}</Text>
                          <Text className="text-2xl font-black text-white">
                            {(Number(selectedRequest.petiQuantity || 0) * Number(selectedRequest.petiSize || 0)).toFixed(1)} <Text className="text-sm font-semibold uppercase text-emerald-300">{selectedRequest.petiUnit}</Text>
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Notes Sections */}
                    <View className="space-y-4 mt-4">
                      <View>
                        <Text className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-2 ml-1">Dealer Notes</Text>
                        <View className="rounded-2xl bg-zinc-50 border border-zinc-100 p-4">
                          <Text className="text-zinc-600 font-semibold italic text-sm">
                            "{selectedRequest.notes || 'No notes provided'}"
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })() : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}
