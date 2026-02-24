import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { AddressSearchModal, type AddressSelectedPayload } from '../components/AddressSearchModal';
import { MyBalletWebView } from '../components/MyBalletWebView';
import { NotificationBanner } from '../components/NotificationBanner';
import { WEBVIEW_ORIGIN } from '../constants/config';
import { useExpoPushToken } from '../hooks/useExpoPushToken';
import { useWebViewMessage } from '../hooks/useWebViewMessage';
import { registerExpoPushToken } from '../services/expoPush';
import { useWebViewUrl } from '../hooks/useWebViewUrl';
import type { WebView } from 'react-native-webview';

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

interface WebViewScreenProps {
  onInitialWebViewReady?: () => void;
}

export function WebViewScreen({ onInitialWebViewReady }: WebViewScreenProps) {
  const { url, setUrl } = useWebViewUrl();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAddressSearchOpen, setIsAddressSearchOpen] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [foregroundNotification, setForegroundNotification] = useState<ForegroundNotification>(null);
  const webViewRef = useRef<WebView>(null);
  const lastAccessTokenRef = useRef<string | null>(null);
  const isInitialWebViewReadyNotifiedRef = useRef(false);

  useEffect(() => {
    if (accessToken) {
      lastAccessTokenRef.current = accessToken;
    }
  }, [accessToken]);

  const handleAuthToken = useCallback((token: string) => {
    setAccessToken((prev) => (prev === token ? prev : token));
  }, []);

  const clearRegisteredExpoPushToken = useCallback(async (eventType: 'logout' | 'account_deleted') => {
    const tokenForClear = accessToken ?? lastAccessTokenRef.current;
    if (!tokenForClear) {
      console.warn('[ExpoPush] Skip token clear: no access token', { eventType });
      setAccessToken(null);
      return;
    }

    try {
      await registerExpoPushToken(tokenForClear, '');
    } catch (error) {
      console.warn('[ExpoPush] Token clear failed', { eventType, error });
    } finally {
      setAccessToken(null);
    }
  }, [accessToken]);

  const handleOpenAddressSearch = useCallback(() => {
    setIsAddressSearchOpen(true);
  }, []);
  const onMessage = useWebViewMessage({
    onAuthToken: handleAuthToken,
    onOpenAddressSearch: handleOpenAddressSearch,
    onSessionTerminated: clearRegisteredExpoPushToken,
  });
  useExpoPushToken(accessToken);

  const handleAddressSelected = useCallback((payload: AddressSelectedPayload) => {
    webViewRef.current?.postMessage?.(
      JSON.stringify({
        type: 'address_selected',
        address: payload.address,
        roadAddress: payload.roadAddress,
        jibunAddress: payload.jibunAddress,
      }),
    );
  }, []);

  const onNavigationStateChange = useCallback((nav: { canGoBack?: boolean }) => {
    setCanGoBack(nav.canGoBack ?? false);
  }, []);

  const handleWebViewLoadEnd = useCallback(() => {
    if (isInitialWebViewReadyNotifiedRef.current) return;
    isInitialWebViewReadyNotifiedRef.current = true;
    onInitialWebViewReady?.();
  }, [onInitialWebViewReady]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const link = response.notification.request.content.data?.link as string | undefined;
      if (link) {
        const fullUrl = link.startsWith('http') ? link : `${WEBVIEW_ORIGIN}${link.startsWith('/') ? link : '/' + link}`;
        setUrl(fullUrl);
      }
    });
    return () => sub.remove();
  }, [setUrl]);

  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const link = response.notification.request.content.data?.link as string | undefined;
      if (link) {
        const fullUrl = link.startsWith('http') ? link : `${WEBVIEW_ORIGIN}${link.startsWith('/') ? link : '/' + link}`;
        setUrl(fullUrl);
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

  const handleBannerPress = useCallback(() => {
    if (foregroundNotification?.link) {
      const fullUrl = foregroundNotification.link.startsWith('http')
        ? foregroundNotification.link
        : `${WEBVIEW_ORIGIN}${foregroundNotification.link.startsWith('/') ? foregroundNotification.link : '/' + foregroundNotification.link}`;
      setUrl(fullUrl);
    }
    setForegroundNotification(null);
  }, [foregroundNotification, setUrl]);

  React.useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isAddressSearchOpen) {
        setIsAddressSearchOpen(false);
        return true;
      }
      if (canGoBack) {
        webViewRef.current?.goBack?.();
      } else {
        BackHandler.exitApp();
      }
      return true;
    });
    return () => sub.remove();
  }, [canGoBack, isAddressSearchOpen]);

  return (
    <View style={styles.wrapper}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        {foregroundNotification ? (
          <NotificationBanner
            title={foregroundNotification.title}
            body={foregroundNotification.body}
            link={foregroundNotification.link}
            onPress={handleBannerPress}
            onDismiss={() => setForegroundNotification(null)}
          />
        ) : null}
        <MyBalletWebView
          key={url}
          url={url}
          webViewRef={webViewRef}
          onMessage={onMessage}
          onNavigationStateChange={onNavigationStateChange}
          onLoadEnd={handleWebViewLoadEnd}
        />
        <AddressSearchModal
          visible={isAddressSearchOpen}
          onClose={() => setIsAddressSearchOpen(false)}
          onSelected={handleAddressSelected}
        />
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
