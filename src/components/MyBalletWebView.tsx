import React, { useCallback } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import NetInfo from '@react-native-community/netinfo';
import {
  WEBVIEW_ALLOWED_HOST_SUFFIXES,
  WEBVIEW_ALLOWED_HOSTS,
  WEBVIEW_FORCE_EXTERNAL_HOST_SUFFIXES,
  WEBVIEW_FORCE_EXTERNAL_HOSTS,
  WEBVIEW_ORIGIN,
} from '../constants/config';
import { openExternalUrl } from '../services/linking';

// Android WebViewClient ERROR_* 중 '실제 네트워크 연결 실패'로 확정할 수 있는 코드.
// -2 HOST_LOOKUP(DNS 실패), -6 CONNECT(연결 실패), -7 IO(서버 read/write 실패),
// -8 TIMEOUT(타임아웃). 이 코드들은 리다이렉트/네비게이션 취소(ERR_ABORTED, -1)로는
// 발생하지 않으므로 오탐 없이 오프라인 처리 신호로 신뢰할 수 있다.
const ANDROID_NETWORK_ERROR_CODES = new Set<number>([-2, -6, -7, -8]);

const INJECTED_BRIDGE_GUARD_JS = `
  (function() {
    if (window.__MYBALLET_RN_BRIDGE_GUARD__) return;
    window.__MYBALLET_RN_BRIDGE_GUARD__ = true;

    var originalOpen = window.open;
    window.open = function(url, target, features) {
      if (typeof url === 'string' && url.length > 0) {
        window.location.href = url;
      }
      return null;
    };

    document.addEventListener('click', function(event) {
      var node = event && event.target;
      while (node && node.tagName !== 'A') {
        node = node.parentElement;
      }
      if (!node) return;
      if (node.target === '_blank') {
        node.target = '_self';
      }
    }, true);

    var queue = [];
    function sendNow(message) {
      if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
        window.ReactNativeWebView.postMessage(message);
        return true;
      }
      return false;
    }

    var fallbackBridge = {
      postMessage: function(message) {
        var safeMessage = String(message);
        if (!sendNow(safeMessage)) {
          queue.push(safeMessage);
        }
      }
    };

    if (!window.ReactNativeWebView || typeof window.ReactNativeWebView.postMessage !== 'function') {
      window.ReactNativeWebView = fallbackBridge;
    }

    var flushAttempts = 0;
    var maxFlushAttempts = 200;
    var flushTimer = setInterval(function() {
      flushAttempts += 1;
      if (!window.ReactNativeWebView || typeof window.ReactNativeWebView.postMessage !== 'function') return;
      while (queue.length > 0) {
        window.ReactNativeWebView.postMessage(queue.shift());
      }
      if (flushAttempts >= maxFlushAttempts || queue.length === 0) {
        clearInterval(flushTimer);
      }
    }, 50);
  })();
  true;
`;

interface MyBalletWebViewProps {
  url: string;
  onMessage?: (event: { nativeEvent: { data: string; url?: string } }) => void;
  onShouldStartLoadWithRequest?: (request: { url: string }) => boolean;
  onNavigationStateChange?: (nav: { canGoBack?: boolean }) => void;
  onLoadEnd?: () => void;
  onLoadError?: () => void;
  onLoadSuccess?: () => void;
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
  onLoadEnd,
  onLoadError,
  onLoadSuccess,
  webViewRef,
}: MyBalletWebViewProps) {
  const handleShouldStartLoadWithRequest = useCallback((request: { url: string }) => {
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
  }, [onShouldStartLoadWithRequest]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: url }}
        style={styles.webview}
        injectedJavaScriptBeforeContentLoaded={INJECTED_BRIDGE_GUARD_JS}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        onNavigationStateChange={onNavigationStateChange}
        onLoadEnd={onLoadEnd}
        onLoad={() => {
          onLoadSuccess?.();
        }}
        onError={(event) => {
          console.warn('[WebView] load error', event.nativeEvent);
          const code = event.nativeEvent?.code;

          // iOS: 기존 동작을 그대로 보존한다(빌드 59 동작 유지).
          // 취소(-999)·정책/프레임 로드 중단(102)은 실제 네트워크 실패가 아니므로 제외.
          if (Platform.OS === 'ios') {
            if (code === -999 || code === 102) return;
            onLoadError?.();
            return;
          }

          // Android: 라이브러리(react-native-webview)가 구형 onReceivedError만
          // 오버라이드해 onError는 '메인 프레임 메인 리소스 실패'에서만 호출되지만,
          // 리다이렉트/네비게이션 취소(ERR_ABORTED 등, code -1)로도 올라와 오탐이 난다.
          // 그래서 (1) 명백한 네트워크 오류 코드이거나 (2) 실제 연결이 offline일 때만
          // 오프라인 화면을 띄운다. 불확실하면 정상 화면을 유지(fail-open)해 오탐을 막는다.
          if (typeof code === 'number' && ANDROID_NETWORK_ERROR_CODES.has(code)) {
            onLoadError?.();
            return;
          }
          NetInfo.fetch()
            .then((state) => {
              if (state.isConnected === false || state.isInternetReachable === false) {
                onLoadError?.();
              }
            })
            .catch(() => {
              // 연결 상태 확인 실패 시 불확실 → 오프라인 화면을 띄우지 않는다(오탐 방지).
            });
        }}
        onHttpError={(event) => {
          console.warn('[WebView] http error', event.nativeEvent);
        }}
        javaScriptEnabled
        javaScriptCanOpenWindowsAutomatically={false}
        domStorageEnabled
        sharedCookiesEnabled
        setSupportMultipleWindows={false}
        originWhitelist={ORIGIN_WHITELIST}
        bounces={false}
        {...(Platform.OS === 'ios' && {
          decelerationRate: 'normal' as const,
        })}
        {...(Platform.OS === 'android' && {
          mixedContentMode: 'always' as const,
        })}
      />
    </View>
  );
}

const ORIGIN_WHITELIST = ['https://*', 'http://*'];

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
});
