import { redisConnection } from '../config/redis.js';

/**
 * Invalidates the homepage cache for global and specific store contexts.
 * Should be called whenever Banners, Categories, Products, or Testimonials are updated.
 * 
 * @param storeId - Optional store ID to invalidate specific store cache
 */
export async function invalidateHomepageCache(storeId?: string | string[] | null) {
  const keys = ['analytics:homepage:global'];
  
  if (storeId) {
    const ids = Array.isArray(storeId) ? storeId : [storeId];
    ids.forEach(id => {
      keys.push(`analytics:homepage:store:${id}`);
    });
  }
  
  for (const key of keys) {
    try {
      await redisConnection.del(key);
    } catch (error) {
      console.error(`Failed to invalidate cache key ${key}:`, error);
    }
  }
}
