import { FCM_TOKEN_API_URL } from '../constants/config';

/**
 * Register FCM device token with web API.
 * POST /api/profile/fcm-token
 * Headers: Authorization: Bearer <Supabase access_token>
 * Body: { fcm_token: "<FCM device token>" }
 */
export async function registerFcmToken(accessToken: string, fcmToken: string): Promise<void> {
  const res = await fetch(FCM_TOKEN_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ fcm_token: fcmToken }),
  });
  if (!res.ok) {
    throw new Error(`FCM token registration failed: ${res.status}`);
  }
}
