import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { isTrustedMessageOrigin } from '../constants/config';
import { parseWebMessage } from '../types/messaging';
import type { HealthSyncRequestPayload } from '../types/messaging';

interface UseWebViewMessageOptions {
  onAuthToken?: (accessToken: string) => void;
  onSessionTerminated?: (eventType: 'logout' | 'account_deleted') => void;
  onHealthSyncRequest?: (payload: HealthSyncRequestPayload) => void;
  onOpenUrl?: (url: string) => void;
}

export function useWebViewMessage({
  onAuthToken,
  onSessionTerminated,
  onHealthSyncRequest,
  onOpenUrl,
}: UseWebViewMessageOptions = {}) {
  const handleMessage = useCallback((event: { nativeEvent: { data: string; url?: string } }) => {
    if (!isTrustedMessageOrigin(event.nativeEvent.url)) {
      console.warn('[WebViewMessage] Ignored message: untrusted origin', event.nativeEvent.url);
      return;
    }

    const payload = parseWebMessage(event.nativeEvent.data);
    if (!payload) return;

    if (payload.type === 'haptic') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return;
    }

    if (payload.type === 'auth_token') {
      onAuthToken?.(payload.access_token);
      return;
    }

    if (payload.type === 'logout' || payload.type === 'account_deleted') {
      onSessionTerminated?.(payload.type);
      return;
    }

    if (payload.type === 'health_sync_request') {
      onHealthSyncRequest?.(payload);
      return;
    }

    if (payload.type === 'open_url') {
      onOpenUrl?.(payload.url);
    }
  }, [onAuthToken, onSessionTerminated, onHealthSyncRequest, onOpenUrl]);

  return handleMessage;
}
