# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 기본 지침

- **모든 응답은 한국어로 작성한다.**
- 기능 추가, 버그 수정, 리팩터링 등 모든 개발 작업 시 적절한 로그를 추가한다.
  - 비동기 작업(AsyncStorage 읽기/쓰기, 이미지 선택 등)의 시작·성공·실패를 `console.log` / `console.error`로 기록한다.
  - 예외 처리 블록(`catch`)에는 반드시 `console.error`로 오류 내용을 출력한다.
  - 사용자 액션(거래 추가, 결제 처리, 거래처 추가 등) 발생 시 주요 파라미터를 `console.log`로 남긴다.
  - 디버그용 로그는 `[DEBUG]`, 일반 정보는 `[INFO]`, 오류는 `[ERROR]` 접두사를 붙여 구분한다.

## Commands

```bash
# Expo 개발 서버 시작 (QR 코드로 Expo Go 앱에서 실행)
npx expo start

# 플랫폼별 실행
npx expo start --android
npx expo start --ios
npx expo start --web
```

Windows에서 `node`가 PATH에 없는 경우 번들된 Node.js 사용:
```powershell
.\install-deps.ps1   # 로컬 Node v20으로 의존성 설치
```

lint 또는 테스트 설정 없음.

## Architecture

단일 파일 React Native (Expo) 앱. 모든 로직, 상태, UI가 [App.js](App.js)에 있음.

**플랫폼:** iOS, Android, Web (세로 방향)  
**앱 이름:** 쇼핑몰 장부 (영수증·재고·결제 관리)

### Data Layer

- 모든 데이터는 기기 로컬 `AsyncStorage`에 저장.
- 백엔드 없음 — 완전 오프라인.
- 두 개의 스토리지 키:
  - `@ledger_transactions` — 거래 내역 배열
  - `@ledger_customers` — 거래처 배열

### 데이터 스키마

**Transaction (거래)**
```js
{
  id: string,          // Date.now().toString()
  type: '매출'|'매입', // 매출=판매수입, 매입=구매비용
  imageUri: string|null, // 영수증/재고 사진 URI
  amount: number,      // 총 거래 금액
  paidAmount: number,  // 현재까지 결제된 금액
  date: string,        // 'YYYY-MM-DD'
  customerId: string|null,
  customerName: string, // 조회 편의를 위해 비정규화 보관
  note: string,
  createdAt: string,   // ISO 타임스탬프
}
```

**Customer (거래처)**
```js
{
  id: string,
  name: string,
  phone: string,
  note: string,
}
```

### 주요 집계 공식

| 지표 | 계산식 |
|---|---|
| 총 매출 | type='매출' 거래의 amount 합계 |
| 총 매입 | type='매입' 거래의 amount 합계 |
| 총 결제액 | 전체 거래의 paidAmount 합계 |
| 미결제액 | 전체 거래의 (amount - paidAmount) 합계 |

### State (모두 App.js)

| State 변수 | 용도 |
|---|---|
| `transactions` | AsyncStorage에서 불러온/저장되는 거래 배열 |
| `customers` | AsyncStorage에서 불러온/저장되는 거래처 배열 |
| `activeTab` | 현재 탭 ('home' \| 'transactions' \| 'customers') |
| `addTxVisible` | 거래 추가 모달 표시 여부 |
| `txDetailVisible` | 거래 상세 모달 표시 여부 |
| `addCustomerVisible` | 거래처 추가 모달 표시 여부 |
| `selectedTx` | 상세 보기 중인 거래 객체 |
| `payInput` | 부분결제 금액 입력값 |

### 화면 구성

| 탭 | 내용 |
|---|---|
| 홈 | 요약 통계 (총매출·총매입·결제액·미결제액) + 최근 거래 5건 |
| 거래내역 | 전체/매출/매입/미결제 필터 + 전체 목록, 거래 선택 시 상세/결제처리 |
| 거래처 | 거래처 목록 + 건별 미결제 배지, 길게 누르면 삭제 |

### Key Dependencies

- `expo-image-picker` — 카메라 및 갤러리 접근
- `@react-native-async-storage/async-storage` — 로컬 데이터 영속화
- `expo` v49 / React Native v0.72 / React v18
