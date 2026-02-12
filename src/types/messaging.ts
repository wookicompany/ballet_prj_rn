/**
 * Web → RN postMessage payload types.
 * Web sends JSON.stringify(payload) via window.ReactNativeWebView?.postMessage(...)
 */
export interface WebToRNMessage {
  type: 'haptic';
}

export function parseWebMessage(data: string): WebToRNMessage | null {
  try {
    const parsed = JSON.parse(data) as unknown;
    if (parsed && typeof parsed === 'object' && 'type' in parsed && parsed.type === 'haptic') {
      return { type: 'haptic' };
    }
    return null;
  } catch {
    return null;
  }
}
