import React from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';

// 네이티브 스플래시와 완전히 동일한 에셋/크기를 쓴다(app.json의 expo-splash-screen 설정과 일치).
// iOS: splash-icon-ios.png / imageWidth 240, Android: splash-icon.png / imageWidth 220, 배경 #ffffff, contain.
const SPLASH_CAT = Platform.OS === 'android'
  ? require('../../assets/splash-icon.png')
  : require('../../assets/splash-icon-ios.png');
const CAT_SIZE = Platform.OS === 'android' ? 220 : 240;

/**
 * 초기 웹 로드가 아직 끝나지 않은 상태(느린 로딩/응답 지연, onError는 아직 없음)에서
 * 흰 화면 대신 보여주는 로딩 화면.
 *
 * 네이티브 스플래시와 시각적으로 동일해서, (2초 또는 8초 폴백에) 네이티브 스플래시가
 * 걷히는 순간에도 흰 틈 없이 매끄럽게 이어진다. "느린 로딩"과 "연결 실패(OfflineScreen)"를
 * 명확히 구분하기 위해 문구·재시도 버튼은 두지 않는다(스플래시가 계속 떠 있는 듯한 인상).
 */
export function LoadingScreen() {
  return (
    <View style={styles.container}>
      <Image source={SPLASH_CAT} style={styles.cat} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff', // 스플래시 배경과 동일 → 이음새 없음
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 500,
  },
  cat: {
    width: CAT_SIZE,
    height: CAT_SIZE,
  },
});
