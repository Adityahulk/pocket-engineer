import { Platform } from 'react-native';

import { api } from './api';

export async function registerPushNotifications() {
  if (Platform.OS === 'web') return;
  try {
    const Notifications = await import('expo-notifications');
    const Device = await import('expo-device');
    if (!Device.isDevice) return;
    const existing = await Notifications.getPermissionsAsync();
    const next = existing.status === 'granted' ? existing : await Notifications.requestPermissionsAsync();
    if (next.status !== 'granted') return;
    const token = await Notifications.getExpoPushTokenAsync();
    await api.registerDevice(token.data, Platform.OS);
  } catch {
    // Push is optional until a native build includes expo-notifications.
  }
}
