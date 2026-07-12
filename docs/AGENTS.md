# AGENTS 작업 규칙

이 문서는 이 프로젝트에서 작업하는 에이전트가 따라야 할 규칙과 가이드라인을 정의한다.

## UI/디자인

- UI는 React Native 기본 컴포넌트와 프로젝트 공용 컴포넌트를 우선 활용한다.
- 공통 UI는 `src/components/`에 재사용 가능 형태로 구성하고, 화면 전용 UI는 `src/screens/`에서만 사용한다.
- 스타일은 `StyleSheet.create` 기반으로 작성하고, 인라인 스타일은 최소화한다.
- 아이콘이 필요한 경우 `lucide-react-native`를 기본으로 사용하고, 화면마다 라이브러리를 혼용하지 않는다.
- UI는 모바일 앱 사용성을 우선으로 구성한다.
- 기본 텍스트 크기는 가독성을 해치지 않는 범위에서 일관되게 유지한다.
- 입력/조회/보조 텍스트의 계층을 명확히 구분한다.
- 사용자 오류/안내 메시지는 화면 인라인 남발보다 배너/토스트/시스템 알림 등 일관된 방식으로 처리한다.
- 확인/경고 동작은 플랫폼별 UX를 해치지 않는 공통 패턴으로 처리한다.
- 기본 폰트는 Pretendard를 사용한다.
- 기본 톤앤보이스는 다정한 어요체를 사용한다.
- 색상 팔레트는 다음을 기본으로 사용한다. (전체 토큰·규칙은 `docs/DESIGN_SYSTEM.md` 참조)
  - 브랜드 색상: `#E8517C` (최소한으로 사용)
  - 알림 신호색: `#FF154A` (미읽음/알림 점 등. 브랜드색과 분리 — 대비 우선)
  - 베이스 다크: `#17171c`
  - 베이스 라이트: `#FFFFFF`

## React Native/Expo 사용 규칙

- 프로젝트 런타임은 Expo SDK 기준으로 유지한다.
- 네이티브 동작이 필요한 라이브러리 추가 시 Expo 호환성(Expo Go/Dev Build)을 먼저 확인한다.
- WebView 연동은 `src/components/MyBalletWebView.tsx` 정책(내부 허용/외부 브라우저 분기)을 따른다.
- WebView 브릿지 메시지 처리는 `src/hooks/useWebViewMessage.ts`를 통해 일관되게 확장한다.
- 주소검색/푸시/햅틱/인앱브라우저 등 플랫폼 기능은 화면에 직접 분산하지 않고 훅/컴포넌트로 분리한다.
- 웹에서 전달한 URL을 인앱 브라우저로 열 때는 `expo-web-browser`의 `openBrowserAsync`를 사용한다.

## Supabase 규칙

- Supabase 연동은 Cursor MCP를 우선 사용해 구현한다.
- 테이블 생성/변경은 MCP의 SQL 실행 또는 마이그레이션을 우선 사용한다.
- 타입 생성이 필요하면 MCP 도구(`generate_typescript_types`)를 사용한다.
- 민감 CRUD는 서버(API)에서 권한 검증 후 처리한다.
- PATCH/DELETE 시 대상 행 존재 여부(404)와 소유권(403)을 먼저 검증한다.
- 소프트 삭제(`deleted_at`) 정책이 있는 경우 조회/수정/추가 동작에서 일관되게 차단한다.
- 범위값(예: 평점, 카운트)은 서버에서 최종 검증한다.

## 인증

- 인증/세션 토큰은 WebView OAuth 흐름과 프로젝트 브릿지 규약을 따른다.
- RN에서 웹 API 호출 시 액세스 토큰은 브릿지로 전달받은 값만 사용하고, 실패 시 no-op/재시도 정책을 명확히 둔다.
- Expo Push 토큰 등록은 `POST /api/profile/expo-push-token` 규약을 따른다.

## 프로젝트 구조

- 엔트리 포인트는 `App.tsx`를 유지한다.
- 화면 단위는 `src/screens/`, 컴포넌트는 `src/components/`, 훅은 `src/hooks/`에 둔다.
- 상수/환경 설정은 `src/constants/`, 외부 연동 로직은 `src/services/`, 타입은 `src/types/`에 둔다.
- 내비게이션/딥링크 규칙은 `src/navigation/`에 모은다.

## 환경변수/시크릿

- 환경변수는 로컬 환경 파일로만 관리한다.
- 시크릿/키 파일(`.env*`, 서비스 계정 키 등)은 절대 커밋하지 않는다.
- 토큰/개인정보를 로그로 남기지 않는다.

## 검증

- 기능 변경 후 `npx tsc --noEmit`로 타입 오류를 확인한다.
- 실행 검증은 `npx expo start`(필요 시 `--tunnel -c`)로 최소 동작을 확인한다.
- 브릿지/WebView 변경 시 iOS/Android에서 모두 기본 시나리오를 점검한다.
- SDK/설정 변경 후 `npx expo-doctor`로 정합성을 확인한다.
