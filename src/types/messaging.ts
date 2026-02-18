/**
 * Web → RN postMessage payload types.
 * Web sends JSON.stringify(payload) via window.ReactNativeWebView?.postMessage(...)
 */
export type WebToRNMessage =
  | { type: 'haptic' }
  | { type: 'auth_token'; access_token: string }
  | { type: 'open_address_search' }
  | { type: 'logout'; version: 1 }
  | { type: 'account_deleted'; version: 1 };

export function parseWebMessage(data: string): WebToRNMessage | null {
  try {
    const parsed = JSON.parse(data) as unknown;
    if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) {
      console.warn('[WebViewMessage] Ignored message: missing type', parsed);
      return null;
    }

    const type = typeof parsed.type === 'string' ? parsed.type : '';
    if (parsed.type === 'haptic') {
      return { type: 'haptic' };
    }

    if (parsed.type === 'auth_token' && 'access_token' in parsed) {
      const token = typeof parsed.access_token === 'string' ? parsed.access_token.trim() : '';
      if (token.length > 0) {
        return { type: 'auth_token', access_token: token };
      }
    }

    if (parsed.type === 'open_address_search') {
      return { type: 'open_address_search' };
    }

    if (type === 'logout' || type === 'account_deleted') {
      const version = 'version' in parsed ? parsed.version : undefined;
      if (version === 1) {
        return { type, version: 1 };
      }
      console.warn('[WebViewMessage] Ignored message: invalid version', parsed);
      return null;
    }

    console.warn('[WebViewMessage] Ignored message: unsupported type', parsed);
    return null;
  } catch {
    console.warn('[WebViewMessage] Ignored message: invalid JSON', data);
    return null;
  }
}
