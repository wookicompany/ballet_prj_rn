import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import messaging from '@react-native-firebase/messaging';
import { registerFcmToken } from '../services/fcm';

/**
 * Request notification permissions, get FCM registration token via RNFirebase,
 * and register it with the web API when accessToken is available.
 * Expo push token is never sent to the server.
 */
export function useFcmToken(accessToken: string | null): void {
  const accessTokenRef = useRef<string | null>(accessToken);
  const latestFcmToken = useRef<string | null>(null);
  const lastRegisteredToken = useRef<string | null>(null);
  const lastRegisteredAccessToken = useRef<string | null>(null);

  const shouldSkipRegister = (token: string, tokenOwner: string) =>
    token === lastRegisteredToken.current && tokenOwner === lastRegisteredAccessToken.current;

  useEffect(() => {
    accessTokenRef.current = accessToken;

    const queuedToken = latestFcmToken.current;
    if (!accessToken || !queuedToken || shouldSkipRegister(queuedToken, accessToken)) return;

    void registerFcmToken(accessToken, queuedToken)
      .then(() => {
        lastRegisteredToken.current = queuedToken;
        lastRegisteredAccessToken.current = accessToken;
      })
      .catch((error) => {
        console.warn('[FCM] Queued token registration failed', error);
      });
  }, [accessToken]);

  useEffect(() => {
    let mounted = true;
    let unsubscribeTokenRefresh: (() => void) | undefined;

    async function run() {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let final = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        final = status;
      }
      if (final !== 'granted' || !mounted) return;

      await messaging().registerDeviceForRemoteMessages();
      const fcmToken = await messaging().getToken();
      if (!fcmToken || !mounted) return;

      latestFcmToken.current = fcmToken;
      const currentAccessToken = accessTokenRef.current;
      if (currentAccessToken && !shouldSkipRegister(fcmToken, currentAccessToken)) {
        try {
          await registerFcmToken(currentAccessToken, fcmToken);
          lastRegisteredToken.current = fcmToken;
          lastRegisteredAccessToken.current = currentAccessToken;
        } catch (e) {
          console.warn('[FCM] Initial token registration failed', e);
        }
      }

      unsubscribeTokenRefresh = messaging().onTokenRefresh((refreshedToken) => {
        latestFcmToken.current = refreshedToken;
        const activeAccessToken = accessTokenRef.current;
        if (!activeAccessToken || shouldSkipRegister(refreshedToken, activeAccessToken)) return;

        void registerFcmToken(activeAccessToken, refreshedToken)
          .then(() => {
            lastRegisteredToken.current = refreshedToken;
            lastRegisteredAccessToken.current = activeAccessToken;
          })
          .catch((error) => {
            console.warn('[FCM] Token refresh registration failed', error);
          });
      });
    }

    run().catch((error) => {
      console.warn('[FCM] Token setup failed', error);
    });

    return () => {
      mounted = false;
      unsubscribeTokenRefresh?.();
    };
  }, []);
}
