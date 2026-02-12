/**
 * Web → RN postMessage payload types.
 * Web sends JSON.stringify(payload) via window.ReactNativeWebView?.postMessage(...)
 */
export type WebToRNMessage = { type: 'haptic' } | { type: 'auth_token'; access_token: string };

export function parseWebMessage(data: string): WebToRNMessage | null {
  try {
    const parsed = JSON.parse(data) as unknown;
    if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) {
      return null;
    }

    if (parsed.type === 'haptic') {
      return { type: 'haptic' };
    }

    if (parsed.type === 'auth_token' && 'access_token' in parsed) {
      const token = typeof parsed.access_token === 'string' ? parsed.access_token.trim() : '';
      if (token.length > 0) {
        return { type: 'auth_token', access_token: token };
      }
    }

    return null;
  } catch {
    return null;
  }
}
