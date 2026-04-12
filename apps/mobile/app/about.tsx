import { Text, View } from 'react-native';
import { Screen } from '../src/components/Screen';
import { siteConfig } from '../src/constants/site';

export default function AboutScreen() {
  return (
    <Screen>
      <View className="rounded-[28px] bg-primary-900 p-6">
        <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-200">About Vaniki</Text>
        <Text className="mt-3 text-3xl font-black leading-10 text-white">{siteConfig.aboutTitle}</Text>
        <Text className="mt-4 text-sm leading-7 text-white/75">{siteConfig.aboutStory}</Text>
      </View>

      <View className="mt-5 gap-4">
        {siteConfig.aboutPillars.map((pillar) => (
          <View key={pillar.title} className="rounded-[24px] bg-white p-5">
            <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-500">Vaniki Promise</Text>
            <Text className="mt-3 text-2xl font-black text-primary-900">{pillar.title}</Text>
            <Text className="mt-3 text-sm leading-6 text-primary-900/70">{pillar.description}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}
