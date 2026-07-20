TravelMate AI v3.0.1 음성 인식 수정

1) GitHub 저장소에서 app.js와 sw.js를 이 폴더 파일로 덮어씁니다.
2) Commit changes를 누릅니다.
3) Supabase Edge Function의 index.ts에서 EDGE_FUNCTION_PATCH.txt의 한 줄을 수정하고 Deploy합니다.
4) 아이폰에서 기존 홈 화면 앱을 완전히 종료한 뒤 다시 실행합니다.
5) 설정 > Safari > 고급 > 웹사이트 데이터에서 passionyyj-ai.github.io 데이터만 삭제하면 오래된 캐시가 즉시 제거됩니다.

핵심 수정:
- iPhone MP4 녹음을 250ms 조각으로 나누지 않고 하나의 정상 파일로 저장
- 앱 JS를 network-first로 갱신하여 이전 음성 코드가 계속 남는 문제 해결
- Service Worker 즉시 교체 및 캐시 이름 갱신
