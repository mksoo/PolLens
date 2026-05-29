# PolLens

> 2026-06-03 지방선거 후보자 공약을 중앙선거관리위원회에서 자동 수집하고, Claude가 PDF를 직접 읽어 비교표를 만들어주는 Claude Code 스킬

## ✨ Features

- **선거구 자동 조회** — 읍·면·동 주소 입력만으로 Playwright가 선관위 사이트에서 선거구를 자동 탐색 (Path B), 또는 사이트 결과를 직접 붙여넣어도 됨 (Path A)
- **공약 PDF 자동 수집** — policy.nec.go.kr에서 5대공약(텍스트) PDF와 선거공보(이미지) PDF를 자동 다운로드
- **AI 직독 파싱** — pdf-parse 없이 Claude Code의 Read 도구가 PDF를 네이티브로 읽어 공약 해석
- **판단 없는 비교** — 기호번호 오름차순 정렬, 사실 정보만 제시 (추천·순위·점수 없음)

## 🛠 Tech Stack

| 분류 | 기술 |
|------|------|
| 🕷 스크래퍼 | Playwright 1.44 (Chromium headless) |
| 🟦 언어 | TypeScript 5 + ts-node 10 |
| 🧪 테스트 | Vitest 1 |
| 🟢 런타임 | Node.js 20+ |
| 🤖 AI | Claude Code (claude.ai/code) |
| 🍎 플랫폼 | macOS |

## 🚀 Getting Started

### Prerequisites

| | 항목 | 버전 / 비고 | 확인 방법 |
|---|---|---|---|
| 🟢 | Node.js | v20 이상 | `node --version` |
| 🤖 | Claude Code | [claude.ai/code](https://claude.ai/code) | 슬래시 커맨드 필수 |
| 🍎 | macOS | 검증된 플랫폼 | — |

### Installation

```bash
npm install
npx playwright install chromium
```

### 데이터 수집

```bash
# 기본 설정으로 수집
npx ts-node scripts/collect.ts

# 특정 선거만
npx ts-node scripts/collect.ts --type 시장

# 임의 선거구 (JSON 배열)
npx ts-node scripts/collect.ts --config-json '[{"electionType":"시장","regionCode":"4100","region":"화성시","district":"화성시","cityText":"화성시"}]'
```

### 테스트

```bash
npm test
```

## 💬 Claude Code 스킬 사용법

이 프로젝트 디렉토리에서 Claude Code를 열면 두 슬래시 커맨드를 바로 사용할 수 있다.

| 커맨드 | 역할 |
|--------|------|
| `/pollens-collect` | 선관위에서 최신 공약 데이터 수집 |
| `/pollens` | 수집된 데이터 기반 후보 공약 비교 |

### 사용 흐름

```
/pollens-collect
  → Path A: NEC 사이트 결과 붙여넣기
  → Path B: 시도 / 시군구 / 읍면동 입력 → Playwright 자동 선거구 조회
  → --config-json 으로 collect.ts 실행 → data/ 에 PDF 저장

/pollens
  → 캐시 확인 (24시간 이상 지났으면 /pollens-collect 안내)
  → 선거 목록 안내 → 사용자 선택
  → 후보자 PDF 직독 → 공약 비교표 출력 (기호번호 오름차순)
```

## 📁 Project Structure

```
PolLens/
├── .claude/commands/
│   ├── pollens-collect.md    # /pollens-collect 스킬
│   └── pollens.md            # /pollens 스킬
├── scripts/
│   ├── types.ts              # 공통 타입
│   ├── collect.ts            # CLI 진입점 (REGION_CODES 포함)
│   ├── cache.ts              # data/meta.json 24시간 캐시
│   ├── resolve-district.ts   # 주소 → 선거구 Playwright 조회
│   └── scrapers/
│       ├── base.ts           # 공통 Playwright 로직
│       └── *.ts              # 선거 유형별 스크래퍼
├── tests/
└── data/                     # 수집된 PDF + meta.json (gitignore)
```
