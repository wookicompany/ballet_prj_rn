import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { MyBalletWebView } from '../components/MyBalletWebView';
import { NotificationBanner } from '../components/NotificationBanner';
import { WEBVIEW_ORIGIN } from '../constants/config';
import { useFcmToken } from '../hooks/useFcmToken';
import { useHapticMessage } from '../hooks/useHapticMessage';
import { useWebViewUrl } from '../hooks/useWebViewUrl';
import type { WebView } from 'react-native-webview';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

type ForegroundNotification = { title?: string; body?: string; link?: string } | null;

export function WebViewScreen() {
  const { url, setUrl } = useWebViewUrl();
  const [canGoBack, setCanGoBack] = useState(false);
  const [foregroundNotification, setForegroundNotification] = useState<ForegroundNotification>(null);
  const webViewRef = useRef<WebView>(null);
  const onMessage = useHapticMessage();
  useFcmToken(null);

  const onNavigationStateChange = useCallback((nav: { canGoBack?: boolean }) => {
    setCanGoBack(nav.canGoBack ?? false);
  }, []);

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
