import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { parseWebMessage } from '../types/messaging';

interface UseHapticMessageOptions {
  onAuthToken?: (accessToken: string) => void;
}

export function useHapticMessage({ onAuthToken }: UseHapticMessageOptions = {}) {
  const handleMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    const payload = parseWebMessage(event.nativeEvent.data);
    if (!payload) return;

    if (payload.type === 'haptic') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }

    if (payload.type === 'auth_token') {
      onAuthToken?.(payload.access_token);
    }
  }, [onAuthToken]);

  return handleMessage;
}
