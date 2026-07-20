# TravelMate AI 3.0

## 주요 변경 사항

- 쉬운 통역의 음성 입력을 브라우저 SpeechRecognition 방식에서 `마이크 녹음 → Supabase Edge Function → OpenAI 음성 인식` 방식으로 변경했습니다.
- iPhone Safari와 홈 화면 PWA에서도 같은 녹음 방식을 사용합니다.
- 한국어 → 현지어에서는 한국어 음성을, 현지어 → 한국어에서는 여행 국가의 현지어 음성을 인식합니다.
- 말하기 버튼을 다시 누르면 녹음이 종료되고 변환이 시작됩니다.
- AI 여행비서 음성 질문, AI 답변 읽기, 날짜별 일정, 고정 URL, 자동 업데이트 기능을 유지합니다.
- 앱 버전과 서비스 워커 캐시를 3.0으로 변경했습니다.

## 배포

1. ZIP의 전체 파일을 GitHub 저장소 루트에 덮어씁니다.
2. `supabase/functions/travelmate-translate/index.ts`를 Supabase Edge Function에 다시 배포합니다.
3. 기존 `OPENAI_API_KEY` secret은 유지합니다.
4. 고정 주소는 계속 `https://passionyyj-ai.github.io/TravelMate-AI/`를 사용합니다.

## 음성 사용 방법

1. `🎤 누르고 말하기`를 누릅니다.
2. 상태가 `듣고 있습니다`로 바뀌면 말합니다.
3. 같은 버튼을 다시 눌러 종료합니다.
4. 음성이 글자로 변환되면 내용을 확인하고 `번역하기`를 누릅니다.

음성 인식에는 인터넷 연결과 마이크 권한이 필요합니다.
