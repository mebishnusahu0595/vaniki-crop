import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { storefrontApi } from '../utils/api';
import { useSettingsStore } from '../store/useSettingsStore';

export const useHomepage = (storeId?: string) => {
  const setSettings = useSettingsStore((state) => state.setSettings);
  const query = useQuery({
    queryKey: ['homepage', storeId],
    queryFn: () => storefrontApi.homepage(storeId),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (query.data?.siteSettings) {
      setSettings(query.data.siteSettings);
    }
  }, [query.data?.siteSettings, setSettings]);

  return query;
};
