import { useQuery } from '@tanstack/react-query';
import { storefrontApi } from '../utils/api';

export const useHomepage = (storeId?: string) => {
  return useQuery({
    queryKey: ['homepage', storeId],
    queryFn: () => storefrontApi.homepage(storeId),
    staleTime: 5 * 60 * 1000,
  });
};
