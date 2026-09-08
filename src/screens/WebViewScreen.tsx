import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';
import NetInfo from '@react-native-community/netinfo';
import { MyBalletWebView } from '../components/MyBalletWebView';
import { NotificationBanner } from '../components/NotificationBanner';
import { LoadingScreen } from '../components/LoadingScreen';
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

// 초기 웹 로드 생애주기 상태.
//  - loading: 아직 로드가 끝나지 않음(느린 로딩/응답 지연 포함). 고양이 로딩 화면.
//  - failed : onError로 확정된 로드 실패/오프라인. OfflineScreen(문구+재시도).
//  - loaded : 로드 완료. 오버레이 없이 웹 표시.
// 초기값을 loading으로 두어, 네이티브 스플래시가 걷히는 순간 RN 고양이 뷰가 이미
// 렌더돼 있어 흰 틈이 생기지 않는다.
type LoadStatus = 'loading' | 'failed' | 'loaded';

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
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const webViewRef = useRef<WebView>(null);
  const lastAccessTokenRef = useRef<string | null>(null);
  const isInitialWebViewReadyNotifiedRef = useRef(false);
  const healthSyncInFlightRef = useRef(false);
  // 'failed' 상태를 동기적으로 추적한다. NetInfo 자동복구 판단과, onLoadEnd에서
  // 로딩 오버레이를 걷을지(실패면 안 걷음) 판단하는 데 쓴다. onError는 onLoadEnd보다
  // 먼저 발생하므로, 실패 케이스에서 이 ref가 onLoadEnd 시점에 이미 true다.
  const loadFailedRef = useRef(false);

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

    // 로드가 끝났고(문서 완료) 실패가 아니면 로딩 오버레이를 걷는다. onLoad(handleLoadSuccess)
    // 가 놓치는 경우에도 영구 로딩/흰 화면을 막는 백스톱이며, 이는 스플래시를 걷는 신호와
    // 동일한 시점(onLoadEnd)이라 매끄럽다. 실패 케이스에서는 loadFailedRef가 이미 true라
    // 여기서 'loaded'로 넘어가지 않고 OfflineScreen이 유지된다.
    if (!loadFailedRef.current) {
      setLoadStatus((prev) => (prev === 'failed' ? prev : 'loaded'));
    }

    if (isInitialWebViewReadyNotifiedRef.current) return;

    isInitialWebViewReadyNotifiedRef.current = true;
    onInitialWebViewReady?.();
  }, [onInitialWebViewReady, postPlatformInfo]);

  const handleLoadError = useCallback(() => {
    loadFailedRef.current = true;
    setLoadStatus('failed');
  }, []);

  const handleLoadSuccess = useCallback(() => {
    loadFailedRef.current = false;
    setLoadStatus('loaded');
  }, []);

  // reload만 트리거하고 'failed' 상태는 유지한다. 로드 성공 시 onLoad(handleLoadSuccess)
  // 가 'loaded'로 해제하므로, 재시도/자동복구 중에도 오프라인 화면(+"연결 중" 표시)이 유지되고
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
        {loadStatus === 'failed' ? (
          <OfflineScreen onRetry={handleRetry} />
        ) : loadStatus === 'loading' ? (
          <LoadingScreen />
        ) : null}
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
