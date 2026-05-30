# PolLens

> 2026-06-03 지방선거 후보자 공약을 중앙선거관리위원회에서 자동 수집하고, Claude가 PDF를 직접 읽어 비교표를 만들어주는 Claude Code 스킬

읍·면·동 주소를 입력하면 Playwright가 선관위 사이트에서 선거구를 찾고 후보자별 공약 PDF를 다운로드한다. Claude Code가 PDF를 직접 읽어 비교표를 만든다. 추천이나 순위 없이 기호번호 오름차순 사실 정보만 제시한다.

## 시작하기

### 1. 필요한 것

- Node.js v20 이상 (`node --version`으로 확인)
- [Claude Code](https://claude.ai/code) — 슬래시 커맨드와 PDF 직독 기능은 Claude Code에서만 동작한다
- macOS (검증된 플랫폼)

### 2. 설치

```bash
npm install
npx playwright install chromium
```

### 3. 실행

이 프로젝트 디렉토리를 Claude Code로 열고 `/pollens`를 실행한다.

수집이 필요하면 자동으로 처리한다. 선거구를 입력하는 방법은 두 가지다.

- **Path A**: 선관위 사이트(info.nec.go.kr)에서 본인 선거구를 찾아 결과를 붙여넣는다.
- **Path B**: 시도·시군구·읍면동을 입력하면 Playwright가 선거구를 자동으로 조회한다.

수집이 끝나면 선거 목록이 나온다. 보고 싶은 선거를 선택하면 후보자별 공약 비교표가 출력된다.

캐시는 24시간 유효하다. 데이터를 수동으로 갱신하려면 `/pollens-collect`를 직접 실행한다.

## 개발

```bash
npm test                      # 테스트 실행 (one-shot)
npm run test:watch            # 워치 모드
npx tsc --noEmit              # 타입 체크

# 특정 선거 유형만 수집
npx ts-node scripts/collect.ts --type 시장   # 도지사|시장|도의원|시의원|교육감

# 임의 선거구 수집
npx ts-node scripts/collect.ts --config-json '[{"electionType":"시장","regionCode":"4100","region":"화성시","district":"화성시","cityText":"화성시"}]'
```

## Tech Stack

| 분류 | 기술 |
|------|------|
| 스크래퍼 | Playwright 1.44 (Chromium headless) |
| 언어 | TypeScript 5 + ts-node 10 |
| 테스트 | Vitest 1 |
| 런타임 | Node.js 20+ |
| AI | Claude Code (claude.ai/code) |
| 플랫폼 | macOS |

## Project Structure

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
