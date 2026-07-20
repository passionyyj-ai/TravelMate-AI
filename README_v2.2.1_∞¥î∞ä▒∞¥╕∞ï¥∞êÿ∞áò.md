# TravelMate AI v2.2.1 음성인식 수정

- iPhone Safari 및 홈 화면 PWA에서 Web Speech API가 실패할 때 MediaRecorder 방식으로 자동 전환합니다.
- 말하기를 누르면 녹음이 시작되고, 인식 중지를 누르거나 15초가 지나면 자동으로 음성을 텍스트로 변환합니다.
- Supabase Edge Function에 `transcribe` 모드를 추가했습니다.
- `supabase/functions/travelmate-translate/index.ts`를 반드시 다시 배포해야 합니다.
- Edge Function의 기존 `OPENAI_API_KEY`를 그대로 사용합니다.
