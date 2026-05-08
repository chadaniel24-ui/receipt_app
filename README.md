# 영수증 장부 앱

이 프로젝트는 Expo 기반의 Android/iOS 크로스 플랫폼 영수증 관리 앱입니다.
카메라 또는 갤러리에서 영수증 이미지를 등록하고, 금액/날짜/분류/메모를 입력하여 로컬 장부로 관리할 수 있습니다.

## 완성된 개발 내용

- `App.js`에 기본 화면 구성 작성
- 영수증 사진 촬영 및 갤러리 선택 기능 구현
- 금액, 날짜, 분류, 메모 입력 화면 구현
- 로컬 저장소(`AsyncStorage`)에 영수증 데이터 저장
- 영수증 목록 표시 및 삭제 기능 구현
- 앱 스타일과 모바일 친화적 UI 구성

## 사용 기술

- Expo
- React Native
- Expo Image Picker
- AsyncStorage

## 설치 및 실행 방법

1. 프로젝트 폴더로 이동
```powershell
cd c:\Users\고은정\Desktop\차진영\APP_RECIPT
```

2. Node.js와 npm이 설치되어 있는지 확인

- 설치되어 있다면:
```powershell
npm install
```
- 설치되어 있지 않다면, 먼저 Node.js를 설치하세요.
  - https://nodejs.org 에서 Windows용 LTS 설치

3. 설치 도구 실행 (PowerShell)
```powershell
.\install-deps.ps1
```

4. Expo 개발 서버 실행
```powershell
npm start
```

5. Android 또는 iOS 시뮬레이터/기기에서 실행
```powershell
npm run android
npm run ios
```

## 앱 사용법

1. 앱 첫 화면에서 `카메라로 추가` 또는 `갤러리에서 선택`을 선택합니다.
2. 영수증 이미지를 등록한 뒤, 금액/날짜/분류/메모를 입력합니다.
3. `저장`을 누르면 로컬 장부에 영수증 항목이 저장됩니다.
4. 목록에서 저장된 영수증을 확인하고, 필요하면 `삭제` 버튼으로 삭제할 수 있습니다.
5. 상단에서 총 영수증 건수와 합계 금액을 확인할 수 있습니다.

## 현재 환경 주의사항

- 이 워크스페이스 터미널에서는 `node`와 `npm`이 설치되어 있지 않아 자동 설치가 바로 실행되지 않았습니다.
- `install-deps.ps1`을 사용하면 Node.js가 설치된 경우 자동으로 의존성 설치가 가능합니다.

## 향후 확장 계획

- 영수증 OCR 텍스트 추출
- 카테고리 필터 및 날짜별 통계
- 백업/동기화 기능
- 영수증 내역 편집 기능
