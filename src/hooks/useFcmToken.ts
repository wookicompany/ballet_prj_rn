import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { registerFcmToken } from '../services/fcm';

/**
 * Request notification permissions, get FCM/push token via expo-notifications,
 * and register it with the web API when accessToken is available.
 * When accessToken is null (e.g. user not logged in via WebView yet), token is not sent to API.
 */
export function useFcmToken(accessToken: string | null): void {
  const lastRegistered = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function run() {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let final = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        final = status;
      }
      if (final !== 'granted' || !mounted) return;

      const deviceToken = await Notifications.getDevicePushTokenAsync();
      const token = deviceToken?.data;
      if (!token || !mounted) return;

      if (accessToken && token !== lastRegistered.current) {
        try {
          await registerFcmToken(accessToken, token);
          lastRegistered.current = token;
        } catch (e) {
          __DEV__ && console.warn('FCM token registration failed', e);
        }
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, [accessToken]);
}
