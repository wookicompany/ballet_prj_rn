# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**마이발레** iOS/Android 앱 — Expo 기반 React Native **WebView 셸**. 마이발레 웹 서비스를 WebView로 감싸고, 웹이 못 하는 네이티브 기능(HealthKit, 푸시, 햅틱)만 **postMessage 브릿지**로 붙인다. **자체 화면 UI는 거의 없다** — 대부분의 화면·로직은 웹이 담당하고, 앱은 능력을 제공하는 껍데기다. 새 기능은 대부분 "네이티브 능력 + 브릿지 메시지" 형태로 추가된다.

## Commands

```bash
npm install

# 실행 — Expo Go로는 안 됨(HealthKit/알림 등 네이티브 모듈). 개발 빌드 필수.
npx expo run:ios          # 로컬 네이티브 빌드 후 실행 (Xcode 필요)
npx expo run:android
npx expo start            # 개발 빌드가 설치된 기기에서 접속

npx tsc --noEmit          # 타입 체크 — 0 오류 유지 (변경 후 필수)
npx expo-doctor           # 설정/의존성 정합성

# 빌드/배포 (EAS). production 프로필은 빌드번호 자동 증가.
# iOS 빌드엔 EXPO_NO_CAPABILITY_SYNC=1 을 권장(안전장치): capability sync가
# App ID 변경을 시도할 때 간헐적으로 에러 나서 빌드 실패할 수 있음. App ID가
# 이미 app.json과 맞으면 없이도 성공한다. 단, 새 native capability를 추가할 땐
# 이 옵션 없이 한 번 sync가 돌아야 포털에 반영된다.
EXPO_NO_CAPABILITY_SYNC=1 eas build --profile production --platform all
eas submit --profile production --platform ios      # → TestFlight
eas submit --profile production --platform android  # → Google Play internal 트랙
```

테스트/린트 프레임워크는 없다. 검증 = `tsc --noEmit` + `expo-doctor` + 실기기 스모크.

## Architecture

**진입 흐름**: `App.tsx` → `src/screens/WebViewScreen.tsx` → `src/components/MyBalletWebView.tsx`

- **App.tsx** — Sentry 초기화, 네비게이션, **스플래시 제어**. `SplashScreen.preventAutoHideAsync()`로 스플래시를 붙잡고, `(최소 2초 경과 AND WebView 준비[onLoadEnd])` 또는 `8초 폴백(MAX_SPLASH_MS)`이면 `hideAsync()`. WebView 준비 신호는 `onInitialWebViewReady` 콜백.
- **WebViewScreen.tsx** — 오케스트레이터. 브릿지 핸들러 연결, 푸시 등록, 알림 배너/딥링크, **오프라인 처리**(아래).
- **MyBalletWebView.tsx** — 실제 WebView. **라우팅 정책**의 소유자: `isAllowedInWebView`/`isForceExternalUrl`로 인앱 로드 vs 외부 브라우저(`expo-web-browser`) 분기. 브릿지 가드 스크립트 주입.

### 웹↔RN 브릿지 (가장 중요)

웹과 앱은 `postMessage`로 통신한다. **모든 메시지는 `version: 1` + 타입 검증 규약.**
- **파싱/검증**: `src/types/messaging.ts`의 `parseWebMessage()` — 신뢰할 수 있는 스키마만 통과
- **디스패치**: `src/hooks/useWebViewMessage.ts` — 타입별 핸들러로 분기
- Web→RN: `haptic` `auth_token` `logout` `account_deleted` `open_url` `health_sync_request`
- RN→Web: `platform_info` `health_sync_result`
- **신규 브릿지 기능은 `messaging.ts`의 타입·검증부터 정의하고 웹/앱 양측을 맞춘다.**

### 오리진 신뢰 게이트

`src/constants/config.ts`의 `isTrustedMessageOrigin()` — WebView는 OAuth 제공자 페이지에도 브릿지를 주입하므로, myballet 오리진 메시지만 신뢰한다. **프로덕션에서만 적용**(`__DEV__`이면 무조건 통과 — 프리뷰/localhost QA에서 브릿지가 조용히 막히는 것 방지). **fail-open**(URL 없거나 파싱 실패 시 통과).

### 네이티브 기능은 훅/서비스로 분리

화면에 플랫폼 코드를 흩뿌리지 않는다. 푸시(`src/hooks/useExpoPushToken.ts` + `src/services/expoPush.ts`), HealthKit(`src/services/healthSync.ios.ts`, iOS 전용), 딥링크(`src/navigation/linking.ts`).

### 오프라인 처리

WebViewScreen이 `onError`로 `loadFailed`를 추적 → `src/components/OfflineScreen.tsx`(스플래시와 같은 고양이 + 안내 + 재시도) 표시. `@react-native-community/netinfo`로 연결 복구 감지 시 자동 `reload()`. 로드 성공(`onLoad`)해야만 해제되어 깜빡임 없이 웹으로 전환.

## Conventions

- **회귀 금지(최우선)**: 기존 동작은 예외 없이 보존. 변경은 순수 추가(additive) 또는 동작 등가 우선. 브릿지에 게이트/필터를 넣을 땐 **fail-open**.
- **Expo 호환성**: 네이티브 라이브러리 추가 시 Expo(Dev Build) 호환성 먼저 확인. 런타임은 Expo SDK 기준 유지.
- **아이콘/알림 도구**: `lucide-react-native`만 사용(화면마다 혼용 금지). 폰트 Pretendard, 톤은 다정한 어요체.
- **디자인 토큰**: `docs/DESIGN_SYSTEM.md`가 소스. 브랜드 `#E8517C`(최소 사용), 알림색 `#FF154A`(브랜드와 분리), 베이스 다크 `#17171c`. 하드코딩 금지.
- **브랜치**: `develop`이 작업 브랜치, `main`이 릴리스. 세션 관례상 ff-merge로 둘을 동기화해 유지한다.

## Deploy 주의점

- **iOS**: `eas submit`은 TestFlight까지만. 공개 출시는 App Store Connect에서 버전 생성 후 심사 제출(수동).
- **Android**: 프로덕션 공개는 Play Console에서 internal → production **승급**(같은 versionCode 재업로드 불가).
- **아이콘·스플래시는 네이티브 빌드에 구워진다.** 변경 검증은 반드시 **앱 삭제 후 재설치**(OTA·업데이트로는 iOS 런치스크린 캐싱 착시 발생 — 겹쳐 보임).

## 관련 문서

`docs/AGENTS.md`(작업 규칙), `docs/DESIGN_SYSTEM.md`(디자인), `docs/rn_webview_integration.md`(브릿지 계약), `docs/spec.md`(기술 결정). 서브에이전트 정의는 `.claude/agents/`(PM/디자이너/엔지니어).
