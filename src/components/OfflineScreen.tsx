import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

// 스플래시와 동일한 고양이 이미지 — 스플래시에서 자연스럽게 이어지도록.
const SPLASH_CAT = require('../../assets/splash-icon-ios.png');

/**
 * 네트워크 연결 실패 시 흰 화면 대신 보여주는 화면.
 * 스플래시 고양이를 그대로 유지해 "고장"이 아니라 "연결 대기"로 인식되게 하고,
 * 연결 복구 시 부모(WebViewScreen)가 NetInfo로 자동 reload 한다. (수동 재시도 버튼 없음)
 */
export function OfflineScreen() {
  return (
    <View style={styles.container}>
      <Image source={SPLASH_CAT} style={styles.cat} resizeMode="contain" />

      <Text style={styles.title}>인터넷 연결을 확인해주세요</Text>
      <Text style={styles.subtitle}>연결되면 자동으로 이어져요</Text>
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
});
