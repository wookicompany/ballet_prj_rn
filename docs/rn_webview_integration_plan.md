# RN WebView 연동 — 웹 쪽 선행 구현 계획

`docs/rn_webview_integration.md` 기준으로, **웹(마이발레)에서 먼저 구현할 수 있는 부분**을 정리한 계획이다. RN 개발자 전달 전에 웹에서 완료할 작업이다.

---

## 개요

| 구분 | 담당 | 웹에서 선행 구현 여부 |
|------|------|------------------------|
| 로그인(OAuth WebView 내) | 웹 이미 구현됨 | ✅ 변경 없음 |
| 진입 경로 / 외부 링크 | RN | ❌ 웹 작업 없음 |
| **햅틱 postMessage** | 웹 → RN | ✅ **웹: postMessage 호출 추가** |
| **알림 배너(Expo Push)** | 마이발레 Vercel API + Expo Push API | ✅ **웹: 토큰 저장·API에서 Expo Push 호출** |

---

## 1. 햅틱용 postMessage (웹)

**목표:** 버튼·스위치 등 액션 시 WebView 환경이면 `window.ReactNativeWebView.postMessage({ type: 'haptic' })` 호출.

### 1.1 유틸 추가

- **파일:** `lib/reactNativeWebView.ts` (또는 `lib/hapticWebView.ts`)
- **내용:**
  - `isInReactNativeWebView(): boolean` — `window.ReactNativeWebView != null` 또는 User-Agent 등으로 WebView 환경 판별.
  - `sendHapticToApp(): void` — WebView일 때만 `window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'haptic' }))` 호출. (optional chaining으로 브라우저에서 호출해도 에러 없음.)
- **의존성:** 없음 (브라우저/WebView 전역만 사용).

### 1.2 UI 컴포넌트에 연동

- **Button** (`components/ui/button.tsx`)
  - `onClick` 시 (또는 클릭 핸들러 내) `sendHapticToApp()` 호출.  
  - 또는 Button을 감싸는 wrapper에서 클릭 시 호출.  
  - 기존 동작 유지, WebView가 아니면 no-op.
- **Switch** (`components/ui/switch.tsx`)
  - `onCheckedChange`(또는 동일한 변경 시점) 시 `sendHapticToApp()` 호출.
- **선택:** 공통 클릭/터치를 쓰는 다른 액션 컴포넌트(예: TabBar 아이콘, FloatingButton, 바텀시트 확인 버튼 등)가 있으면 동일하게 호출 검토.

### 1.3 검증

- 브라우저에서만 접속 시: `ReactNativeWebView` 없음 → 호출해도 에러 없이 무시되는지 확인.
- RN WebView에서 로드 시: RN 앱에서 `onMessage`로 `type: 'haptic'` 수신되는지 확인 (RN 구현 후).

---

## 2. 알림 배너 — 마이발레 Vercel API에서 Expo Push 호출

**목표:** 댓글/리뷰 좋아요/댓글 좋아요 발생 시, 알림 받을 사용자의 `expo_push_token`으로 Expo Push 발송. 푸시 payload의 `data.link`는 절대 URL로 고정해 RN에서 해당 URL을 WebView로 로드 가능하게.

### 2.1 DB — Expo Push 토큰 저장

- **테이블:** `profiles` (기존)
- **추가 컬럼:** `expo_push_token` (text, nullable). (`fcm_token`은 컷오버 완료 전까지 유지)
- **정책:** 단일 컬럼 유지(마지막 로그인 기기만 수신).
- **방법:** Supabase 마이그레이션 또는 대시보드에서 컬럼 추가.
- **동의:** RN에서 토큰 등록 시점·개인정보 처리방침 연동은 RN/앱 정책에 따름. 웹 API는 “로그인 사용자가 보낸 토큰 저장”만 담당.

### 2.2 API — Expo Push 토큰 등록

- **엔드포인트:** `POST /api/profile/expo-push-token`
- **역할:** 로그인 사용자의 `profiles.expo_push_token` 갱신/해제. RN 앱이 로그인/토큰 갱신/로그아웃 시 호출.
- **요청:** body `{ "expo_push_token": "ExponentPushToken[...]" }` (`""`은 해제 의미, DB에는 `null` 저장)
- **인증:** 기존 `getUserFromRequest` 등으로 user_id 확보 후 해당 profile 업데이트.
- **응답(고정):**
  - `{ "ok": true, "action": "register_or_refresh" }`
  - `{ "ok": true, "action": "unregister" }`
- **에러 규칙(고정):**
  - `401 Unauthorized`
  - `403 Forbidden`
  - `422 expo_push_token 형식 오류`
  - `500 저장/내부 오류`
- **정합성 보강:** `update(...).eq("id", userId).select("id").single()`로 0-row 성공 오인 방지.

### 2.3 Expo Push 설정

- **인증 정책:** `EXPO_ACCESS_TOKEN` 기반 인증을 기본 정책으로 사용.
- **RN 토큰 발급 계약:** `Notifications.getExpoPushTokenAsync({ projectId })` 사용.
- **projectId 정합성:** 발급에 사용한 `projectId`와 RN `app.json > extra.eas.projectId`가 반드시 일치.

### 2.4 Expo Push 발송 유틸

- **파일:** `lib/expoPush.ts`
- **함수:** `sendExpoPushToUser(userId: string, payload: { title: string; body?: string; link: string })`
  - `profiles`에서 `id = userId`인 행의 `expo_push_token` 조회.
  - 토큰 없으면 스킵.
  - 있으면 Expo Push API로 전송. `data.link`는 절대 URL만 사용.
- **에러 처리:** Expo 발송 실패 시 로그만 남기고, 댓글/좋아요 API 응답은 성공 유지(푸시 실패가 사용자 액션 실패로 이어지지 않도록). 필요 시 재시도/큐는 후순위.

### 2.5 댓글 생성 시 푸시 (이미 API 있음)

- **위치:** `app/api/review-comments/route.ts` (POST)
- **흐름:**  
  1. 기존대로 `performance_review_comments`에 insert.  
  2. insert 성공 후, 해당 리뷰의 `performance_reviews.user_id`(리뷰 작성자) 조회.  
  3. 리뷰 작성자 ≠ 댓글 작성자이면, 리뷰 작성자에게 Expo Push 발송.  
     - title/body: 예) "새 댓글", "OOO님이 리뷰에 댓글을 남겼어요" (실제 문구는 기획에 맞게).  
     - link: `https://www.myballet.co.kr/performance/[performance_id]/reviews/[review_id]`.  
  4. Expo Push 호출은 **비동기**로 처리하고 응답은 기존처럼 댓글 데이터만 반환.

### 2.6 리뷰 좋아요 시 푸시 (현재 클라이언트 직접 insert)

- **현재:** 클라이언트가 `supabase.from("performance_review_likes").insert(...)` 직접 호출.
- **선택지:**
  - **A (권장):** `POST /api/reviews/[id]/like` (또는 `POST /api/performance-reviews/[id]/like`) 신규.  
    - 내부에서 `performance_review_likes` insert.  
    - insert 성공 후 리뷰 작성자 조회, 본인이 아니면 Expo Push 발송.  
    - 클라이언트는 이 API를 호출하도록 변경 (공연 상세·리뷰 목록 등에서 좋아요 시).
  - **B:** Supabase DB Webhook으로 `performance_review_likes` INSERT 감지 → Webhook이 우리 API URL 호출 → API에서 Expo Push만 발송.  
    - 클라이언트는 그대로 direct insert.  
    - Webhook 설정·보안(서비스 키 등) 필요.
- **계획 반영:** A로 진행. API 추가 + 클라이언트 호출 변경.

### 2.7 댓글 좋아요 시 푸시 (현재 클라이언트 직접 insert)

- **현재:** 클라이언트가 `performance_review_comment_likes` 직접 insert.
- **선택지:** 리뷰 좋아요와 동일. **A (권장):** `POST /api/review-comments/[id]/like` 신규. insert + 댓글 작성자 조회 후 Expo Push. 클라이언트는 이 API 호출로 변경.
- **계획 반영:** A로 진행.

### 2.8 푸시 payload 규격 (RN 고정 계약)

- **공통:** `data.link`는 절대 URL 고정. RN은 알림 탭 시 이 URL로 WebView 로드. RN은 방어적으로 상대 경로도 `https://www.myballet.co.kr` prefix를 붙여 처리하나, 웹 발송은 절대 URL만 사용.
- **타입별 link 예:**
  - 댓글 알림: `https://www.myballet.co.kr/performance/[performanceId]/reviews/[reviewId]`
  - 리뷰 좋아요: 동일
  - 댓글 좋아요: 동일 (해당 댓글이 속한 리뷰 페이지)

---

## 3. 구현 순서 제안

| 순서 | 작업 | 비고 |
|------|------|------|
| 1 | **햅틱** — `lib/reactNativeWebView.ts` + Button/Switch 연동 | RN 없이 브라우저에서도 안전하게 동작하는지 확인 |
| 2 | **DB** — `profiles.expo_push_token` 컬럼 추가 (`fcm_token` 유지) | Supabase 마이그레이션 |
| 3 | **Expo 설정** — `EXPO_ACCESS_TOKEN` 환경 변수 적용 | 웹 서버 발송 인증 |
| 4 | **lib/expoPush.ts** — sendExpoPushToUser 유틸 | 토큰 없음/실패 시 no-op 또는 로그만 |
| 5 | **API** — `POST /api/profile/expo-push-token` 추가 | 고정 스펙/422 검증/0-row 방지 포함 |
| 6 | **API** — POST review-comments 내 Expo Push 호출 | 댓글 알림 |
| 7 | **API** — POST reviews/[id]/like 신규 + 클라이언트 변경 | 리뷰 좋아요 알림 |
| 8 | **API** — POST review-comments/[id]/like 신규 + 클라이언트 변경 | 댓글 좋아요 알림 |
| 9 | **해제 이벤트** — `logout`/`account_deleted` + `version:1` 송신 고정 | `app/profile/menu/page.tsx`, `app/auth/kakao/logout/callback/page.tsx` |
| 10 | **문서 동기화/검증** — API 응답 + DB 반영 확인 | 200 응답만으로 완료 판정 금지 |

---

## 4. RN 측에 전달할 정보 (구현 후)

- **햅틱:** 웹에서 `type: 'haptic'` postMessage 전송. RN은 `onMessage`에서 수신 시 네이티브 햅틱 호출.
- **해제 이벤트:** `logout`/`account_deleted`와 `version:1` 포맷 고정.
- **Expo 토큰 등록:** `POST /api/profile/expo-push-token` 요청/응답/에러 스펙.
- **푸시 payload:** `data.link` 절대 URL 고정. 알림 탭 시 해당 URL로 WebView 로드.
- **토큰 정책:** 단일 컬럼(마지막 로그인 기기만 수신), 로그아웃/탈퇴 시 `expo_push_token: ""` 전송.
- **발급 정합성:** `Notifications.getExpoPushTokenAsync({ projectId })`의 `projectId`와 RN `app.json > extra.eas.projectId` 일치.

### 4.1 Apple Watch(HealthKit) 브릿지 계약 (iOS 전용)

- 초기 이벤트(로드 완료 1회):
  - `{ "type": "platform_info", "version": 1, "platform": "ios", "health_provider": "healthkit" }`
- 웹 요청:
  - `{ "type": "health_sync_request", "version": 1, "request_id": "<id>", "date": "YYYY-MM-DD", "activity": "barre" }`
- RN 응답(success):
  - `workout.activity_label`, `source_name`, `device_name`, `total_energy_kcal`, `avg_bpm`, `max_bpm` (키 고정, 값 nullable)
  - `active_energy_kcal`은 활동 칼로리 값으로 지속 제공
- RN 응답(error):
  - `NO_PERMISSION | NO_DATA | TIMEOUT | QUERY_FAILED`
  - 데이터 없음은 반드시 `{ "status": "error", "code": "NO_DATA" }`

## 5. QA/운영 검증 기준 (웹 기준)

### 5.1 완료 판정

- 1단계: API 응답 성공
- 2단계: DB 실제 반영 확인 (필수)

### 5.2 운영 점검 SQL

- 토큰 보유 현황:
  - `select count(*) filter (where expo_push_token is not null and btrim(expo_push_token) <> '') from public.profiles;`
- orphan 점검:
  - `select count(*) from auth.users u left join public.profiles p on p.id=u.id where p.id is null;`

### 5.3 시나리오

- 로그인 후 `profiles.expo_push_token` 저장 확인
- 로그아웃/탈퇴 메시지 수신 후 `profiles.expo_push_token`이 `null`인지 확인
- API 200이어도 DB 미반영이면 실패로 판정
- 형식 오류 토큰 요청 시 `422` 확인
- RN 토큰 발급 시 `Notifications.getExpoPushTokenAsync({ projectId })` 사용 확인
- 사용 `projectId`와 RN `app.json > extra.eas.projectId` 일치 확인

## 6. 정리 컷오버

- 안정화 확인 후 기존 FCM 경로 완전 제거:
  - `profiles.fcm_token` 컬럼 제거
  - `app/api/profile/fcm-token/route.ts` 삭제
  - `lib/fcm.ts` 삭제
  - `firebase-admin` 의존성 제거 및 관련 env 문서 정리
- 제거 시점 조건:
  - RN 배포/웹 배포 완료
  - 통합 검증(토큰 등록/3개 알림 트리거/토큰 해제) 완료
