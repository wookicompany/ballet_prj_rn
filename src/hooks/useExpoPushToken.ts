import { useEffect, useMemo, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { registerExpoPushToken } from '../services/expoPush';

function getProjectId(): string | null {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  return typeof projectId === 'string' && projectId.trim().length > 0 ? projectId : null;
}

/**
 * Request notification permissions, get Expo push token,
 * and register it with the web API when accessToken is available.
 */
export function useExpoPushToken(accessToken: string | null): void {
  const accessTokenRef = useRef<string | null>(accessToken);
  const latestExpoPushToken = useRef<string | null>(null);
  const lastRegisteredToken = useRef<string | null>(null);
  const lastRegisteredAccessToken = useRef<string | null>(null);
  const projectId = useMemo(() => getProjectId(), []);

  const shouldSkipRegister = (token: string, tokenOwner: string) =>
    token === lastRegisteredToken.current && tokenOwner === lastRegisteredAccessToken.current;

  useEffect(() => {
    accessTokenRef.current = accessToken;

    const queuedToken = latestExpoPushToken.current;
    if (!accessToken || !queuedToken || shouldSkipRegister(queuedToken, accessToken)) return;

    void registerExpoPushToken(accessToken, queuedToken)
      .then(() => {
        lastRegisteredToken.current = queuedToken;
        lastRegisteredAccessToken.current = accessToken;
      })
      .catch((error) => {
        console.warn('[ExpoPush] Queued token registration failed', error);
      });
  }, [accessToken]);

  useEffect(() => {
    let mounted = true;
    const effectiveProjectId = projectId;

    if (!effectiveProjectId) {
      console.warn('[ExpoPush] Missing EAS projectId');
      return;
    }

    async function run() {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let final = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        final = status;
      }
      if (final !== 'granted' || !mounted) return;

      const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId: effectiveProjectId! });
      const expoPushToken = tokenResult.data?.trim();
      if (!expoPushToken || !mounted) return;

      latestExpoPushToken.current = expoPushToken;
      const currentAccessToken = accessTokenRef.current;
      if (currentAccessToken && !shouldSkipRegister(expoPushToken, currentAccessToken)) {
        try {
          await registerExpoPushToken(currentAccessToken, expoPushToken);
          lastRegisteredToken.current = expoPushToken;
          lastRegisteredAccessToken.current = currentAccessToken;
        } catch (error) {
          console.warn('[ExpoPush] Initial token registration failed', error);
        }
      }
    }

    const tokenSub = Notifications.addPushTokenListener((token) => {
      const refreshedToken = token.data?.trim();
      if (!refreshedToken) return;

      latestExpoPushToken.current = refreshedToken;
      const currentAccessToken = accessTokenRef.current;
      if (!currentAccessToken || shouldSkipRegister(refreshedToken, currentAccessToken)) return;

      void registerExpoPushToken(currentAccessToken, refreshedToken)
        .then(() => {
          lastRegisteredToken.current = refreshedToken;
          lastRegisteredAccessToken.current = currentAccessToken;
        })
        .catch((error) => {
          console.warn('[ExpoPush] Token refresh registration failed', error);
        });
    });

    run().catch((error) => {
      console.warn('[ExpoPush] Token setup failed', error);
    });

    return () => {
      mounted = false;
      tokenSub.remove();
    };
  }, [projectId]);
}
