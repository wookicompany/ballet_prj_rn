import { BASE_WEB_URL, DEFAULT_ENTRY_PATH } from './config';

/**
 * __DEV__-based URL switch for development vs production.
 * Override BASE_WEB_URL in config.ts or via env for staging.
 */
export function getWebBaseUrl(): string {
  return BASE_WEB_URL;
}

/**
 * Initial URL for WebView (default entry).
 */
export function getInitialWebViewUrl(): string {
  return `${getWebBaseUrl()}${DEFAULT_ENTRY_PATH}`;
}
