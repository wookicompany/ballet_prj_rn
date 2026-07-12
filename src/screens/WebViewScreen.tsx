import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';
import NetInfo from '@react-native-community/netinfo';
import { MyBalletWebView } from '../components/MyBalletWebView';
import { NotificationBanner } from '../components/NotificationBanner';
import { OfflineScreen } from '../components/OfflineScreen';
import { useExpoPushToken } from '../hooks/useExpoPushToken';
import { useWebViewMessage } from '../hooks/useWebViewMessage';
import { registerExpoPushToken } from '../services/expoPush';
import { useWebViewUrl } from '../hooks/useWebViewUrl';
import { resolveNotificationLink } from '../navigation/linking';
import type { WebView } from 'react-native-webview';
import { requestHealthSync } from '../services/healthSync';
import type { HealthSyncRequestPayload, PlatformInfoPayload } from '../types/messaging';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

type ForegroundNotification = { title?: string; body?: string; link?: string } | null;

const SAFE_AREA_EDGES = Platform.OS === 'ios'
  ? (['top', 'bottom', 'left', 'right'] as const)
  : (['top', 'left', 'right'] as const);

interface WebViewScreenProps {
  onInitialWebViewReady?: () => void;
}

export function WebViewScreen({ onInitialWebViewReady }: WebViewScreenProps) {
  const { url, setUrl } = useWebViewUrl();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [foregroundNotification, setForegroundNotification] = useState<ForegroundNotification>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const lastAccessTokenRef = useRef<string | null>(null);
  const isInitialWebViewReadyNotifiedRef = useRef(false);
  const healthSyncInFlightRef = useRef(false);
  const loadFailedRef = useRef(false);

  useEffect(() => {
    loadFailedRef.current = loadFailed;
  }, [loadFailed]);

  useEffect(() => {
    if (accessToken) {
      lastAccessTokenRef.current = accessToken;
    }
  }, [accessToken]);

  const { resetRegistrationCache } = useExpoPushToken(accessToken);

  const handleAuthToken = useCallback((token: string) => {
    setAccessToken((prev) => (prev === token ? prev : token));
  }, []);

  const clearRegisteredExpoPushToken = useCallback(async (eventType: 'logout' | 'account_deleted') => {
    const tokenForClear = accessToken ?? lastAccessTokenRef.current;
    if (!tokenForClear) {
      console.warn('[ExpoPush] Skip token clear: no access token', { eventType });
      setAccessToken(null);
      resetRegistrationCache();
      return;
    }

    try {
      await registerExpoPushToken(tokenForClear, '');
    } catch (error) {
      console.warn('[ExpoPush] Token clear failed', { eventType, error });
    } finally {
      setAccessToken(null);
      resetRegistrationCache();
    }
  }, [accessToken, resetRegistrationCache]);

  const postMessageToWeb = useCallback((payload: object) => {
    webViewRef.current?.postMessage?.(JSON.stringify(payload));
  }, []);
  const postPlatformInfo = useCallback(() => {
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const healthProvider = platform === 'ios' ? 'healthkit' : 'none';
    const platformInfo: PlatformInfoPayload = {
      type: 'platform_info',
      version: 1,
      platform,
      health_provider: healthProvider,
    };
    console.info('[WebViewBridge] Sending platform_info', { payload: platformInfo });
    postMessageToWeb(platformInfo);
  }, [postMessageToWeb]);

  const handleHealthSyncRequest = useCallback(async (payload: HealthSyncRequestPayload) => {
    if (healthSyncInFlightRef.current) {
      postMessageToWeb({
        type: 'health_sync_result',
        version: 1,
        request_id: payload.request_id,
        status: 'error',
        code: 'QUERY_FAILED',
        message: 'Another health sync is already in progress.',
      });
      return;
    }

    if (Platform.OS !== 'ios') {
      postMessageToWeb({
        type: 'health_sync_result',
        version: 1,
        request_id: payload.request_id,
        status: 'error',
        code: 'NO_PERMISSION',
        message: 'iOS(Apple Watch)에서만 연동 가능해요.',
      });
      return;
    }

    healthSyncInFlightRef.current = true;
    try {
      const result = await requestHealthSync(payload);
      postMessageToWeb(result);
    } finally {
      healthSyncInFlightRef.current = false;
    }
  }, [postMessageToWeb]);

  const handleOpenUrl = useCallback(async (url: string) => {
    await WebBrowser.openBrowserAsync(url);
  }, []);

  const onMessage = useWebViewMessage({
    onAuthToken: handleAuthToken,
    onSessionTerminated: clearRegisteredExpoPushToken,
    onHealthSyncRequest: handleHealthSyncRequest,
    onOpenUrl: handleOpenUrl,
  });

  const onNavigationStateChange = useCallback((nav: { canGoBack?: boolean }) => {
    setCanGoBack(nav.canGoBack ?? false);
  }, []);

  const handleWebViewLoadEnd = useCallback(() => {
    postPlatformInfo();

    if (isInitialWebViewReadyNotifiedRef.current) return;

    isInitialWebViewReadyNotifiedRef.current = true;
    onInitialWebViewReady?.();
  }, [onInitialWebViewReady, postPlatformInfo]);

  const handleLoadError = useCallback(() => {
    setLoadFailed(true);
  }, []);

  const handleLoadSuccess = useCallback(() => {
    setLoadFailed(false);
  }, []);

  // reload만 트리거하고 loadFailed는 유지한다. 로드 성공 시 onLoad(handleLoadSuccess)
  // 가 해제하므로, 재시도/자동복구 중에도 오프라인 화면(+"연결 중" 표시)이 유지되고
  // 성공한 순간에만 웹 화면으로 넘어가 깜빡임이 없다.
  const handleRetry = useCallback(() => {
    webViewRef.current?.reload();
  }, []);

  // 네트워크 복구를 감지하면, 로드 실패 상태였을 때 자동으로 reload 한다.
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && loadFailedRef.current) {
        webViewRef.current?.reload();
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const link = response.notification.request.content.data?.link as string | undefined;
      if (link) {
        setUrl(resolveNotificationLink(link));
      }
    });
    return () => sub.remove();
  }, [setUrl]);

  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const link = response.notification.request.content.data?.link as string | undefined;
      if (link) {
        setUrl(resolveNotificationLink(link));
      }
    });
  }, [setUrl]);

  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as { link?: string } | undefined;
      setForegroundNotification({
        title: notification.request.content.title ?? undefined,
        body: notification.request.content.body ?? undefined,
        link: data?.link,
      });
    });
    return () => sub.remove();
  }, []);

  const handleDismissBanner = useCallback(() => setForegroundNotification(null), []);

  const handleBannerPress = useCallback(() => {
    if (foregroundNotification?.link) {
      setUrl(resolveNotificationLink(foregroundNotification.link));
    }
    setForegroundNotification(null);
  }, [foregroundNotification, setUrl]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) {
        webViewRef.current?.goBack?.();
      } else {
        BackHandler.exitApp();
      }
      return true;
    });
    return () => sub.remove();
  }, [canGoBack]);

  return (
    <View style={styles.wrapper}>
      <SafeAreaView style={styles.container} edges={SAFE_AREA_EDGES}>
        {foregroundNotification ? (
          <NotificationBanner
            title={foregroundNotification.title}
            body={foregroundNotification.body}
            link={foregroundNotification.link}
            onPress={handleBannerPress}
            onDismiss={handleDismissBanner}
          />
        ) : null}
        <MyBalletWebView
          key={url}
          url={url}
          webViewRef={webViewRef}
          onMessage={onMessage}
          onNavigationStateChange={onNavigationStateChange}
          onLoadEnd={handleWebViewLoadEnd}
          onLoadError={handleLoadError}
          onLoadSuccess={handleLoadSuccess}
        />
        {loadFailed ? <OfflineScreen onRetry={handleRetry} /> : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
  },
});
