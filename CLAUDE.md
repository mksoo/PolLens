# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# 전체 데이터 수집 (기본 설정: DONGTAN5_CONFIGS)
npm run collect                    # == npx ts-node scripts/collect.ts

# 특정 선거만 수집
npx ts-node scripts/collect.ts --type 시장   # 도지사|시장|도의원|시의원|교육감

# 임의 선거구 수집 (JSON 배열)
npx ts-node scripts/collect.ts --config-json '[{"electionType":"시장","regionCode":"4100","region":"화성시","district":"화성시","cityText":"화성시"}]'

# 테스트
npm test                           # vitest run (one-shot)
npm run test:watch                 # vitest watch

# 단일 테스트 파일
npx vitest run tests/collect.test.ts

# TypeScript 타입 체크
npx tsc --noEmit
```

## Architecture

### 데이터 흐름

```
collect.ts ──▶ scraper/*.ts ──▶ base.ts (Playwright) ──▶ policy.nec.go.kr
                                      │
                                      ▼
                             downloadPdf (fetch + fs.writeFileSync)
                                      │
                                      ▼
                             data/<선거유형>/<지역>/<이름>.pdf
                             data/<선거유형>/<지역>/<이름>_공보.pdf
                                      │
                                      ▼
                             cache.ts ──▶ data/meta.json (candidates[] 포함)
```

`/pollens` 실행 시: meta.json → 후보 PDF 파일 → Claude가 Read 도구로 직접 열람 및 해석

### 주요 설계 결정

**PDF 바이너리 저장** — 수집 시 텍스트 추출 없이 PDF를 바이너리로 저장한다. Claude Code의 Read 도구가 PDF를 네이티브로 읽을 수 있어 `pdf-parse` 의존성이 불필요하다. 이미지 기반 PDF(PBINFO)도 동일하게 처리된다.

**meta.json 통합 관리** — 후보별 `.txt` 파일 대신 `data/meta.json`의 `candidates[]` 배열 하나에 모든 메타데이터를 저장한다. `pdfPath` / `pbinfoPdfPath`는 프로젝트 루트 기준 상대 경로.

**두 종류 PDF** — `P5_PRMS_PUB`(5대공약 텍스트 PDF)는 `<이름>.pdf`로, `PBINFO`(선거공보 이미지 PDF)는 `<이름>_공보.pdf`로 저장한다. PBINFO를 공약 파싱 fallback으로 사용하지 않는다 (이미지 PDF는 Claude가 직접 읽음).

**선관위 DOM 특이사항** — `policy.nec.go.kr`의 선거 유형 탭은 `<button>`이 아닌 `<li onclick="fnSgIdChange('...')">` 구조다. `fnSgIdChange()`는 동기 jQuery AJAX를 사용하고 성공 콜백에서 `parent._FN_INDEX_RESIZE()`를 호출하는데 iframe 없이 직접 로드 시 이 함수가 없어 오류가 발생한다. `base.ts`에서 `page.evaluate()`로 호출 전 스텁을 주입한다. 시·군 및 선거구 팝업은 `<label for="...">` 클릭으로 선택한다 (`<input type="button">` 아님).

### 파일 구조

- `scripts/types.ts` — 공통 타입 (`ElectionType`, `ScraperConfig`, `CandidateRef`, `CandidateMeta`, `CacheMeta`)
- `scripts/scrapers/base.ts` — Playwright 공통 로직: 페이지 탐색(`navigateToElectionList`), 후보 추출(`extractCandidateRefs`), PDF 다운로드(`downloadPdf`)
- `scripts/scrapers/*.ts` — 선거 유형별 스크래퍼 (governor/mayor/provincial/municipal/education). 모두 동일한 패턴: `navigateToElectionList` → `extractCandidateRefs` → `downloadPdf`
- `scripts/cache.ts` — `data/meta.json` 읽기/쓰기 (candidates[] 포함, 24시간 캐시 판단용)
- `scripts/collect.ts` — CLI 진입점. `--type` 또는 `--config-json` 플래그로 수집 대상 지정. `REGION_CODES` 테이블(시도명→4자리 코드) 포함.
- `scripts/resolve-district.ts` — Playwright로 `info.nec.go.kr` 팝업을 탐색해 읍·면·동 이름으로 선거구를 조회. `/pollens-collect` Path B에서 호출. `resolveDistrictByAddress(sido, sigungu, emd)` → `ResolvedDistricts`

### Claude Code 스킬

`.claude/commands/`에 프로젝트 스코프 커맨드 두 개가 있다:

- `/pollens-collect` — 선거구 입력 방식 선택 후 수집 실행. Path A: 사용자가 NEC 사이트 결과를 직접 붙여넣음. Path B: 시도/시군구/읍면동을 입력하면 `resolve-district.ts`가 Playwright로 선거구를 자동 조회.
- `/pollens` — 수집된 PDF 파일을 읽고 Claude가 공약을 직접 해석해 비교표 출력

**판단 금지**: `/pollens` 스킬은 "1위", "추천", "승자", "점수" 등 평가 표현을 절대 사용하지 않는다. 기호번호 오름차순 정렬만 허용.
