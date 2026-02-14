import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { parseWebMessage } from '../types/messaging';

interface UseWebViewMessageOptions {
  onAuthToken?: (accessToken: string) => void;
  onOpenAddressSearch?: () => void;
}

export function useWebViewMessage({ onAuthToken, onOpenAddressSearch }: UseWebViewMessageOptions = {}) {
  const handleMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    const payload = parseWebMessage(event.nativeEvent.data);
    if (!payload) return;

    if (payload.type === 'haptic') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }

    if (payload.type === 'auth_token') {
      onAuthToken?.(payload.access_token);
      return;
    }

    if (payload.type === 'open_address_search') {
      onOpenAddressSearch?.();
    }
  }, [onAuthToken, onOpenAddressSearch]);

  return handleMessage;
}
