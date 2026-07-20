# TravelMate AI v1.0

완전히 새로 설계한 다중 여행 관리 앱입니다.

## v1.0 기능
- 여러 여행 등록·수정·삭제·선택
- 국가 선택 후 해당 국가의 도시 선택
- 도시 선택 시 통화, 현지 언어, IANA 시간대 자동 적용
- 여행별 상세 일정 직접 등록
- Excel/XLS/CSV 일정 일괄 업로드
- 여행지 현지시간과 한국시간 표시
- 여행지 통화 자동 적용 환율 계산
- 여행지 언어 자동 적용 통역
- 큰 글자, 큰 버튼, 단순한 6개 메뉴
- PWA 설치
- Supabase 이메일 로그인 및 백업/복원 준비
- 새 전용 아이콘

## 새 GitHub 저장소
권장 저장소 이름: `TravelMate-AI`

1. GitHub에서 새 Public 저장소를 만듭니다.
2. 이 ZIP의 파일 전체를 저장소 루트에 업로드합니다.
3. `Settings → Pages`
4. Source: `Deploy from a branch`
5. Branch: `main`, Folder: `/(root)`
6. 저장 후 배포를 기다립니다.

예상 주소:
`https://<GitHub아이디>.github.io/TravelMate-AI/`

## 새 Supabase 프로젝트
1. Supabase에서 새 프로젝트를 만듭니다.
2. SQL Editor에서 `supabase/schema.sql` 전체를 실행합니다.
3. Authentication → URL Configuration에서 GitHub Pages 주소를 Site URL과 Redirect URL에 등록합니다.
4. Project Settings → API에서 Project URL과 anon/public key를 확인합니다.
5. `config.js`에 입력합니다.

```js
window.TRAVELMATE_CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_ANON_KEY",
  supabaseFunctionUrl: ""
};
```

6. Authentication의 이메일 로그인을 사용합니다.

## 일정 업로드 컬럼
- 날짜
- 시작시간
- 종료시간
- 일정명
- 장소
- 분류
- 메모

`sample_itinerary.csv` 파일을 참고하세요.

## 환율
Frankfurter 공개 API를 사용해 선택한 통화의 KRW 환율을 불러옵니다.
일부 통화는 API 제공 범위에 따라 자동 조회가 제한될 수 있습니다.

## 데이터 저장
Supabase에 로그인하지 않아도 휴대폰 브라우저에 저장됩니다.
브라우저 데이터 삭제 시 로컬 데이터가 사라질 수 있으므로 Supabase 백업을 권장합니다.
