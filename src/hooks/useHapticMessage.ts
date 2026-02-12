import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { parseWebMessage } from '../types/messaging';

export function useHapticMessage() {
  const handleMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    const payload = parseWebMessage(event.nativeEvent.data);
    if (payload?.type === 'haptic') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  return handleMessage;
}
