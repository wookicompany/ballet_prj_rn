import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import {
  WEBVIEW_ALLOWED_HOST_SUFFIXES,
  WEBVIEW_ALLOWED_HOSTS,
  WEBVIEW_FORCE_EXTERNAL_HOST_SUFFIXES,
  WEBVIEW_FORCE_EXTERNAL_HOSTS,
  WEBVIEW_ORIGIN,
} from '../constants/config';
import { openExternalUrl } from '../services/linking';

interface MyBalletWebViewProps {
  url: string;
  onMessage?: (event: { nativeEvent: { data: string } }) => void;
  onShouldStartLoadWithRequest?: (request: { url: string }) => boolean;
  onNavigationStateChange?: (nav: { canGoBack?: boolean }) => void;
  webViewRef?: React.RefObject<WebView | null>;
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

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, '');
}

function isAllowedHost(host: string): boolean {
  const normalized = normalizeHost(host);
  if (!normalized) return false;
  if (WEBVIEW_ALLOWED_HOSTS.some((h) => normalizeHost(h) === normalized)) return true;
  return WEBVIEW_ALLOWED_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

function isForceExternalHost(host: string): boolean {
  const normalized = normalizeHost(host);
  if (!normalized) return false;
  if (WEBVIEW_FORCE_EXTERNAL_HOSTS.some((h) => normalizeHost(h) === normalized)) return true;
  return WEBVIEW_FORCE_EXTERNAL_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

function isForceExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    return isForceExternalHost(parsed.hostname);
  } catch {
    return false;
  }
}

function isAllowedInWebView(url: string): boolean {
  if (isSameOrigin(url)) return true;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    return isAllowedHost(parsed.hostname);
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
    if (isForceExternalUrl(targetUrl)) {
      openExternalUrl(targetUrl);
      return false;
    }
    if (isAllowedInWebView(targetUrl)) {
      return true;
    }
    const lower = targetUrl.toLowerCase();
    if (lower.startsWith('tel:') || lower.startsWith('mailto:')) {
      openExternalUrl(targetUrl);
      return false;
    }
    if (lower.startsWith('http://') || lower.startsWith('https://')) {
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
