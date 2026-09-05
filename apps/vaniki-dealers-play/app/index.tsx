import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/useAuthStore';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  const { token, hydrated } = useAuthStore();

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAF9' }}>
        <ActivityIndicator size="large" color="#2D6A4F" />
      </View>
    );
  }

  if (!token) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(tabs)" />;
}
