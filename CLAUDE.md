# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# 전체 데이터 수집 (5개 선거)
npm run collect                    # == npx ts-node scripts/collect.ts

# 특정 선거만 수집
npx ts-node scripts/collect.ts --type 시장   # 도지사|시장|도의원|시의원|교육감

# 테스트
npm test                           # vitest run (one-shot)
npm run test:watch                 # vitest watch

# 단일 테스트 파일
npx vitest run tests/mdWriter.test.ts

# TypeScript 타입 체크
npx tsc --noEmit
```

## Architecture

### 데이터 흐름

```
collect.ts ──▶ scraper/*.ts ──▶ base.ts (Playwright) ──▶ policy.nec.go.kr
                                      │
                                      ▼
                             downloadPdfText (pdf-parse)
                                      │
                                      ▼
                             mdWriter.ts ──▶ data/<선거유형>/<지역>/<이름>.txt
                                      │
                                      ▼
                             cache.ts ──▶ data/meta.json
```

### 주요 설계 결정

**Raw text 저장** — PDF 텍스트를 구조화 파싱 없이 `.txt` 파일에 그대로 저장한다. 포맷이 후보마다 달라 정규식 파싱이 취약하기 때문이다. Claude가 `/pollens` 스킬 실행 시 직접 해석한다.

**두 단계 PDF 링크** — 각 후보 카드에는 `P5_PRMS_PUB`(5대공약 텍스트 PDF)와 `PBINFO`(선거공보 이미지 PDF) 두 종류가 있다. `pdfUrl`은 텍스트 추출용으로 `P5_PRMS_PUB`를 우선 사용하고, `pbinfoUrl`은 사용자 직접 열람용으로만 저장한다.

**선관위 DOM 특이사항** — `policy.nec.go.kr`의 선거 유형 탭은 `<button>`이 아닌 `<li onclick="fnSgIdChange('...')">` 구조다. `fnSgIdChange()`는 동기 jQuery AJAX를 사용하고 성공 콜백에서 `parent._FN_INDEX_RESIZE()`를 호출하는데 iframe 없이 직접 로드 시 이 함수가 없어 오류가 발생한다. `base.ts`에서 `page.evaluate()`로 호출 전 스텁을 주입한다. 시·군 및 선거구 팝업은 `<label for="...">` 클릭으로 선택한다 (`<input type="button">` 아님).

### 파일 구조

- `scripts/types.ts` — 공통 타입 (`ElectionType`, `ScraperConfig`, `CandidateRef`, `RawCandidate`, `CacheMeta`)
- `scripts/scrapers/base.ts` — Playwright 공통 로직: 페이지 탐색(`navigateToElectionList`), 후보 추출(`extractCandidateRefs`), PDF 다운로드(`downloadPdfText`)
- `scripts/scrapers/*.ts` — 선거 유형별 스크래퍼 (governor/mayor/provincial/municipal/education). 모두 동일한 패턴: `navigateToElectionList` → `extractCandidateRefs` → `downloadPdfText` → `saveRawCandidate`
- `scripts/mdWriter.ts` — `saveRawCandidate()`: `data/<electionType>/<region>/<name>.txt` 저장
- `scripts/cache.ts` — `data/meta.json` 읽기/쓰기 (24시간 캐시 판단용)
- `scripts/collect.ts` — CLI 진입점. `--type` 플래그로 단일 선거 수집 가능

### 선거구 (동탄5동 기준)

| 선거 | 지역 코드 | 시·군 팝업 | 선거구 팝업 |
|------|----------|-----------|-----------|
| 도지사 | 4100 | — | — |
| 시장 | 4100 | 화성시 | — |
| 도의원 | 4100 | 화성시동탄구 | 화성시제3선거구 |
| 시의원 | 4100 | 화성시동탄구 | 화성시다선거구 |
| 교육감 | 4100 | — | — |

### Claude Code 스킬

`.claude/commands/`에 프로젝트 스코프 커맨드 두 개가 있다:

- `/pollens-collect` — 수집 스크립트 실행
- `/pollens` — 수집된 `.txt` 파일을 읽고 Claude가 공약을 직접 해석해 비교표 출력

**판단 금지**: `/pollens` 스킬은 "1위", "추천", "승자", "점수" 등 평가 표현을 절대 사용하지 않는다. 기호번호 오름차순 정렬만 허용.

### `.txt` 파일 형식

```
이름: [이름]
기호: [번호]
정당: [정당]
선거: [선거유형] / [선거구]
공약PDF: [url]
선거공보PDF: [url]   ← 선택적
수집일: [ISO8601]

---

[pdf-parse로 추출한 원문 텍스트]
```

텍스트 추출 불가(이미지 PDF) 시: `(PDF 텍스트 추출 불가 — 선거공보PDF 링크를 직접 열람하세요)`
