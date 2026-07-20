# TravelMate AI v1.1 소셜 로그인

## 구현 내용
- Google 로그인
- Apple 로그인
- 이메일 로그인 보조 유지
- Google 계정 선택 화면
- 기존 계정 변경, 자동 동기화, 국가 확장, 이미지 번역 유지

## GitHub 반영
ZIP 안의 파일 전체를 `TravelMate-AI` 저장소 루트에 덮어씁니다.

확인 주소:
https://passionyyj-ai.github.io/TravelMate-AI/index.html?v=1.1

## Supabase URL 설정
Supabase → Authentication → URL Configuration

Site URL:
https://passionyyj-ai.github.io/TravelMate-AI/

Redirect URLs:
https://passionyyj-ai.github.io/TravelMate-AI/**

## Google Provider 설정
1. Google Cloud Console에서 OAuth 2.0 Web Client 생성
2. Authorized redirect URI:
   https://fjpczzjrzxsyqolwfebh.supabase.co/auth/v1/callback
3. Supabase → Authentication → Providers → Google
4. Google Client ID와 Client Secret 입력 후 Enable

## Apple Provider 설정
Apple 로그인은 Apple Developer Program 계정이 필요합니다.

1. Apple Developer에서 Services ID 및 Sign in with Apple 설정
2. Return URL:
   https://fjpczzjrzxsyqolwfebh.supabase.co/auth/v1/callback
3. Supabase → Authentication → Providers → Apple
4. Services ID, Team ID, Key ID, Private Key 입력 후 Enable

Provider를 Supabase에서 활성화하지 않으면 해당 로그인 버튼은 작동하지 않습니다.
