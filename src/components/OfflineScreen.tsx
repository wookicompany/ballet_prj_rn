import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

// 스플래시와 동일한 고양이 이미지 — 스플래시에서 자연스럽게 이어지도록.
const SPLASH_CAT = require('../../assets/splash-icon-ios.png');

interface OfflineScreenProps {
  onRetry: () => void;
}

/**
 * 네트워크 연결 실패 시 흰 화면 대신 보여주는 화면.
 * 스플래시 고양이를 그대로 유지해 "고장"이 아니라 "연결 대기"로 인식되게 하고,
 * 연결 복구 시 부모가 자동 reload 하며, 수동 재시도 버튼도 제공한다.
 */
export function OfflineScreen({ onRetry }: OfflineScreenProps) {
  const [retrying, setRetrying] = useState(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRetry = useCallback(() => {
    if (retrying) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setRetrying(true);
    onRetry();
    // 재시도가 또 실패해 화면이 유지되는 경우 버튼을 원상 복구.
    // 성공하면 이 컴포넌트가 언마운트되므로 타이머는 무의미해진다.
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(() => setRetrying(false), 2500);
  }, [onRetry, retrying]);

  return (
    <View style={styles.container}>
      <Image source={SPLASH_CAT} style={styles.cat} resizeMode="contain" />

      <Text style={styles.title}>인터넷 연결을 확인해주세요</Text>
      <Text style={styles.subtitle}>연결되면 자동으로 이어져요</Text>

      <Pressable
        style={styles.retryButton}
        onPress={handleRetry}
        disabled={retrying}
        accessibilityRole="button"
        accessibilityLabel="다시 시도"
        accessibilityState={{ disabled: retrying }}
      >
        {retrying ? (
          <View style={styles.retryingContent}>
            <ActivityIndicator size="small" color="#ffffff" />
            <Text style={styles.retryText}>연결 중이에요…</Text>
          </View>
        ) : (
          <Text style={styles.retryText}>다시 시도</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff', // 스플래시 배경과 동일 → 이음새 없음
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 500,
  },
  cat: {
    width: 200,
    height: 200,
    marginBottom: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#17171c',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: 'rgba(23, 23, 28, 0.6)',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    minWidth: 140,
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#E8517C', // 브랜드 컬러 (이 버튼에만 최소 사용)
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  retryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
});
