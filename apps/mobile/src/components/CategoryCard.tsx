import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import type { Category } from '../types/storefront';

interface CategoryCardProps {
  category: Category;
  onPress: () => void;
}

export const CategoryCard = memo(function CategoryCard({ category, onPress }: CategoryCardProps) {
  return (
    <Pressable onPress={onPress} className="mr-3 items-center">
      <View className="h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-primary-100">
        {category.image?.url ? (
          <Image source={{ uri: category.image.url }} style={{ width: 80, height: 80 }} contentFit="cover" />
        ) : (
          <Feather name="package" size={28} color="#2D6A4F" />
        )}
      </View>
      <Text className="mt-3 w-20 text-center text-xs font-bold text-primary-900">{category.name}</Text>
    </Pressable>
  );
});
