import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

interface ReviewStarsProps {
  rating: number;
  onChange?: (value: number) => void;
}

export const ReviewStars = memo(function ReviewStars({ rating, onChange }: ReviewStarsProps) {
  return (
    <View className="flex-row gap-1">
      {[1, 2, 3, 4, 5].map((value) => (
        <Pressable key={value} onPress={() => onChange?.(value)}>
          <Text className="text-lg">{value <= rating ? '⭐' : '☆'}</Text>
        </Pressable>
      ))}
    </View>
  );
});
