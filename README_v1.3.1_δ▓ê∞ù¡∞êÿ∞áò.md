# TravelMate AI v1.3.1 번역 수정

- 여행 국가의 언어 정보를 기준으로 번역 언어 자동 결정
- 기존 저장 여행에 langCode가 없거나 잘못 저장된 경우 국가 데이터로 자동 복구
- Edge Function에 언어 코드/언어명 매핑 추가
- 한국어→현지어, 현지어→한국어 양방향 번역 명확화
- 이미지 번역은 한국어로 정리

## 필수 배포
`supabase/functions/travelmate-translate/index.ts`를 기존 함수에 덮어쓴 뒤 다시 Deploy하세요.
