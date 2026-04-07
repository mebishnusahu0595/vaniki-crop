import { ReactNode } from 'react';
import { Text, View } from 'react-native';

interface SectionHeaderProps {
  kicker?: string;
  title: string;
  action?: ReactNode;
}

export function SectionHeader({ kicker, title, action }: SectionHeaderProps) {
  return (
    <View className="mb-4 flex-row items-end justify-between">
      <View className="flex-1 pr-4">
        {kicker ? (
          <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-400">{kicker}</Text>
        ) : null}
        <Text className="mt-1 text-2xl font-black text-primary-900">{title}</Text>
      </View>
      {action}
    </View>
  );
}
