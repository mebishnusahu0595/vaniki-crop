import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import type { Category } from '../types/storefront';
import { resolveMediaUrl } from '../utils/media';

interface CategoryCardProps {
  category: Category;
  onPress: () => void;
}

export const CategoryCard = memo(function CategoryCard({ category, onPress }: CategoryCardProps) {
  const imageUrl = resolveMediaUrl(category.image?.url, category.image?.publicId);

  return (
    <Pressable onPress={onPress} style={{ width: 76, marginRight: 16 }} className="items-center active:scale-95">
      <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-emerald-500/30 bg-white shadow-sm">
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <View className="items-center justify-center p-3">
            <Feather name="package" size={22} color="#2D6A4F" />
          </View>
        )}
      </View>
      <Text className="mt-2 w-full text-center text-[11px] font-extrabold text-primary-900 leading-tight" numberOfLines={2}>
        {category.name}
      </Text>
    </Pressable>
  );
});
