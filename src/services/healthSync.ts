import type {
  HealthSyncRequestPayload,
  HealthSyncResultErrorPayload,
} from '../types/messaging';

export async function requestHealthSync(
  request: HealthSyncRequestPayload,
): Promise<HealthSyncResultErrorPayload> {
  return {
    type: 'health_sync_result',
    version: 1,
    request_id: request.request_id,
    status: 'error',
    code: 'NO_PERMISSION',
    message: 'iOS(Apple Watch)에서만 연동 가능해요.',
  };
}
