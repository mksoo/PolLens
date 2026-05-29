# PolLens

> 경기도 화성시 동탄5동 유권자가 2026-06-03 지방선거 후보자들의 공약을 빠르게 비교할 수 있는 개인용 Claude Code 스킬

## ✨ Features

- **공약 자동 수집** — 선관위 공식 사이트(policy.nec.go.kr)에서 Playwright로 후보자 공약 PDF를 자동 스크래핑
- **5개 선거 지원** — 도지사 · 시장 · 도의원(화성시제3선거구) · 시의원(화성시다선거구) · 교육감
- **AI 기반 공약 파싱** — raw PDF 텍스트를 저장해두고 Claude가 직접 해석 (포맷 유연성 확보)
- **판단 없는 비교** — 기호번호 오름차순 정렬, 사실 정보만 제시 (추천·순위 없음)
- **2개 슬래시 커맨드** — `/pollens-collect`(수집) · `/pollens`(비교 분석) 분리

## 🛠 Tech Stack

| 분류 | 기술 |
|------|------|
| 스크래퍼 | Playwright 1.44 (Chromium headless) |
| PDF 추출 | pdf-parse |
| 언어 | TypeScript 5 + ts-node 10 |
| 테스트 | vitest 1 |
| 런타임 | Node.js 20+ |
| 스킬 관리 | Claude Code project-scope commands (`.claude/commands/`) |

## 🚀 Getting Started

### Prerequisites

```bash
node --version   # v20 이상
npm --version    # 10 이상
```

### Installation

```bash
npm install
npx playwright install chromium
```

### 데이터 수집

```bash
npx ts-node scripts/collect.ts
```

약 2~3분 소요. 수집 결과는 `data/` 디렉토리에 저장된다.

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
  → Playwright로 5개 선거 후보 공약 PDF 다운로드 및 저장

/pollens
  → 캐시 확인 (24시간 이상 지났으면 /pollens-collect 안내)
  → 선거 목록 안내 (5개)
  → 사용자 선택 → 후보자 공약 비교표 (기호번호 오름차순)
  → "다른 선거도 볼까요? 추가 정보를 찾아드릴까요?"
```

**제약**: "1위", "추천", "승자", "점수" 등 판단·추천 표현 사용 금지. 사실만 제시.

## 📁 Project Structure

```
PolLens/
├── .claude/
│   └── commands/
│       ├── pollens.md            # /pollens 스킬 — 공약 비교 분석
│       └── pollens-collect.md    # /pollens-collect 스킬 — 데이터 수집
├── scripts/
│   ├── types.ts                  # 공통 타입 (RawCandidate 등)
│   ├── mdWriter.ts               # 후보자 데이터 → .txt 파일 저장
│   ├── cache.ts                  # data/meta.json 24시간 캐시 관리
│   ├── collect.ts                # CLI 진입점 — 5개 스크래퍼 조율
│   └── scrapers/
│       ├── base.ts               # Playwright 공통 로직 (선관위 탐색)
│       ├── governor.ts           # 도지사 (경기도)
│       ├── mayor.ts              # 시장 (화성시)
│       ├── provincial.ts         # 도의원 (화성시제3선거구)
│       ├── municipal.ts          # 시의원 (화성시다선거구)
│       └── education.ts          # 교육감 (경기도)
├── tests/
│   ├── mdWriter.test.ts
│   └── cache.test.ts
└── data/                         # 수집된 후보자 .txt 파일 (gitignore)
    ├── 도지사/경기도/추미애.txt
    ├── 시장/화성시/정명근.txt
    └── meta.json
```
