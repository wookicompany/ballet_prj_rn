import { WEBVIEW_ORIGIN } from '../constants/config';

/**
 * Deep link scheme (spec: myballet://).
 */
export const DEEP_LINK_SCHEME = 'myballet';

/**
 * Parse myballet:// URL and return web URL to load in WebView.
 * Supports:
 * - myballet://open?url=<encoded_full_url>
 * - myballet://<path> (resolved to WEBVIEW_ORIGIN + path)
 */
export function getWebViewUrlFromDeepLink(linkUrl: string): string | null {
  try {
    if (!linkUrl || !linkUrl.toLowerCase().startsWith(`${DEEP_LINK_SCHEME}://`)) {
      return null;
    }
    const rest = linkUrl.slice((DEEP_LINK_SCHEME + '://').length);
    const [pathPart, searchPart] = rest.split('?');
    if (searchPart) {
      const params = new URLSearchParams(searchPart);
      const urlParam = params.get('url');
      if (urlParam) {
        const decoded = decodeURIComponent(urlParam);
        if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
          return decoded;
        }
        return `${WEBVIEW_ORIGIN}${decoded.startsWith('/') ? decoded : '/' + decoded}`;
      }
    }
    const path = pathPart?.trim() || '';
    const normalizedPath = path.startsWith('/') ? path : '/' + path;
    return `${WEBVIEW_ORIGIN}${normalizedPath || '/'}`;
  } catch {
    return null;
  }
}

export const linkingConfig = {
  prefixes: [`${DEEP_LINK_SCHEME}://`],
  getPathFromState(state: { routes?: { name: string; params?: Record<string, unknown> }[] }) {
    const route = state?.routes?.[0];
    if (route?.name === 'WebView' && route.params?.url) {
      return `open?url=${encodeURIComponent(route.params.url as string)}`;
    }
    return '';
  },
};
