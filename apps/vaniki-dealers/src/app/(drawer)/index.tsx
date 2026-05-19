import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { adminApi } from '../../utils/api';
import { currencyFormatter, formatDateTime } from '../../utils/format';
import { Feather } from '@expo/vector-icons';

const Icon = Feather as any;

export default function DashboardScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [range, setRange] = useState<'7d' | '30d'>('7d');

  // Core Analytics Query
  const analyticsQuery = useQuery({
    queryKey: ['admin-dashboard', range],
    queryFn: () => adminApi.analytics(range),
  });

  // Eligible Settlements Query
  const eligibleOrdersQuery = useQuery({
    queryKey: ['admin-settlement-eligible'],
    queryFn: adminApi.getSettlementEligibleOrders,
  });

  // Referrals Query
  const referralsQuery = useQuery({
    queryKey: ['admin-referrals'],
    queryFn: () => adminApi.referrals(),
  });

  const onRefresh = useCallback(async () => {
    await Promise.all([
      analyticsQuery.refetch(),
      eligibleOrdersQuery.refetch(),
      referralsQuery.refetch(),
    ]);
  }, [analyticsQuery, eligibleOrdersQuery, referralsQuery]);

  const isRefreshing = analyticsQuery.isFetching || eligibleOrdersQuery.isFetching || referralsQuery.isFetching;

  if (analyticsQuery.isLoading || !analyticsQuery.data) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#143D2E" />
        <Text className="mt-4 font-bold text-gray-500">Loading store analytics...</Text>
      </View>
    );
  }

  const { stats, revenueSeries, recentOrders, topProducts } = analyticsQuery.data;

  // Dynamic aggregates
  const totalPeriodSales = revenueSeries.reduce((sum, p) => sum + p.amount, 0);
  const totalPeriodOrders = revenueSeries.reduce((sum, p) => sum + p.orders, 0);
  const averageOrderValue = totalPeriodOrders > 0 ? totalPeriodSales / totalPeriodOrders : 0;

  // Settlement wallet total
  const pendingSettlementBalance = eligibleOrdersQuery.data?.reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0) ?? 0;
  const eligibleOrdersCount = eligibleOrdersQuery.data?.length ?? 0;

  // Referral counts
  const referralCount = referralsQuery.data?.data?.length ?? referralsQuery.data?.length ?? 0;

  // Find max value in series for bar scale calculation
  const maxSeriesAmount = Math.max(...revenueSeries.map((p) => p.amount), 1);

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#143D2E']} />
        }
      >
        {/* Title and Filter Section */}
        <View className="mb-6 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-black text-slate-900">Performance</Text>
            <Text className="text-xs font-semibold text-slate-500">Live store metrics & overview</Text>
          </View>
          
          {/* Toggle Switcher */}
          <View className="flex-row rounded-2xl border border-emerald-100 bg-white p-1 shadow-sm">
            {(['7d', '30d'] as const).map((option) => (
              <TouchableOpacity
                key={option}
                onPress={() => setRange(option)}
                className={`rounded-xl px-4 py-1.5 ${
                  range === option ? 'bg-emerald-800' : 'bg-transparent'
                }`}
              >
                <Text
                  className={`text-xs font-black uppercase tracking-wider ${
                    range === option ? 'text-white' : 'text-slate-500'
                  }`}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Primary Stats Grid */}
        <View className="mb-6 flex-row flex-wrap justify-between gap-y-3">
          {/* Today's Revenue */}
          <View className="w-[48%] rounded-3xl border border-emerald-50 bg-white p-4 shadow-sm">
            <View className="flex-row items-center justify-between">
              <Text className="text-[10px] font-black uppercase tracking-widest text-slate-400">Today Sales</Text>
              <View className="rounded-xl bg-emerald-50 p-1.5 text-emerald-600">
                <Icon name="trending-up" size={14} color="#10b981" />
              </View>
            </View>
            <Text className="mt-3 text-lg font-black text-slate-900">
              {currencyFormatter.format(stats.todayRevenue)}
            </Text>
          </View>

          {/* Today's Orders */}
          <View className="w-[48%] rounded-3xl border border-emerald-50 bg-white p-4 shadow-sm">
            <View className="flex-row items-center justify-between">
              <Text className="text-[10px] font-black uppercase tracking-widest text-slate-400">Today Orders</Text>
              <View className="rounded-xl bg-emerald-50 p-1.5">
                <Icon name="shopping-bag" size={14} color="#059669" />
              </View>
            </View>
            <Text className="mt-3 text-lg font-black text-slate-900">{stats.todayOrders} Orders</Text>
          </View>

          {/* Pending Orders */}
          <View className="w-[48%] rounded-3xl border border-emerald-50 bg-white p-4 shadow-sm">
            <View className="flex-row items-center justify-between">
              <Text className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pending</Text>
              <View className="rounded-xl bg-amber-50 p-1.5">
                <Icon name="clock" size={14} color="#d97706" />
              </View>
            </View>
            <Text className="mt-3 text-lg font-black text-slate-900">{stats.pendingOrders} Orders</Text>
          </View>

          {/* Catalog items */}
          <View className="w-[48%] rounded-3xl border border-emerald-50 bg-white p-4 shadow-sm">
            <View className="flex-row items-center justify-between">
              <Text className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Products</Text>
              <View className="rounded-xl bg-blue-50 p-1.5">
                <Icon name="grid" size={14} color="#2563eb" />
              </View>
            </View>
            <Text className="mt-3 text-lg font-black text-slate-900">{stats.totalProducts} Items</Text>
          </View>
        </View>

        {/* Dynamic Aggregates Cards */}
        <View className="mb-6 space-y-3">
          {/* Period Gross Card */}
          <View className="rounded-3xl border border-emerald-800 bg-emerald-950 p-5 shadow-md">
            <View className="flex-row items-center justify-between">
              <Text className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Period Gross Revenue</Text>
              <View className="rounded-xl bg-emerald-800/40 p-2">
                <Icon name="activity" size={16} color="#34d399" />
              </View>
            </View>
            <Text className="mt-3 text-2xl font-black text-white">{currencyFormatter.format(totalPeriodSales)}</Text>
            <Text className="mt-1 text-[11px] font-semibold text-emerald-400">
              Total sales and {totalPeriodOrders} orders in last {range === '7d' ? '7 days' : '30 days'}
            </Text>
          </View>

          {/* AOV Card */}
          <View className="rounded-3xl border border-emerald-50 bg-white p-5 shadow-sm">
            <View className="flex-row items-center justify-between">
              <Text className="text-[10px] font-black uppercase tracking-widest text-slate-400">Average Order Value (AOV)</Text>
              <View className="rounded-xl bg-emerald-50 p-2">
                <Icon name="pie-chart" size={16} color="#059669" />
              </View>
            </View>
            <Text className="mt-3 text-2xl font-black text-slate-900">{currencyFormatter.format(averageOrderValue)}</Text>
            <Text className="mt-1 text-[11px] font-semibold text-slate-500">Average basket value for store bookings</Text>
          </View>
        </View>

        {/* Dynamic Wallet Settlements Card */}
        <TouchableOpacity
          onPress={() => router.push('/(drawer)/settlement')}
          activeOpacity={0.9}
          className="mb-6 rounded-3xl border border-amber-100 bg-amber-500/10 p-5 shadow-sm"
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-[10px] font-black uppercase tracking-widest text-amber-800">Eligible Settlements</Text>
            <View className="rounded-xl bg-amber-100 p-2">
              <Icon name="credit-card" size={16} color="#b45309" />
            </View>
          </View>
          <Text className="mt-3 text-2xl font-black text-slate-900">
            {currencyFormatter.format(pendingSettlementBalance)}
          </Text>
          <View className="mt-2 flex-row items-center justify-between border-t border-amber-500/20 pt-2">
            <Text className="text-[11px] font-semibold text-amber-800">
              Tap to claim settlements ({eligibleOrdersCount} orders)
            </Text>
            <Icon name="arrow-up-right" size={14} color="#b45309" />
          </View>
        </TouchableOpacity>

        {/* Customer Referral Outreach */}
        <TouchableOpacity
          onPress={() => router.push('/(drawer)/referrals')}
          activeOpacity={0.9}
          className="mb-6 rounded-3xl border border-emerald-100 bg-emerald-50/40 p-5 shadow-sm"
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-[10px] font-black uppercase tracking-widest text-emerald-800">Referrals Network</Text>
            <View className="rounded-xl bg-emerald-100 p-2">
              <Icon name="users" size={16} color="#047857" />
            </View>
          </View>
          <Text className="mt-3 text-2xl font-black text-slate-900">{referralCount} Customers</Text>
          <View className="mt-2 flex-row items-center justify-between border-t border-emerald-100 pt-2">
            <Text className="text-[11px] font-semibold text-emerald-700">View customer referral logs</Text>
            <Icon name="chevron-right" size={14} color="#047857" />
          </View>
        </TouchableOpacity>

        {/* Custom Visual Sales Trend Chart */}
        <View className="mb-6 rounded-[2rem] border border-emerald-50 bg-white p-5 shadow-sm">
          <Text className="text-[10px] font-black uppercase tracking-widest text-emerald-800">Sales Stream</Text>
          <Text className="mt-1 text-lg font-black text-slate-900">Daily Sales Trend</Text>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-5">
            <View className="flex-row items-end gap-x-4 pb-2 pt-4 px-2">
              {revenueSeries.map((pt, idx) => {
                const ratio = Math.max(0.1, pt.amount / maxSeriesAmount);
                const height = ratio * 120; // max chart height is 120px
                return (
                  <View key={idx} className="items-center">
                    <Text className="text-[8px] font-bold text-slate-500 mb-2">₹{pt.amount}</Text>
                    {/* Bar */}
                    <View 
                      style={{ height }} 
                      className="w-8 rounded-t-lg bg-emerald-800/80 hover:bg-emerald-800" 
                    />
                    {/* Date */}
                    <Text className="mt-2 text-[9px] font-bold text-slate-400">
                      {pt.date.slice(5)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Best Selling Products list */}
        <View className="mb-6 rounded-[2rem] border border-emerald-50 bg-white p-5 shadow-sm">
          <Text className="text-[10px] font-black uppercase tracking-widest text-emerald-800">Inventory Performers</Text>
          <Text className="mt-1 text-lg font-black text-slate-900 mb-4">Best Sellers By Revenue</Text>
          
          <View className="space-y-3">
            {topProducts.map((product, idx) => (
              <View key={idx} className="flex-row items-center justify-between rounded-2xl border border-emerald-50 bg-emerald-50/20 px-4 py-3">
                <View className="flex-1 pr-2">
                  <Text className="text-sm font-black text-slate-900" numberOfLines={1}>{product.name}</Text>
                  <Text className="mt-1 text-xs font-semibold text-slate-500">{product.sold} units sold</Text>
                </View>
                <Text className="text-sm font-black text-emerald-800">
                  {currencyFormatter.format(product.revenue)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Recent Orders timeline */}
        <View className="rounded-[2rem] border border-emerald-50 bg-white p-5 shadow-sm">
          <Text className="text-[10px] font-black uppercase tracking-widest text-emerald-800">Recent customer bookings</Text>
          <Text className="mt-1 text-lg font-black text-slate-900 mb-4">Last 10 Orders</Text>

          <View className="space-y-3">
            {recentOrders.map((order) => (
              <View key={order.id} className="rounded-2xl border border-emerald-50/60 bg-emerald-50/10 p-4">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-black text-slate-900">{order.orderNumber}</Text>
                  <Text className="text-sm font-black text-emerald-800">{currencyFormatter.format(order.totalAmount)}</Text>
                </View>
                
                <Text className="mt-1 text-xs font-semibold text-slate-400">
                  {order.userId?.name || 'Customer'} · {formatDateTime(order.createdAt)}
                </Text>

                <View className="mt-3 flex-row flex-wrap items-center gap-2">
                  <View className="rounded-full bg-slate-100 px-2 py-0.5">
                    <Text className="text-[8px] font-black uppercase tracking-wider text-slate-600">{order.status}</Text>
                  </View>
                  <View className={`rounded-full px-2 py-0.5 ${
                    order.paymentStatus === 'paid' ? 'bg-emerald-100' : 'bg-amber-100'
                  }`}>
                    <Text className={`text-[8px] font-black uppercase tracking-wider ${
                      order.paymentStatus === 'paid' ? 'text-emerald-700' : 'text-amber-700'
                    }`}>{order.paymentStatus}</Text>
                  </View>
                  <View className={`rounded-full px-2 py-0.5 ${
                    order.paymentMethod === 'cod' ? 'bg-orange-100' : 'bg-blue-100'
                  }`}>
                    <Text className={`text-[8px] font-black uppercase tracking-wider ${
                      order.paymentMethod === 'cod' ? 'text-orange-700' : 'text-blue-700'
                    }`}>{order.paymentMethod === 'cod' ? 'COD' : 'Razorpay'}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
