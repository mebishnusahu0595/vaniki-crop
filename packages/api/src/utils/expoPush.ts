import { Expo, type ExpoPushMessage } from 'expo-server-sdk';

const expo = new Expo();

interface SendExpoPushInput {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function sendExpoPushNotification(input: SendExpoPushInput): Promise<void> {
  if (!Expo.isExpoPushToken(input.to)) {
    return;
  }

  const messages: ExpoPushMessage[] = [
    {
      to: input.to,
      sound: 'default',
      title: input.title,
      body: input.body,
      data: input.data,
      channelId: 'orders',
    },
  ];

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    await expo.sendPushNotificationsAsync(chunk);
  }
}
