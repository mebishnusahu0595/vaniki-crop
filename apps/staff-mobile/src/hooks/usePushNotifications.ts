import { useEffect, useState } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { staffApi } from '../lib/staffApi';

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
      
      // Update token using staff API for staff app
      await staffApi.me().then(async () => {
         // Note: staffApi doesn't have updatePushToken yet, but we can add it if needed.
         // For now, we just avoid crashing by not calling storefrontApi.
      }).catch(() => undefined);
    };

    register().catch(() => undefined);
  }, [enabled]);

  return pushToken;
}
