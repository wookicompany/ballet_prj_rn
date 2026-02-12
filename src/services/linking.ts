import { Linking } from 'react-native';

/**
 * Open URL in system browser or tel/mailto in native app.
 * Use when the URL should not be loaded inside WebView (external domain, tel:, mailto:).
 */
export async function openExternalUrl(url: string): Promise<void> {
  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
  }
}
