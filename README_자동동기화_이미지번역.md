# TravelMate AI v1.0 — 자동 동기화 + 이미지 번역

## 추가 구현
- 로그인 1회 후 자동 세션 유지
- 앱 실행 시 PC·휴대폰 데이터를 자동 병합
- 여행/일정 변경 후 약 1초 뒤 자동 저장
- Supabase Realtime으로 다른 기기 변경 자동 반영
- 같은 여행 ID는 최신 수정본 사용
- 다른 여행 ID는 모두 유지
- 메뉴판·표지판·영수증 이미지 번역
- 휴대폰 카메라 촬영 및 갤러리 선택
- 이미지 크기 자동 축소 후 Edge Function 전송
- 가격·알레르기·추가요금·주의사항 한국어 정리

## GitHub 업로드
이 ZIP의 파일 전체를 현재 `TravelMate-AI` 저장소 루트에 덮어씁니다.

특히 다음 파일은 반드시 교체합니다.
- index.html
- styles.css
- app.js
- config.js
- manifest.webmanifest
- sw.js

업로드 후:
`https://passionyyj-ai.github.io/TravelMate-AI/index.html?v=1.0.1`

## Supabase SQL
Supabase → SQL Editor에서 아래 파일 전체를 실행합니다.

`supabase/schema.sql`

이 SQL은:
- travel_backups 테이블 생성
- 사용자별 RLS 설정
- Realtime 대상 테이블 등록
을 수행합니다.

## Authentication URL 설정
Supabase → Authentication → URL Configuration

Site URL:
`https://passionyyj-ai.github.io/TravelMate-AI/`

Redirect URLs:
`https://passionyyj-ai.github.io/TravelMate-AI/**`

## Edge Function
다음 주소가 실제로 존재해야 합니다.

`https://fjpczzjrzxsyqolwfebh.supabase.co/functions/v1/travelmate-translate`

함수 Settings에서 JWT legacy 검증은 OFF로 설정합니다.

Secrets:
- OPENAI_API_KEY
- OPENAI_MODEL = gpt-4.1-mini
- OPENAI_VISION_MODEL = gpt-4.1-mini

## 최초 동기화
PC와 휴대폰에서 같은 이메일로 한 번씩 로그인합니다.
로그인 직후 각 기기의 여행 데이터를 병합한 후 클라우드에 저장합니다.

## 메뉴판 번역
통역 → 메뉴판 번역 → 사진 촬영 또는 이미지 선택 → 이미지 번역하기
