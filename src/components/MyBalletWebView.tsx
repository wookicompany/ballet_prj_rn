import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { WEBVIEW_ORIGIN } from '../constants/config';
import { openExternalUrl } from '../services/linking';

interface MyBalletWebViewProps {
  url: string;
  onMessage?: (event: { nativeEvent: { data: string } }) => void;
  onShouldStartLoadWithRequest?: (request: { url: string }) => boolean;
  onNavigationStateChange?: (nav: { canGoBack?: boolean }) => void;
  webViewRef?: React.RefObject<WebView>;
}

function isSameOrigin(url: string): boolean {
  try {
    const u = url.trim();
    if (!u) return false;
    return u === WEBVIEW_ORIGIN || u.startsWith(WEBVIEW_ORIGIN + '/') || u.startsWith(WEBVIEW_ORIGIN + '?');
  } catch {
    return false;
  }
}

export function MyBalletWebView({
  url,
  onMessage,
  onShouldStartLoadWithRequest,
  onNavigationStateChange,
  webViewRef,
}: MyBalletWebViewProps) {
  const handleShouldStartLoadWithRequest = (request: { url: string }) => {
    if (onShouldStartLoadWithRequest && !onShouldStartLoadWithRequest(request)) {
      return false;
    }
    const targetUrl = request.url;
    if (isSameOrigin(targetUrl)) {
      return true;
    }
    const lower = targetUrl.toLowerCase();
    if (lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('tel:') || lower.startsWith('mailto:')) {
      openExternalUrl(targetUrl);
      return false;
    }
    return true;
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: url }}
        style={styles.webview}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        onNavigationStateChange={onNavigationStateChange}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        originWhitelist={['https://*', 'http://*']}
        {...(Platform.OS === 'android' && {
          mixedContentMode: 'compatibility' as const,
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
});
