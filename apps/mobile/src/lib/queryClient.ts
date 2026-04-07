import NetInfo from '@react-native-community/netinfo';
import { QueryClient, onlineManager } from '@tanstack/react-query';

let queryClient: QueryClient | null = null;

export function bindOnlineManager() {
  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
  });
}

export function getQueryClient() {
  if (!queryClient) {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000,
          retry: 2,
          refetchOnReconnect: true,
          refetchOnWindowFocus: false,
        },
      },
    });
  }

  return queryClient;
}
