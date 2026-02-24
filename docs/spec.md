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
| 주소검색 | **@actbase/react-daum-postcode** | RN 모달에서 주소검색 후 WebView 브릿지로 결과 전달. |

**정리:** Expo 워크플로우 유지 시 FCM은 expo-notifications, 햅틱은 expo-haptics.

---

### 1. React Native 프로젝트 생성 방식

**결정: Expo**

- 설정이 단순하고 EAS 빌드 사용 가능.
- config plugin으로 iOS/Android(ATS, cleartext 등) 설정.
- `expo-dev-client`로 네이티브 모듈(WebView, 알림 등) 사용.

### 2. Expo Push 토큰 등록 시 RN → 웹 API 인증

**결정: POST /api/profile/expo-push-token + Bearer(Supabase access_token)**

- 웹에는 **POST /api/profile/expo-push-token** 엔드포인트를 사용함.
- **URL:** `POST /api/profile/expo-push-token`
- **Headers:** `Authorization: Bearer <Supabase access_token>`
- **Body:** `{ "expo_push_token": "ExponentPushToken[...]" }`
- RN: 로그인 이후 유효한 `access_token`을 확보해 위 스펙으로 호출.
- 웹 배포 기준 postMessage는 `type: 'haptic'`, `type: 'auth_token'`, `type: 'open_address_search'`를 사용한다.
- RN은 `auth_token` 수신 시 Expo Push 토큰 등록 호출 흐름에 사용한다.

### 3. 딥링크 앱 스킴

**결정: `myballet://`**

- 예: `myballet://open?url=https://www.myballet.co.kr/performance/123/reviews/456`
- 또는 경로 기반: `myballet://performance/123` (구현 시 스킴·경로 규칙 확정 후 `src/navigation/linking.ts`에 반영).

---

## RN 구현 요약 (연동 가이드 반영)

| 요구사항 | 확정 사항 |
|----------|-----------|
| URL / 진입 | 기본 `https://www.myballet.co.kr/calendar`, 푸시·딥링크 시 payload `link` 로드 |
| 로그인 | WebView 내 OAuth, RN 토큰 전달 불필요 |
| 백 버튼 | WebView `goBack()` 우선, 없으면 앱 네비 |
| 외부 링크 | OAuth 허용 도메인(`myballet`, `supabase`, `kakao`, `apple`)은 WebView 유지, Google OAuth(`accounts.google.com`)는 정책상 외부 브라우저로 처리, 그 외·tel·mailto는 브라우저/앱 |
| postMessage | 웹→RN `type: 'haptic'`, `type: 'auth_token'`, `type: 'open_address_search'` 수신 처리 |
| 푸시 | expo-notifications, 알림 탭 시 `data.link` 로 WebView URL 변경 |
| 딥링크 | 스킴 **myballet://** |

---

## 4. 주소검색 브릿지 (RN WebView)

**결정: WebView 브릿지 + RN 주소검색 모달**

- 웹에서 `open_address_search` 메시지 수신 시 RN이 네이티브 주소검색 모달을 연다.
- 주소 선택 시 RN이 `address_selected`를 `postMessage`로 웹에 전달한다.
- 1차 반환 필드는 `address`, `roadAddress`, `jibunAddress`만 사용한다.
- 취소/파싱 실패는 no-op 처리한다.

---

## 다음 단계

- Google 외부 브라우저 로그인 후 앱 복귀를 위해 OAuth redirect URL에 앱 스킴(`myballet://...`) 연동을 확정한다.
- 주소검색 브릿지 2차 확장 필요 시 `zonecode` 등 추가 필드 전달을 검토한다.
