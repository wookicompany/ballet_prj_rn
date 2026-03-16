import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { parseWebMessage } from '../types/messaging';
import type { HealthSyncRequestPayload } from '../types/messaging';

interface UseWebViewMessageOptions {
  onAuthToken?: (accessToken: string) => void;
  onOpenAddressSearch?: () => void;
  onSessionTerminated?: (eventType: 'logout' | 'account_deleted') => void;
  onHealthSyncRequest?: (payload: HealthSyncRequestPayload) => void;
}

export function useWebViewMessage({
  onAuthToken,
  onOpenAddressSearch,
  onSessionTerminated,
  onHealthSyncRequest,
}: UseWebViewMessageOptions = {}) {
  const handleMessage = useCallback((event: { nativeEvent: { data: string } }) => {
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

    if (payload.type === 'open_address_search') {
      onOpenAddressSearch?.();
      return;
    }

    if (payload.type === 'logout' || payload.type === 'account_deleted') {
      onSessionTerminated?.(payload.type);
      return;
    }

    if (payload.type === 'health_sync_request') {
      onHealthSyncRequest?.(payload);
    }
  }, [onAuthToken, onOpenAddressSearch, onSessionTerminated, onHealthSyncRequest]);

  return handleMessage;
}
