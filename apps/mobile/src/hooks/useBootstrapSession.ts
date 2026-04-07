import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { storefrontApi } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { useServiceModeStore } from '../store/useServiceModeStore';
import { useStoreStore } from '../store/useStoreStore';

export function useBootstrapSession() {
  const token = useAuthStore((state) => state.token);
  const setUser = useAuthStore((state) => state.setUser);
  const setMode = useServiceModeStore((state) => state.setMode);
  const setAddress = useServiceModeStore((state) => state.setAddress);
  const setStore = useStoreStore((state) => state.setStore);

  const sessionQuery = useQuery({
    queryKey: ['mobile-session', token],
    queryFn: storefrontApi.me,
    enabled: Boolean(token),
    retry: 1,
  });

  useEffect(() => {
    const session = sessionQuery.data;
    if (!session) return;

    setUser(session);
    if (session.serviceMode) setMode(session.serviceMode);
    if (session.savedAddress) setAddress(session.savedAddress);
    if (session.selectedStore && typeof session.selectedStore !== 'string') {
      setStore(session.selectedStore);
    }
  }, [sessionQuery.data, setAddress, setMode, setStore, setUser]);

  return sessionQuery;
}
