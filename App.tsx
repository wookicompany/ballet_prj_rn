import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Sentry from '@sentry/react-native';
import { WebViewScreen } from './src/screens/WebViewScreen';

Sentry.init({
  dsn: 'https://ab408aad9df809c1fc7488c6252a4462@o4510941708288000.ingest.us.sentry.io/4511181856047104',
  tracesSampleRate: 0.2,
  beforeSend(event, hint) {
    // 잠금 상태에서 푸시 등록 시 iOS 키체인 접근 실패(errSecInteractionNotAllowed, -25308).
    // 비치명적이며 다음 활성 실행에서 자가복구되므로 리포트에서 제외한다.
    // JS rejection(hint.originalException)과 네이티브 발원 이벤트(event.exception.values) 양쪽을 검사.
    const err = hint?.originalException as { code?: unknown; message?: unknown } | undefined;
    const code = err?.code != null ? String(err.code) : '';
    const message = typeof err?.message === 'string' ? err.message : '';
    const inValues = event.exception?.values?.some(
      (v) => typeof v?.value === 'string' && v.value.includes('Keychain access failed'),
    ) ?? false;
    if (code === '-25308' || message.includes('Keychain access failed') || inValues) {
      return null;
    }
    return event;
  },
});

const Stack = createNativeStackNavigator();
const MIN_SPLASH_MS = 2000;
const MAX_SPLASH_MS = 8000;

void SplashScreen.preventAutoHideAsync().catch(() => {
  // no-op: splash may already be handled by native side
});

function App() {
  const [isMinDurationElapsed, setIsMinDurationElapsed] = React.useState(false);
  const [isInitialWebViewReady, setIsInitialWebViewReady] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsMinDurationElapsed(true);
    }, MIN_SPLASH_MS);

    return () => clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    if (!isMinDurationElapsed || !isInitialWebViewReady) return;
    void SplashScreen.hideAsync().catch(() => {
      // no-op: splash might already be hidden
    });
  }, [isInitialWebViewReady, isMinDurationElapsed]);

  // Fallback: force-hide the splash if the WebView never signals readiness
  // (e.g. an initial load that hangs without firing onLoadEnd). hideAsync is
  // idempotent, so this is a no-op when the normal path already hid it.
  React.useEffect(() => {
    const timer = setTimeout(() => {
      void SplashScreen.hideAsync().catch(() => {
        // no-op: splash might already be hidden
      });
    }, MAX_SPLASH_MS);

    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen name="WebView">
            {() => <WebViewScreen onInitialWebViewReady={() => setIsInitialWebViewReady(true)} />}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(App);
