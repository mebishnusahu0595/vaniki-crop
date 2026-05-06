import { useEffect, useState } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { storefrontApi } from '../lib/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export function usePushNotifications(enabled: boolean) {
  const [pushToken, setPushToken] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const register = async () => {
      if (!Device.isDevice) return;

      const permission = await Notifications.getPermissionsAsync();
      let finalStatus = permission.status;

      if (finalStatus !== 'granted') {
        const requested = await Notifications.requestPermissionsAsync();
        finalStatus = requested.status;
      }

      if (finalStatus !== 'granted') return;

      const projectId =
        Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) return;

      const token = await Notifications.getExpoPushTokenAsync({ projectId });
      setPushToken(token.data);
      await storefrontApi.updatePushToken(token.data).catch(() => undefined);
    };

    register().catch(() => undefined);
  }, [enabled]);

  return pushToken;
}
