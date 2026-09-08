import { Linking } from 'react-native';

/**
 * Open URL in system browser or tel/mailto in native app.
 * Use when the URL should not be loaded inside WebView (external domain, tel:, mailto:).
 */
export async function openExternalUrl(url: string): Promise<void> {
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    }
  } catch (error) {
    // 외부 URL 열기 실패(앱이 백그라운드로 전환된 직후 등)는 비치명적이다.
    // 호출부는 fire-and-forget이므로 여기서 삼켜 unhandled rejection을 방지한다.
    console.warn('[Linking] Failed to open external URL', url, error);
  }
}
