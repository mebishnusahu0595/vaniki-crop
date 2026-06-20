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
    shouldPlaySound: true,
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

      // Register raw FCM device token (used by backend for direct FCM push)
      try {
        const deviceToken = await Notifications.getDevicePushTokenAsync();
        if (deviceToken?.data) {
          setPushToken(deviceToken.data);
          await staffApi.updateFcmToken(deviceToken.data).catch((err) => {
            console.error('[PUSH] Failed to register FCM token:', err.message);
          });
        }
      } catch (err: any) {
        console.log('[PUSH] FCM token not supported on this device:', err.message);
      }
    };

    register().catch(() => undefined);
  }, [enabled]);

  return pushToken;
}
