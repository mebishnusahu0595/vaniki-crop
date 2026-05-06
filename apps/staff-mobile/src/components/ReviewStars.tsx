import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ReviewStarsProps {
  rating: number;
  onChange?: (value: number) => void;
}

export const ReviewStars = memo(function ReviewStars({ rating, onChange }: ReviewStarsProps) {
  return (
    <View className="flex-row gap-1">
      {[1, 2, 3, 4, 5].map((value) => (
        <Pressable key={value} onPress={() => onChange?.(value)}>
          <Ionicons
            name={value <= rating ? 'star' : 'star-outline'}
            size={18}
            color={value <= rating ? '#F59E0B' : '#B7C6BF'}
          />
        </Pressable>
      ))}
    </View>
  );
});
