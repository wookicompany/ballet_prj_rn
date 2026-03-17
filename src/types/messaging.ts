/**
 * Web → RN postMessage payload types.
 * Web sends JSON.stringify(payload) via window.ReactNativeWebView?.postMessage(...)
 */
export type HealthSyncErrorCode = 'NO_PERMISSION' | 'NO_DATA' | 'TIMEOUT' | 'QUERY_FAILED';

export interface HealthSyncWorkoutPayload {
  activity: 'barre';
  activity_label: string | null;
  source_name: string | null;
  device_name: string | null;
  total_energy_kcal: number | null;
  avg_bpm: number | null;
  max_bpm: number | null;
  active_energy_kcal: number | null;
}

export interface HealthSyncRequestPayload {
  type: 'health_sync_request';
  version: 1;
  request_id: string;
  date: string;
  activity: 'barre';
}

export interface PlatformInfoPayload {
  type: 'platform_info';
  version: 1;
  platform: 'ios' | 'android';
  health_provider: 'healthkit' | 'health_connect' | 'none';
}

export interface HealthSyncResultSuccessPayload {
  type: 'health_sync_result';
  version: 1;
  request_id: string;
  status: 'success';
  workout: HealthSyncWorkoutPayload;
}

export interface HealthSyncResultErrorPayload {
  type: 'health_sync_result';
  version: 1;
  request_id: string;
  status: 'error';
  code: HealthSyncErrorCode;
  message: string;
}

export type WebToRNMessage =
  | { type: 'haptic' }
  | { type: 'auth_token'; access_token: string }
  | { type: 'open_address_search' }
  | { type: 'logout'; version: 1 }
  | { type: 'account_deleted'; version: 1 }
  | HealthSyncRequestPayload;

export type RNToWebMessage = PlatformInfoPayload | HealthSyncResultSuccessPayload | HealthSyncResultErrorPayload;

function isIsoDateString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

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

    if (parsed.type === 'health_sync_request') {
      const version = 'version' in parsed ? parsed.version : undefined;
      const requestId = 'request_id' in parsed ? parsed.request_id : undefined;
      const date = 'date' in parsed ? parsed.date : undefined;
      const activity = 'activity' in parsed ? parsed.activity : undefined;
      if (version === 1 && typeof requestId === 'string' && requestId.trim().length > 0 && isIsoDateString(date) && activity === 'barre') {
        return {
          type: 'health_sync_request',
          version: 1,
          request_id: requestId.trim(),
          date,
          activity: 'barre',
        };
      }
      console.warn('[WebViewMessage] Ignored health_sync_request: invalid payload', parsed);
      return null;
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
