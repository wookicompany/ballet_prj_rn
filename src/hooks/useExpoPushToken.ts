import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
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
export function useExpoPushToken(accessToken: string | null): { resetRegistrationCache: () => void } {
  const accessTokenRef = useRef<string | null>(accessToken);
  const latestExpoPushToken = useRef<string | null>(null);
  const lastRegisteredToken = useRef<string | null>(null);
  const lastRegisteredAccessToken = useRef<string | null>(null);
  const projectId = useMemo(() => getProjectId(), []);

  const shouldSkipRegister = (token: string, tokenOwner: string) =>
    token === lastRegisteredToken.current && tokenOwner === lastRegisteredAccessToken.current;

  /**
   * Clear the register dedup cache so the next (token, accessToken) pair is
   * re-registered. Call this after a server-side token clear (logout/account
   * deletion) that happens outside this hook, otherwise a re-login with the
   * same access token would be skipped as "already registered".
   */
  const resetRegistrationCache = useCallback(() => {
    lastRegisteredToken.current = null;
    lastRegisteredAccessToken.current = null;
  }, []);

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

    // 잠긴 백그라운드 실행 시 키체인 접근(errSecInteractionNotAllowed)을 피하려면
    // 앱이 active일 때만 토큰을 확보한다. 아직 토큰이 없으면 active 전환 시 재시도하고,
    // 한 번 확보되면(latestExpoPushToken) 더는 반복하지 않는다. (등록 중복은 dedup가 방지)
    const maybeRun = () => {
      if (AppState.currentState !== 'active') return;
      if (latestExpoPushToken.current) return;
      run().catch((error) => {
        console.warn('[ExpoPush] Token setup failed', error);
      });
    };

    maybeRun();
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') maybeRun();
    });

    return () => {
      mounted = false;
      tokenSub.remove();
      appStateSub.remove();
    };
  }, [projectId]);

  return { resetRegistrationCache };
}
