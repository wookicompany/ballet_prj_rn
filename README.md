# 마이발레 (ballet_prj_rn)

**마이발레**의 iOS·Android 앱. 마이발레 웹 서비스를 **WebView로 감싸고, 웹이 할 수 없는 네이티브 기능만 브릿지로 붙인 Expo 기반 React Native 셸 앱**이에요.

---

## 주요 기능

- **WebView 셸**: 마이발레 웹을 앱 안에서 로드. 외부 도메인/OAuth는 정책에 따라 인앱 또는 외부 브라우저로 분기
- **HealthKit 연동** (iOS 전용): Apple Watch 발레 바(barre) 운동 데이터 조회 → 웹에 전달
- **푸시 알림**: Expo Push 토큰 등록, 포그라운드 알림 배너 + 딥링크 이동
- **햅틱 피드백**: 웹 상호작용 시 네이티브 햅틱
- **오프라인 대응**: 네트워크 없을 때 흰 화면 대신 안내 화면 + 연결 복구 시 자동 재시도 *(1.7.0 예정)*
- **외부 URL 처리**: 웹이 넘긴 URL을 `expo-web-browser`로 인앱 브라우저 열기

---

## 기술 스택

| 영역 | 사용 |
|---|---|
| 런타임 | Expo SDK 54 / React Native 0.81 |
| WebView | `react-native-webview` |
| 알림 | `expo-notifications` |
| 헬스 | `@kingstinct/react-native-healthkit` (iOS) |
| 네트워크 감지 | `@react-native-community/netinfo` |
| 모니터링 | `@sentry/react-native` |
| 빌드/배포 | EAS Build / EAS Submit |

---

## 프로젝트 구조

```
App.tsx                     엔트리. 스플래시 제어 + 네비게이션
src/
  screens/                  화면 (WebViewScreen 등)
  components/               공용 컴포넌트 (MyBalletWebView, NotificationBanner, OfflineScreen…)
  hooks/                    훅 (useWebViewMessage, useExpoPushToken, useWebViewUrl…)
  services/                 외부 연동 (healthSync, expoPush…)
  constants/                설정·상수 (config.ts)
  types/                    타입 (messaging.ts — 브릿지 메시지 스키마)
  navigation/               딥링크 (linking.ts)
docs/                       스펙·가이드 문서
```

진입 흐름: `App.tsx` → `src/screens/WebViewScreen.tsx` → `src/components/MyBalletWebView.tsx`

---

## 웹 ↔ RN 브릿지 (핵심)

웹과 앱은 `postMessage`로 통신해요. **모든 메시지는 `version: 1` 규약 + 타입 검증**을 따르고, 파싱/검증은 [`src/types/messaging.ts`](src/types/messaging.ts)의 `parseWebMessage()`, 디스패치는 [`src/hooks/useWebViewMessage.ts`](src/hooks/useWebViewMessage.ts)에서 일원화해요.

| 방향 | 메시지 타입 |
|---|---|
| **Web → RN** | `haptic`, `auth_token`, `logout`, `account_deleted`, `open_url`, `health_sync_request` |
| **RN → Web** | `platform_info`, `health_sync_result` |

> 브릿지 메시지는 오리진 검증 게이트(프로덕션 한정)로 보호돼요. 신규 기능은 **`messaging.ts`의 타입·검증부터 정의**하고 웹/앱 양측을 맞춰요.

자세한 계약은 [`docs/rn_webview_integration.md`](docs/rn_webview_integration.md) 참조.

---

## 시작하기

### ⚠️ Expo Go로는 실행 불가
네이티브 모듈(HealthKit, 알림 등)이 있어 **Expo Go에서는 안 돌아가요.** **개발 빌드(Dev Build)**가 필요해요.

### 설치
```bash
npm install
```

### 개발 빌드 실행
```bash
# 로컬 네이티브 빌드 (Xcode/Android SDK 필요)
npx expo run:ios
npx expo run:android

# 또는 EAS 개발 빌드
eas build --profile development --platform ios   # 또는 android
```

### 개발 서버
```bash
npx expo start          # 개발 빌드 설치된 기기/시뮬레이터에서 접속
```

### 검증
```bash
npx tsc --noEmit        # 타입 체크 (0 오류 유지)
npx expo-doctor         # 설정 정합성
```

---

## 빌드 · 배포

EAS로 빌드/제출해요. 프로필은 [`eas.json`](eas.json) 참조 (`production`은 빌드번호 자동 증가).

```bash
# 프로덕션 빌드
eas build --profile production --platform all

# 스토어 제출
eas submit --profile production --platform ios       # → App Store Connect(TestFlight)
eas submit --profile production --platform android   # → Google Play (internal 트랙)
```

- **iOS**: `eas submit`은 TestFlight까지. 공개 출시는 App Store Connect에서 버전 생성 후 심사 제출
- **Android**: 프로덕션 공개는 Play Console에서 internal → production **승급**
- 아이콘·스플래시는 **네이티브 빌드에 구워져요.** 변경 후 반드시 **새 빌드 + 삭제 후 재설치**로 검증 (OTA·업데이트로는 캐싱 착시 발생)

---

## 문서

| 문서 | 내용 |
|---|---|
| [`docs/spec.md`](docs/spec.md) | 기술 스택·의사결정 |
| [`docs/rn_webview_integration.md`](docs/rn_webview_integration.md) | RN↔웹 연동 요구사항 |
| [`docs/rn_webview_integration_plan.md`](docs/rn_webview_integration_plan.md) | 웹 선행 구현 플랜 |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | 디자인 토큰·컴포넌트 규칙 |
| [`docs/AGENTS.md`](docs/AGENTS.md) | 에이전트 작업 규칙 |

---

## 참고

- PM/디자이너/엔지니어 3역할 서브에이전트로 스펙 → 디자인 → 구현을 나눠 작업합니다. 정의는 [`.claude/agents/`](.claude/agents/)를 참고하세요.
