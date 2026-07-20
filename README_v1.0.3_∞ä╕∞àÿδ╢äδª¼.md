# TravelMate AI v1.0.3 — 전용 로그인 세션

## 변경사항
- TravelMate 전용 Supabase Auth 저장 키 사용
- 같은 브라우저의 ALLIN 등 다른 앱 로그인 세션과 완전 분리
- 기존 공용 세션은 자동으로 사용하지 않음
- 로그인 계정 명확히 표시
- 계정 변경 버튼 추가
- 로그인 완료 후 URL의 인증 해시 정리
- 기존 국가 52개, 도시 274개, 자동 동기화, 이미지 번역 유지

## 반영 방법
ZIP 전체를 GitHub 저장소 루트에 덮어쓰세요.
특히 app.js, index.html, styles.css, manifest.webmanifest, sw.js를 교체해야 합니다.

확인 주소:
https://passionyyj-ai.github.io/TravelMate-AI/index.html?v=1.0.3

## 최초 1회 안내
v1.0.3은 기존 공용 로그인 세션을 사용하지 않으므로 처음 한 번 TravelMate에서 다시 로그인해야 합니다.
