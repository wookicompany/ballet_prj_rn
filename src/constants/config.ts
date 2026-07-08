/**
 * Base URL for 마이발레 web app.
 * Production: https://www.myballet.co.kr
 * Development: override via env or use staging URL.
 */
const BASE_URL = 'https://www.myballet.co.kr';

/**
 * Full base URL (no trailing slash). Used for WebView source and API base.
 */
export const BASE_WEB_URL = BASE_URL;

/**
 * Default entry path (documented: /calendar or /).
 */
export const DEFAULT_ENTRY_PATH = '/calendar';

/**
 * Full URL for initial WebView load.
 */
export const DEFAULT_WEBVIEW_URL = `${BASE_WEB_URL}${DEFAULT_ENTRY_PATH}`;

/**
 * Expo push token registration endpoint (web API).
 * POST with Body: { expo_push_token: string }, Headers: Authorization: Bearer <Supabase access_token>
 */
export const EXPO_PUSH_TOKEN_API_PATH = '/api/profile/expo-push-token';

/**
 * Full URL for Expo push token registration (same origin as web).
 */
export const EXPO_PUSH_TOKEN_API_URL = `${BASE_WEB_URL}${EXPO_PUSH_TOKEN_API_PATH}`;

/**
 * Allowed origin for WebView (same domain only in WebView; others open externally).
 */
export const WEBVIEW_ORIGIN = BASE_WEB_URL;

/**
 * OAuth/login related hosts that should stay inside WebView.
 * Keep this list strict to prevent opening arbitrary external websites in-app.
 */
export const WEBVIEW_ALLOWED_HOSTS = ['myballet.co.kr', 'www.myballet.co.kr', 'appleid.apple.com'] as const;

/**
 * Suffix rules for providers using multiple subdomains.
 */
export const WEBVIEW_ALLOWED_HOST_SUFFIXES = ['.kakao.com', '.supabase.co', '.apple.com'] as const;

/**
 * Hosts that must open externally due provider policy.
 * Google OAuth rejects embedded WebView with disallowed_useragent.
 */
export const WEBVIEW_FORCE_EXTERNAL_HOSTS = ['accounts.google.com'] as const;
export const WEBVIEW_FORCE_EXTERNAL_HOST_SUFFIXES = ['.google.com'] as const;

/**
 * Whether a postMessage originating from `url` should be trusted by the RN bridge.
 * The bridge is injected into every page loaded in the WebView (including OAuth
 * provider pages), so only messages coming from the myballet web app are honored.
 *
 * Enforced in production only. In dev/preview builds (`__DEV__`) the gate is off
 * and every message passes, so pointing BASE_URL at a `*.vercel.app` preview or
 * localhost never silently drops bridge messages during QA. Production ships with
 * BASE_URL fixed to www.myballet.co.kr, where this gate blocks nothing legitimate
 * while still rejecting messages from foreign pages loaded in the WebView.
 *
 * Fail-open: if the origin URL is missing or unparseable, return true — only
 * clearly-foreign origins are rejected. Both the apex (`myballet.co.kr`) and `www`
 * host, plus any `*.myballet.co.kr` subdomain, are trusted.
 *
 * NOTE: this trusts myballet hosts only. If BASE_URL / WEBVIEW_ALLOWED_HOSTS are
 * ever pointed at another production domain, update this allowlist in lockstep.
 */
export function isTrustedMessageOrigin(url?: string): boolean {
  if (__DEV__) return true;
  if (!url) return true;
  try {
    const host = new URL(url).hostname.trim().toLowerCase().replace(/\.$/, '');
    return host === 'myballet.co.kr' || host.endsWith('.myballet.co.kr');
  } catch {
    return true;
  }
}
