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
 * FCM token registration endpoint (web API).
 * POST with Body: { fcm_token: string }, Headers: Authorization: Bearer <Supabase access_token>
 */
export const FCM_TOKEN_API_PATH = '/api/profile/fcm-token';

/**
 * Full URL for FCM token registration (same origin as web).
 */
export const FCM_TOKEN_API_URL = `${BASE_WEB_URL}${FCM_TOKEN_API_PATH}`;

/**
 * Allowed origin for WebView (same domain only in WebView; others open externally).
 */
export const WEBVIEW_ORIGIN = BASE_WEB_URL;
