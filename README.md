# 🌸 Daily Bloom - MBTI "J"를 위한 미니멀 일정 관리

<div align="center">
  <img src="./assets/logo.svg" width="120" alt="Daily Bloom Logo">
  <br />
  <p><b>"당신의 하루를 아름답게 피워보세요"</b></p>
  <p>MBTI 'J' 성향을 위한 가장 심플하고 감성적인 PWA 플래너</p>
</div>

<br />

## 📑 프로젝트 개요 (Overview)
**Daily Bloom**은 체계적인 계획을 선호하는 사용자(MBTI 'J')를 위해 설계된 고성능 웹 플래너입니다. 단순한 기록을 넘어, **철저한 개인정보 보호**, **친구와의 스마트한 일정 공유**, 그리고 **앱처럼 사용하는 PWA 환경**을 제공합니다.

- **배포 주소:** [https://dailybloomyourday.web.app](https://dailybloomyourday.web.app)
- **주요 가치:** 미니멀리즘, 프라이버시, 연결성, 반응형 경험

<br />

## ✨ 핵심 기능 (Key Features)

### 🗓️ 스마트 일정 & 동기화
- **연속 일정 (#d) & 주간 반복 (#w):** 간단한 태그만으로 며칠간의 여행이나 매주 반복되는 업무를 한 번에 등록합니다.
- **다중 태그 & 스마트 동기화:** `@친구1 @친구2` 태그로 여러 명과 일정을 공유하며, 수정 시 모두의 캘린더에 내용이 실시간으로 동기화됩니다. ("누구와 함께" 텍스트 자동 관리)
- **드래그 앤 드롭:** 일정의 순서를 꾹 눌러서 자유롭게 배치할 수 있습니다.

### 🔒 3단계 프라이버시 보호
- **🔒 나만 보기 (Private):** 자물쇠 버튼을 켜면 오직 나에게만 보이는 철저한 비밀 일정이 됩니다.
- **👥 우리끼리 보기 (Protected):** 친구를 태그하면 나와 태그된 친구들에게만 보이고, 다른 친구들에게는 숨겨집니다.
- **🌍 전체 공개 (Public):** 내 캘린더를 방문하는 모든 블룸(친구)에게 계획을 공유합니다.

### 🔍 지능형 검색 & 알림
- **그룹화된 검색 결과:** 동일한 내용이나 반복되는 일정은 하나로 묶어 보여주며, 클릭 시 상세 날짜별로 펼쳐지는 효율적인 인터페이스를 제공합니다.
- **시스템 알림 (Push):** 앱을 닫아두어도 누군가 나를 태그하거나 댓글을 남기면 PC/모바일 시스템 알림으로 즉시 소식을 받습니다. (7일 보관, 개별 삭제 지원)
- **스마트 알림 버튼:** 현재 권한 상태에 따라 알림 켜기/끄기 가이드를 동적으로 제공합니다.

### 📱 강력한 PWA 앱 경험
- **앱 설치 지원:** 브라우저 주소창 없이 홈 화면에 아이콘을 추가하여 진짜 앱처럼 전체 화면으로 사용할 수 있습니다.
- **오프라인 모드:** 서비스 워커 기술을 통해 인터넷 연결이 불안정한 환경에서도 기본적인 일정 확인이 가능합니다.
- **하트 도움말:** 일정 팝업의 ❤️ 아이콘을 통해 언제든 사용법 가이드를 확인할 수 있습니다.

### 🌸 소셜 인터랙션 (Bloom)
- **1초 초대 링크:** 복잡한 검색 없이 고유 초대 링크 공유만으로 즉시 '맞블룸(친구)'을 맺을 수 있습니다.
- **블룸(Bloom) 응원:** 친구의 달력에 실시간 댓글을 남겨 서로의 계획을 응원합니다.

<br />

## 🛠️ 기술 스택 (Tech Stack)

- **Frontend:** Vanilla JavaScript (ES6+), Web Components, Modern CSS (Oklch, scrollbar-gutter)
- **PWA:** Manifest JSON, Service Worker (Caching & Push Notification)
- **Backend:** Firebase Authentication (Google OAuth), Cloud Firestore (Real-time Sync)
- **Security:** Firebase Security Rules (Role-based access control)
- **Analysis:** Google Analytics 4, Microsoft Clarity

<br />

## 🚀 시작하기 (Getting Started)

1. **로그인:** 구글 계정으로 1초 만에 가입하세요.
2. **앱 설치:** 주소창의 설치 버튼이나 마이페이지의 '앱 설치'를 눌러 홈 화면에 추가하세요.
3. **일정 관리:** 날짜를 선택하고 일정을 적으세요. 공유하고 싶다면 `@닉네임`, 숨기고 싶다면 `🔒` 버튼을 활용하세요!
4. **친구 초대:** 마이페이지에서 초대 링크를 복사해 친구에게 카톡으로 보내보세요.

<br />

## 📄 라이선스 (License)
This project is licensed under the ISC License.

---
<div align="center">
  Designed with ❤️ for all the planners out there.
</div>