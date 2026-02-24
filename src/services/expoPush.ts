import { EXPO_PUSH_TOKEN_API_URL } from '../constants/config';

/**
 * Register Expo push token with web API.
 * POST /api/profile/expo-push-token
 * Headers: Authorization: Bearer <Supabase access_token>
 * Body: { expo_push_token: "<Expo push token>" }
 */
export async function registerExpoPushToken(accessToken: string, expoPushToken: string): Promise<void> {
  const res = await fetch(EXPO_PUSH_TOKEN_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ expo_push_token: expoPushToken }),
  });
  if (!res.ok) {
    throw new Error(`Expo push token registration failed: ${res.status}`);
  }
}
