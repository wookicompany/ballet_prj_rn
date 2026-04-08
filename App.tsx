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
  tracesSampleRate: 1.0,
});

const Stack = createNativeStackNavigator();
const MIN_SPLASH_MS = 2000;

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
