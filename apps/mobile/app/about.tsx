import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '../src/components/Screen';
import { siteConfig } from '../src/constants/site';

export default function AboutScreen() {
  const { t, i18n } = useTranslation();
  const isHindi = i18n.language === 'hi';

  const story = isHindi
    ? 'Vaniki Crop Science किसानों को उनके नजदीकी प्रमाणित डीलरों के माध्यम से 100% असली, उच्च गुणवत्ता वाले कीटनाशक, फफूंदनाशक, खरपतवारनाशक और जैविक पौध पोषण उत्पाद उपलब्ध कराता है। हमारा उद्देश्य हर किसान के खेत तक सही दवा और सही सलाह पहुंचाना है।'
    : siteConfig.aboutStory;

  const pillars = isHindi
    ? [
        {
          title: '100% प्रामाणिक उत्पाद',
          description: 'सीधे फैक्ट्री व प्रमाणित विनिर्माताओं से शुद्धता की गारंटी के साथ।',
        },
        {
          title: 'स्थानीय स्टोर से तेज डिलीवरी',
          description: 'आपके गांव व नजदीकी डीलर प्वाइंट से तुरंत डिलीवरी की सुविधा।',
        },
        {
          title: 'निःशुल्क कृषि डॉक्टर परामर्श',
          description: 'फसल में किसी भी रोग या कीट समस्या के लिए कृषि विशेषज्ञों की सीधी सलाह।',
        },
      ]
    : siteConfig.aboutPillars;

  return (
    <Screen>
      <View className="rounded-[28px] bg-primary-900 p-6 shadow-md">
        <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-200">
          {t('mobile.sidebar.aboutUs')}
        </Text>
        <Text className="mt-3 text-2xl font-black leading-9 text-white">
          {isHindi ? 'भारतीय किसानों के लिए समर्पित फसल सुरक्षा समाधान' : siteConfig.aboutTitle}
        </Text>
        <Text className="mt-4 text-xs leading-6 text-white/80">{story}</Text>
      </View>

      <View className="mt-5 gap-4">
        {pillars.map((pillar) => (
          <View key={pillar.title} className="rounded-[24px] bg-white p-5 border border-primary-100 shadow-2xs">
            <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-500">
              {isHindi ? 'हमारा संकल्प' : 'Vaniki Promise'}
            </Text>
            <Text className="mt-2 text-lg font-black text-primary-900">{pillar.title}</Text>
            <Text className="mt-2 text-xs leading-5 text-primary-900/70">{pillar.description}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}
