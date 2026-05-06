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
    <Pressable onPress={onPress} className="mr-3 items-center">
      <View className="h-24 w-24 items-center justify-center overflow-hidden rounded-[24px] border border-primary-100 bg-white">
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <View className="items-center justify-center p-5">
            <Feather name="package" size={32} color="#2D6A4F" />
          </View>
        )}
      </View>
      <Text className="mt-3 w-24 text-center text-xs font-black text-primary-900" numberOfLines={2}>
        {category.name}
      </Text>
    </Pressable>
  );
});
