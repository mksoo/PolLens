# PolLens

> 경기도 화성시 동탄5동 유권자가 2026-06-03 지방선거 후보자들의 공약을 빠르게 비교할 수 있는 개인용 Claude Code 스킬(`/pollens`)

## ✨ Features

- **공약 자동 수집** — 선관위 공식 사이트(policy.nec.go.kr)에서 Playwright로 후보자 공약을 자동 스크래핑
- **5개 선거 지원** — 도지사 · 시장 · 도의원 · 시의원 · 교육감
- **24시간 캐시** — 한 번 수집하면 하루 동안 재수집 없이 즉시 비교 가능
- **판단 없는 비교** — 기호번호 오름차순 정렬, 사실 정보만 제시 (추천·순위 없음)
- **/pollens 슬래시 커맨드** — Claude Code에서 `/pollens` 입력으로 바로 실행

## 🛠 Tech Stack

| 분류 | 기술 |
|------|------|
| 스크래퍼 | Playwright 1.44 (Chromium headless) |
| 언어 | TypeScript 5 + ts-node 10 |
| 테스트 | vitest 1 |
| 런타임 | Node.js 20+ |
| 스킬 등록 | Claude Code slash command (symlink) |

## 🚀 Getting Started

### Prerequisites

```bash
node --version   # v20 이상
npm --version    # 10 이상
```

### Installation

```bash
cd /Users/mksoo/Documents/dev/tmp/PolLens
npm install
npx playwright install chromium
```

### Run

```bash
# 전체 공약 수집 (동탄5동 기준 5개 선거)
npx ts-node scripts/collect.ts

# 특정 선거만 수집
npx ts-node scripts/collect.ts --type 시장

# 테스트 실행
npm test
```

### Claude Code 스킬 등록

```bash
ln -sf /Users/mksoo/Documents/dev/tmp/PolLens/skills/pollens.md \
       ~/.claude/commands/pollens.md
```

등록 후 Claude Code에서 `/pollens` 실행.

## ⚠️ 첫 실행 전: 셀렉터 탐색 필수

스크래퍼의 CSS 셀렉터는 실제 사이트 탐색 후 채워야 합니다.

```bash
# 1. 헤드풀 브라우저 탐색 실행
npm run explore

# 브라우저가 열리면:
# ① policy.nec.go.kr → 화성시 선거 이동 → Enter
# ② 후보자 1명 클릭해 공보 문서 열기 → Enter
# ③ 탐색 종료 → Enter

# 2. 콘솔 출력을 보며 exploration/SCRAPER_NOTES.md 빈칸 채우기

# 3. scripts/scrapers/base.ts의 SELECTORS 객체를 실제 값으로 교체
# 4. 각 스크래퍼(governor.ts 등)의 listingUrl을 실제 URL로 교체

# 5. 수집 테스트
npx ts-node scripts/collect.ts --type 시장
```

## 📁 Project Structure

```
PolLens/
├── scripts/
│   ├── types.ts              # 공통 타입 (Candidate, Pledge 등)
│   ├── parser.ts             # textLayer 텍스트 → Candidate 파싱
│   ├── mdWriter.ts           # Candidate → Markdown 파일 저장
│   ├── cache.ts              # data/meta.json 24시간 캐시 관리
│   ├── collect.ts            # CLI 진입점 — 5개 스크래퍼 조율
│   ├── explore.ts            # 사이트 탐색 (셀렉터 발견용, 1회성)
│   └── scrapers/
│       ├── base.ts           # Playwright 공통 로직 + SELECTORS
│       ├── governor.ts       # 도지사
│       ├── mayor.ts          # 시장
│       ├── provincial.ts     # 도의원
│       ├── municipal.ts      # 시의원
│       └── education.ts      # 교육감
├── tests/
│   ├── parser.test.ts        # 12개 테스트
│   ├── mdWriter.test.ts      # 7개 테스트
│   └── cache.test.ts         # 7개 테스트
├── skills/
│   └── pollens.md            # Claude Code 스킬 정의
├── data/                     # 수집된 후보자 MD 파일 (gitignore)
│   ├── 도지사/경기도/추미애.md
│   ├── 시장/화성시/홍길동.md
│   └── meta.json
└── exploration/              # 탐색 스크린샷 + 셀렉터 노트 (gitignore)
```

## 스킬 사용 흐름

```
/pollens 실행
  → 캐시 확인 (24시간 이내면 바로, 아니면 자동 수집)
  → 선거 목록 안내 (5개)
  → 사용자 선택 → 후보자 공약 비교표 (기호번호 오름차순)
  → "다른 선거도 볼까요? 추가 정보를 찾아드릴까요?"
```

**제약**: "1위", "추천", "승자", "점수" 등 판단·추천 표현 사용 금지. 사실만 제시.
