# TravelMate AI v3.1 Senior Friendly Edition

어르신이 설명 없이도 사용할 수 있도록 화면과 음성 통역 흐름을 단순화한 버전입니다.

## 핵심 개선
- 큰 글자와 큰 버튼을 기본 적용
- 홈 메뉴를 동사형 문구로 변경
- 통역 화면의 말하기 버튼과 안내 문구 단순화
- 음성 인식 완료 후 자동 번역
- 번역 결과 자동 읽기 제거
- 필요할 때만 `발음 듣기` 버튼으로 재생
- iPhone과 Galaxy의 MediaRecorder 형식 대응
- 오류를 기술 용어 대신 쉬운 문장으로 안내
- 하단 홈 버튼을 항상 표시
- 서비스 워커 캐시 v3.1로 갱신

## 배포
GitHub 저장소의 기존 파일을 이 폴더 내용으로 모두 덮어쓰세요.

Supabase Edge Function도 아래 파일로 다시 배포해야 음성 파일 형식 수정이 적용됩니다.

`supabase/functions/travelmate-translate/index.ts`

고정 주소:
https://passionyyj-ai.github.io/TravelMate-AI/

## 첫 실행 점검
1. 마이크 권한 허용
2. `말하기 시작` 누르기
3. 천천히 말하기
4. `말하기 끝` 누르기
5. 자동 번역 결과 확인
6. 필요할 때만 `발음 듣기` 누르기
