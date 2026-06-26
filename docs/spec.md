# RN WebView 프로젝트 — 스펙 및 의사결정

`rn_webview_integration.md`, `rn_webview_integration_plan.md` 및 플랜 기준으로 확정한 항목이다.

---

## 문서 참조

| 문서 | 용도 |
|------|------|
| [rn_webview_integration.md](rn_webview_integration.md) | RN↔웹 연동 요구사항(URL, OAuth, 백버튼, 외부 링크, postMessage, Expo Push) |
| [rn_webview_integration_plan.md](rn_webview_integration_plan.md) | 웹 쪽 선행 구현(햅틱 postMessage, Expo Push 토큰·API·푸시 payload) |

---

## 기술 스택 및 선택 사항

| 항목 | 선택 | 이유 |
|------|------|------|
| RN 생성 방식 | Expo (SDK 54) | 설정 단순, EAS 빌드, config plugin으로 iOS/Android 설정. |
| WebView | **react-native-webview** | 연동 가이드 명시. Expo에서 지원. |
| Expo Push / 푸시 | **expo-notifications** | Expo와 잘 맞고, Bare/이젝트 불필요. 푸시 토큰·수신·탭 시 URL 처리 가능. |
| 햅틱 | **expo-haptics** | Expo SDK 포함, 추가 네이티브 설정 없음. 웹 `type: 'haptic'` 수신 시 호출. |
| 인앱 브라우저 | **expo-web-browser** | 웹 `type: 'open_url'` 수신 시 호출. iOS SFSafariViewController / Android Chrome Custom Tabs. |
| 주소검색 | **웹(Kakao Postcode embed)** | 주소검색은 웹 레이어에서 직접 처리하고 RN 브릿지는 사용하지 않음. |

**정리:** Expo 워크플로우 유지 시 푸시는 expo-notifications, 햅틱은 expo-haptics, 인앱 브라우저는 expo-web-browser.

---

### 1. React Native 프로젝트 생성 방식

**결정: Expo**

- 설정이 단순하고 EAS 빌드 사용 가능.
- config plugin으로 iOS/Android(ATS, cleartext 등) 설정.
- WebView/알림 등 네이티브 모듈은 Expo SDK 호환 범위에서 사용하며, 필요 시 Dev Build(`expo-dev-client`)를 활용한다.

### 2. Expo Push 토큰 등록 시 RN → 웹 API 인증

**결정: POST /api/profile/expo-push-token + Bearer(Supabase access_token)**

- 웹에는 **POST /api/profile/expo-push-token** 엔드포인트를 사용함.
- **URL:** `POST /api/profile/expo-push-token`
- **Headers:** `Authorization: Bearer <Supabase access_token>`
- **Body:** `{ "expo_push_token": "ExponentPushToken[...]" }`
- RN: 로그인 이후 유효한 `access_token`을 확보해 위 스펙으로 호출.
- 웹 배포 기준 postMessage는 `type: 'haptic'`, `type: 'auth_token'`를 사용한다.
- RN은 `auth_token` 수신 시 Expo Push 토큰 등록 호출 흐름에 사용한다.

### 3. 딥링크 앱 스킴

**결정: `myballet://`**

- 지원 패턴 (`src/navigation/linking.ts` 구현 완료):
  - `myballet://open?url=<encoded_full_url>` — 절대/상대 URL 디코딩 후 WebView 로드
  - `myballet://<path>` — `https://www.myballet.co.kr` + path로 변환 후 WebView 로드
- 예: `myballet://open?url=https%3A%2F%2Fwww.myballet.co.kr%2Fperformance%2F123%2Freviews%2F456`

---

## RN 구현 요약 (연동 가이드 반영)

| 요구사항 | 확정 사항 |
|----------|-----------|
| URL / 진입 | 기본 `https://www.myballet.co.kr/calendar`, 푸시·딥링크 시 payload `link` 로드 |
| 로그인 | WebView 내 OAuth, RN 토큰 전달 불필요 |
| 백 버튼 | WebView `goBack()` 우선, 없으면 앱 네비 |
| 외부 링크 | OAuth 허용 도메인(`myballet`, `supabase`, `kakao`, `apple`)은 WebView 유지, Google OAuth(`accounts.google.com`)는 정책상 외부 브라우저로 처리, 그 외·tel·mailto는 브라우저/앱 |
| postMessage | 웹→RN `haptic`, `auth_token`, `logout`, `account_deleted`, `health_sync_request`, `open_url` 수신 처리 |
| 푸시 | expo-notifications, 알림 탭 시 `data.link` 로 WebView URL 변경 |
| 딥링크 | 스킴 **myballet://** |

---

## 4. 주소검색 정책

**결정: 웹 단독 구현**

- 주소검색은 웹에서 Kakao Postcode(임베드/레이어)로 직접 처리한다.
- RN은 주소검색 전용 브릿지(`open_address_search`, `address_selected`)를 사용하지 않는다.

---

## 다음 단계

- Google 외부 브라우저 로그인 후 앱 복귀: RN 딥링크 파싱(`src/navigation/linking.ts`)은 구현 완료. Google OAuth 콘솔에서 `myballet://` redirect URI 등록 및 웹 auth callback 연동 여부 확인 필요.
- 주소검색 세부 UX/필드 확장은 웹 저장소에서 관리한다.

---

## 5. Apple Watch 연동 (iOS 전용)

### 5.1 범위/환경

- 지원 범위는 **iOS WebView + HealthKit** 전용으로 고정한다.
- HealthKit 라이브러리는 `@kingstinct/react-native-healthkit`를 사용한다.
- Expo Go에서는 동작하지 않으므로 `expo-dev-client` 기반 Dev Build로 검증한다.

### 5.2 브릿지 계약 (고정)

- 앱 로드 완료 시 1회 전송:
  - iOS: `{ "type": "platform_info", "version": 1, "platform": "ios", "health_provider": "healthkit" }`
  - Android: `{ "type": "platform_info", "version": 1, "platform": "android", "health_provider": "none" }`
- 웹 요청:
  - `{ "type": "health_sync_request", "version": 1, "request_id": "<id>", "date": "YYYY-MM-DD", "activity": "barre" }`
- 앱 응답:
  - `type: "health_sync_result"`, `version: 1`, `request_id`, `status`
  - `status: "success"`일 때 `workout` 데이터 반환
  - `status: "error"`일 때 `code`, `message` 반환

### 5.3 데이터/에러 정책

- 조회 정책: `barre`, KST 하루 범위, 최신 1건
- 응답 키(고정, nullable):
  - `activity_label`, `source_name`, `device_name`, `total_energy_kcal`, `avg_bpm`, `max_bpm`
- 칼로리 필드 운영:
  - `total_energy_kcal`(총 칼로리)와 `active_energy_kcal`(활동 칼로리)를 함께 계속 제공
- 에러코드:
  - `NO_PERMISSION`, `NO_DATA`, `TIMEOUT`, `QUERY_FAILED`
  - 데이터 없음은 반드시 `{ "status": "error", "code": "NO_DATA" }`
