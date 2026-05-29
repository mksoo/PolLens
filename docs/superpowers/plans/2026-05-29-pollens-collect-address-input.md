# `/pollens-collect` 주소 입력 기반 선거구 결정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 하드코딩된 동탄5동 선거구를 제거하고, 사용자가 주소를 입력하면 전국 어디서든 해당 선거구 공약을 수집할 수 있도록 확장한다.

**Architecture:** `ScraperConfig`에 `regionCode`, `cityText?`, `districtText?`를 추가하고 스크래퍼 5개에서 하드코딩된 값을 제거한다. `collect.ts`에 `--config-json` 플래그를 추가해 동적 설정을 받는다. Path B 전용 `resolve-district.ts`(Playwright)를 신규 생성한다. `/pollens-collect` 스킬 파일을 Path A/B 선택 흐름으로 전면 개정한다.

**Tech Stack:** TypeScript, Playwright, Vitest, ts-node

---

## 파일 구조

| 상태 | 파일 | 변경 내용 |
|------|------|-----------|
| Modify | `scripts/types.ts` | ScraperConfig에 `regionCode`, `cityText?`, `districtText?` 추가 |
| Modify | `scripts/scrapers/base.ts` | `REGION_CODE` export 제거 |
| Modify | `scripts/scrapers/governor.ts` | `REGION_CODE` → `config.regionCode` |
| Modify | `scripts/scrapers/education.ts` | `REGION_CODE` → `config.regionCode` |
| Modify | `scripts/scrapers/mayor.ts` | `REGION_CODE`/`'화성시'` → `config.regionCode`/`config.cityText` |
| Modify | `scripts/scrapers/provincial.ts` | `REGION_CODE`/`'화성시동탄구'` → config 필드 사용 |
| Modify | `scripts/scrapers/municipal.ts` | `REGION_CODE`/`'화성시동탄구'` → config 필드 사용 |
| Modify | `scripts/collect.ts` | `REGION_CODES` 테이블, `--config-json` 플래그, `parseConfigJson` export |
| Create | `scripts/resolve-district.ts` | Playwright 읍면동 → 선거구 조회 (Path B) |
| Create | `tests/collect.test.ts` | `parseConfigJson`, `REGION_CODES` 테스트 |
| Create | `tests/resolve-district.test.ts` | `parseDistrictResult` 순수 함수 테스트 |
| Modify | `.claude/commands/pollens-collect.md` | Path A/B 선택 흐름으로 전면 개정 |

---

## Task 1: ScraperConfig 확장 및 DONGTAN5_CONFIGS 업데이트

**Files:**
- Modify: `scripts/types.ts`
- Modify: `scripts/collect.ts`

- [ ] **Step 1: `scripts/types.ts`의 `ScraperConfig` 인터페이스를 수정한다**

```typescript
// scripts/types.ts
export type ElectionType = '도지사' | '시장' | '도의원' | '시의원' | '교육감';

export interface ScraperConfig {
  electionType: ElectionType;
  regionCode: string;
  region: string;
  district: string;
  cityText?: string;
  districtText?: string;
}

// CandidateRef, CandidateMeta, CacheMeta는 변경 없음
```

- [ ] **Step 2: `scripts/collect.ts`의 `DONGTAN5_CONFIGS`를 새 필드 포함으로 업데이트한다**

`collect.ts` 상단 `DONGTAN5_CONFIGS` 상수를 아래로 교체한다:

```typescript
const DONGTAN5_CONFIGS: ScraperConfig[] = [
  { electionType: '도지사',  regionCode: '4100', region: '경기도', district: '경기도' },
  { electionType: '시장',    regionCode: '4100', region: '화성시', district: '화성시',             cityText: '화성시' },
  { electionType: '도의원',  regionCode: '4100', region: '경기도', district: '화성시제3선거구',   cityText: '화성시동탄구', districtText: '화성시제3선거구' },
  { electionType: '시의원',  regionCode: '4100', region: '화성시', district: '화성시다선거구',   cityText: '화성시동탄구', districtText: '화성시다선거구' },
  { electionType: '교육감',  regionCode: '4100', region: '경기도', district: '경기도' },
];
```

- [ ] **Step 3: 타입 체크를 실행해 오류가 없는지 확인한다**

```bash
cd /Users/mksoo/Documents/dev/tmp/PolLens && npx tsc --noEmit
```

Expected: 오류 없음. (스크래퍼들이 아직 `REGION_CODE`를 import하므로 이 단계에서는 오류 발생 가능 — Task 2에서 해결)

- [ ] **Step 4: 커밋한다**

```bash
git add scripts/types.ts scripts/collect.ts
git commit -m "feat: extend ScraperConfig with regionCode, cityText, districtText"
```

---

## Task 2: REGION_CODE 제거 — 스크래퍼 5개 업데이트

**Files:**
- Modify: `scripts/scrapers/base.ts`
- Modify: `scripts/scrapers/governor.ts`
- Modify: `scripts/scrapers/education.ts`
- Modify: `scripts/scrapers/mayor.ts`
- Modify: `scripts/scrapers/provincial.ts`
- Modify: `scripts/scrapers/municipal.ts`

- [ ] **Step 1: `base.ts`에서 `REGION_CODE` export를 제거한다**

`scripts/scrapers/base.ts` 11번째 줄을 삭제한다:

```typescript
// 삭제할 줄:
export const REGION_CODE = '4100';
```

- [ ] **Step 2: `governor.ts`를 업데이트한다**

`scripts/scrapers/governor.ts` 전체를 아래로 교체한다:

```typescript
// scripts/scrapers/governor.ts
import { chromium } from 'playwright';
import * as path from 'path';
import type { ScraperConfig, CandidateMeta } from '../types';
import { navigateToElectionList, extractCandidateRefs, downloadPdf, createPage } from './base';

export async function scrapeGovernor(config: ScraperConfig, dataDir: string): Promise<CandidateMeta[]> {
  const browser = await chromium.launch({ headless: true });
  const candidates: CandidateMeta[] = [];
  try {
    const page = await createPage(browser);
    console.log(`  도지사 후보 목록 탐색 중...`);
    await navigateToElectionList(page, '시·도지사선거', config.regionCode);
    const refs = await extractCandidateRefs(page);
    console.log(`  도지사 후보 ${refs.length}명 발견`);

    for (const ref of refs) {
      console.log(`  수집 중: 기호${ref.ballotNumber} ${ref.name} (${ref.party})`);
      const meta: CandidateMeta = {
        name: ref.name, ballotNumber: ref.ballotNumber, party: ref.party,
        electionType: config.electionType, region: config.region, district: config.district,
        pdfUrl: ref.pdfUrl, pbinfoUrl: ref.pbinfoUrl,
        collectedAt: new Date().toISOString(),
      };

      if (ref.pdfUrl) {
        const destPath = path.join(dataDir, config.electionType, config.region, `${ref.name}.pdf`);
        try {
          await downloadPdf(ref.pdfUrl, destPath);
          meta.pdfPath = path.relative(process.cwd(), destPath);
          console.log(`    공약PDF 저장: ${meta.pdfPath}`);
        } catch (e) {
          console.log(`    공약PDF 다운로드 실패: ${(e as Error).message.slice(0, 80)}`);
        }
      }

      if (ref.pbinfoUrl) {
        const destPath = path.join(dataDir, config.electionType, config.region, `${ref.name}_공보.pdf`);
        try {
          await downloadPdf(ref.pbinfoUrl, destPath);
          meta.pbinfoPdfPath = path.relative(process.cwd(), destPath);
          console.log(`    선거공보PDF 저장: ${meta.pbinfoPdfPath}`);
        } catch (e) {
          console.log(`    선거공보PDF 다운로드 실패: ${(e as Error).message.slice(0, 80)}`);
        }
      }

      candidates.push(meta);
      console.log(`  → 완료: ${ref.name}`);
    }
  } finally {
    await browser.close();
  }
  return candidates;
}
```

- [ ] **Step 3: `education.ts`를 업데이트한다**

`scripts/scrapers/education.ts` 전체를 아래로 교체한다 (`REGION_CODE` → `config.regionCode`만 다름):

```typescript
// scripts/scrapers/education.ts
import { chromium } from 'playwright';
import * as path from 'path';
import type { ScraperConfig, CandidateMeta } from '../types';
import { navigateToElectionList, extractCandidateRefs, downloadPdf, createPage } from './base';

export async function scrapeEducation(config: ScraperConfig, dataDir: string): Promise<CandidateMeta[]> {
  const browser = await chromium.launch({ headless: true });
  const candidates: CandidateMeta[] = [];
  try {
    const page = await createPage(browser);
    console.log(`  교육감 후보 목록 탐색 중...`);
    await navigateToElectionList(page, '교육감선거', config.regionCode);
    const refs = await extractCandidateRefs(page);
    console.log(`  교육감 후보 ${refs.length}명 발견`);

    for (const ref of refs) {
      console.log(`  수집 중: 기호${ref.ballotNumber} ${ref.name} (${ref.party})`);
      const meta: CandidateMeta = {
        name: ref.name, ballotNumber: ref.ballotNumber, party: ref.party,
        electionType: config.electionType, region: config.region, district: config.district,
        pdfUrl: ref.pdfUrl, pbinfoUrl: ref.pbinfoUrl,
        collectedAt: new Date().toISOString(),
      };

      if (ref.pdfUrl) {
        const destPath = path.join(dataDir, config.electionType, config.region, `${ref.name}.pdf`);
        try {
          await downloadPdf(ref.pdfUrl, destPath);
          meta.pdfPath = path.relative(process.cwd(), destPath);
          console.log(`    공약PDF 저장: ${meta.pdfPath}`);
        } catch (e) {
          console.log(`    공약PDF 다운로드 실패: ${(e as Error).message.slice(0, 80)}`);
        }
      }

      if (ref.pbinfoUrl) {
        const destPath = path.join(dataDir, config.electionType, config.region, `${ref.name}_공보.pdf`);
        try {
          await downloadPdf(ref.pbinfoUrl, destPath);
          meta.pbinfoPdfPath = path.relative(process.cwd(), destPath);
          console.log(`    선거공보PDF 저장: ${meta.pbinfoPdfPath}`);
        } catch (e) {
          console.log(`    선거공보PDF 다운로드 실패: ${(e as Error).message.slice(0, 80)}`);
        }
      }

      candidates.push(meta);
      console.log(`  → 완료: ${ref.name}`);
    }
  } finally {
    await browser.close();
  }
  return candidates;
}
```

- [ ] **Step 4: `mayor.ts`를 업데이트한다**

`scripts/scrapers/mayor.ts` 5번째 줄(import)과 13번째 줄(navigateToElectionList 호출)을 수정한다:

```typescript
// scripts/scrapers/mayor.ts
import { chromium } from 'playwright';
import * as path from 'path';
import type { ScraperConfig, CandidateMeta } from '../types';
import { navigateToElectionList, extractCandidateRefs, downloadPdf, createPage } from './base';

export async function scrapeMayor(config: ScraperConfig, dataDir: string): Promise<CandidateMeta[]> {
  const browser = await chromium.launch({ headless: true });
  const candidates: CandidateMeta[] = [];
  try {
    const page = await createPage(browser);
    console.log(`  시장 후보 목록 탐색 중...`);
    await navigateToElectionList(page, '구·시·군의 장선거', config.regionCode, config.cityText);
    const refs = await extractCandidateRefs(page);
    // ... 이하 동일 (candidates push 로직 변경 없음)
```

mayor.ts 전체 파일 (완성본):

```typescript
// scripts/scrapers/mayor.ts
import { chromium } from 'playwright';
import * as path from 'path';
import type { ScraperConfig, CandidateMeta } from '../types';
import { navigateToElectionList, extractCandidateRefs, downloadPdf, createPage } from './base';

export async function scrapeMayor(config: ScraperConfig, dataDir: string): Promise<CandidateMeta[]> {
  const browser = await chromium.launch({ headless: true });
  const candidates: CandidateMeta[] = [];
  try {
    const page = await createPage(browser);
    console.log(`  시장 후보 목록 탐색 중...`);
    await navigateToElectionList(page, '구·시·군의 장선거', config.regionCode, config.cityText);
    const refs = await extractCandidateRefs(page);
    console.log(`  시장 후보 ${refs.length}명 발견`);

    for (const ref of refs) {
      console.log(`  수집 중: 기호${ref.ballotNumber} ${ref.name} (${ref.party})`);
      const meta: CandidateMeta = {
        name: ref.name, ballotNumber: ref.ballotNumber, party: ref.party,
        electionType: config.electionType, region: config.region, district: config.district,
        pdfUrl: ref.pdfUrl, pbinfoUrl: ref.pbinfoUrl,
        collectedAt: new Date().toISOString(),
      };

      if (ref.pdfUrl) {
        const destPath = path.join(dataDir, config.electionType, config.region, `${ref.name}.pdf`);
        try {
          await downloadPdf(ref.pdfUrl, destPath);
          meta.pdfPath = path.relative(process.cwd(), destPath);
          console.log(`    공약PDF 저장: ${meta.pdfPath}`);
        } catch (e) {
          console.log(`    공약PDF 다운로드 실패: ${(e as Error).message.slice(0, 80)}`);
        }
      }

      if (ref.pbinfoUrl) {
        const destPath = path.join(dataDir, config.electionType, config.region, `${ref.name}_공보.pdf`);
        try {
          await downloadPdf(ref.pbinfoUrl, destPath);
          meta.pbinfoPdfPath = path.relative(process.cwd(), destPath);
          console.log(`    선거공보PDF 저장: ${meta.pbinfoPdfPath}`);
        } catch (e) {
          console.log(`    선거공보PDF 다운로드 실패: ${(e as Error).message.slice(0, 80)}`);
        }
      }

      candidates.push(meta);
      console.log(`  → 완료: ${ref.name}`);
    }
  } finally {
    await browser.close();
  }
  return candidates;
}
```

- [ ] **Step 5: `provincial.ts`를 업데이트한다**

`navigateToElectionList` 호출의 hardcoded `REGION_CODE`와 `'화성시동탄구'`를 config 필드로 교체:

```typescript
// scripts/scrapers/provincial.ts
import { chromium } from 'playwright';
import * as path from 'path';
import type { ScraperConfig, CandidateMeta } from '../types';
import { navigateToElectionList, extractCandidateRefs, downloadPdf, createPage } from './base';

export async function scrapeProvincial(config: ScraperConfig, dataDir: string): Promise<CandidateMeta[]> {
  const browser = await chromium.launch({ headless: true });
  const candidates: CandidateMeta[] = [];
  try {
    const page = await createPage(browser);
    console.log(`  도의원 후보 목록 탐색 중...`);
    await navigateToElectionList(page, '시·도의회의원선거', config.regionCode, config.cityText, config.districtText);
    const refs = await extractCandidateRefs(page);
    console.log(`  도의원 후보 ${refs.length}명 발견`);

    for (const ref of refs) {
      console.log(`  수집 중: 기호${ref.ballotNumber} ${ref.name} (${ref.party})`);
      const meta: CandidateMeta = {
        name: ref.name, ballotNumber: ref.ballotNumber, party: ref.party,
        electionType: config.electionType, region: config.region, district: config.district,
        pdfUrl: ref.pdfUrl, pbinfoUrl: ref.pbinfoUrl,
        collectedAt: new Date().toISOString(),
      };

      if (ref.pdfUrl) {
        const destPath = path.join(dataDir, config.electionType, config.region, `${ref.name}.pdf`);
        try {
          await downloadPdf(ref.pdfUrl, destPath);
          meta.pdfPath = path.relative(process.cwd(), destPath);
          console.log(`    공약PDF 저장: ${meta.pdfPath}`);
        } catch (e) {
          console.log(`    공약PDF 다운로드 실패: ${(e as Error).message.slice(0, 80)}`);
        }
      }

      if (ref.pbinfoUrl) {
        const destPath = path.join(dataDir, config.electionType, config.region, `${ref.name}_공보.pdf`);
        try {
          await downloadPdf(ref.pbinfoUrl, destPath);
          meta.pbinfoPdfPath = path.relative(process.cwd(), destPath);
          console.log(`    선거공보PDF 저장: ${meta.pbinfoPdfPath}`);
        } catch (e) {
          console.log(`    선거공보PDF 다운로드 실패: ${(e as Error).message.slice(0, 80)}`);
        }
      }

      candidates.push(meta);
      console.log(`  → 완료: ${ref.name}`);
    }
  } finally {
    await browser.close();
  }
  return candidates;
}
```

- [ ] **Step 6: `municipal.ts`를 업데이트한다**

provincial.ts와 동일한 패턴. 탭명만 `'구·시·군의회의원선거'`로 다름:

```typescript
// scripts/scrapers/municipal.ts
import { chromium } from 'playwright';
import * as path from 'path';
import type { ScraperConfig, CandidateMeta } from '../types';
import { navigateToElectionList, extractCandidateRefs, downloadPdf, createPage } from './base';

export async function scrapeMunicipal(config: ScraperConfig, dataDir: string): Promise<CandidateMeta[]> {
  const browser = await chromium.launch({ headless: true });
  const candidates: CandidateMeta[] = [];
  try {
    const page = await createPage(browser);
    console.log(`  시의원 후보 목록 탐색 중...`);
    await navigateToElectionList(page, '구·시·군의회의원선거', config.regionCode, config.cityText, config.districtText);
    const refs = await extractCandidateRefs(page);
    console.log(`  시의원 후보 ${refs.length}명 발견`);

    for (const ref of refs) {
      console.log(`  수집 중: 기호${ref.ballotNumber} ${ref.name} (${ref.party})`);
      const meta: CandidateMeta = {
        name: ref.name, ballotNumber: ref.ballotNumber, party: ref.party,
        electionType: config.electionType, region: config.region, district: config.district,
        pdfUrl: ref.pdfUrl, pbinfoUrl: ref.pbinfoUrl,
        collectedAt: new Date().toISOString(),
      };

      if (ref.pdfUrl) {
        const destPath = path.join(dataDir, config.electionType, config.region, `${ref.name}.pdf`);
        try {
          await downloadPdf(ref.pdfUrl, destPath);
          meta.pdfPath = path.relative(process.cwd(), destPath);
          console.log(`    공약PDF 저장: ${meta.pdfPath}`);
        } catch (e) {
          console.log(`    공약PDF 다운로드 실패: ${(e as Error).message.slice(0, 80)}`);
        }
      }

      if (ref.pbinfoUrl) {
        const destPath = path.join(dataDir, config.electionType, config.region, `${ref.name}_공보.pdf`);
        try {
          await downloadPdf(ref.pbinfoUrl, destPath);
          meta.pbinfoPdfPath = path.relative(process.cwd(), destPath);
          console.log(`    선거공보PDF 저장: ${meta.pbinfoPdfPath}`);
        } catch (e) {
          console.log(`    선거공보PDF 다운로드 실패: ${(e as Error).message.slice(0, 80)}`);
        }
      }

      candidates.push(meta);
      console.log(`  → 완료: ${ref.name}`);
    }
  } finally {
    await browser.close();
  }
  return candidates;
}
```

- [ ] **Step 7: 타입 체크를 실행한다**

```bash
npx tsc --noEmit
```

Expected: 오류 없음.

- [ ] **Step 8: 커밋한다**

```bash
git add scripts/scrapers/base.ts scripts/scrapers/governor.ts scripts/scrapers/education.ts \
        scripts/scrapers/mayor.ts scripts/scrapers/provincial.ts scripts/scrapers/municipal.ts
git commit -m "refactor: remove hardcoded REGION_CODE and city names from scrapers"
```

---

## Task 3: collect.ts — REGION_CODES 테이블 + `--config-json` 플래그

**Files:**
- Modify: `scripts/collect.ts`
- Create: `tests/collect.test.ts`

- [ ] **Step 1: 실패하는 테스트를 먼저 작성한다**

`tests/collect.test.ts`를 생성한다:

```typescript
// tests/collect.test.ts
import { describe, it, expect } from 'vitest';
import { parseConfigJson, REGION_CODES } from '../scripts/collect';

describe('REGION_CODES', () => {
  it('경기도 코드가 4100이다', () => {
    expect(REGION_CODES['경기도']).toBe('4100');
  });

  it('17개 시도를 모두 포함한다', () => {
    expect(Object.keys(REGION_CODES)).toHaveLength(17);
  });

  it('서울특별시 코드가 1100이다', () => {
    expect(REGION_CODES['서울특별시']).toBe('1100');
  });
});

describe('parseConfigJson', () => {
  it('유효한 JSON 배열을 ScraperConfig[]로 반환한다', () => {
    const configs = [
      { electionType: '도지사', regionCode: '1100', region: '서울특별시', district: '서울특별시' }
    ];
    expect(parseConfigJson(JSON.stringify(configs))).toEqual(configs);
  });

  it('배열이 아닌 JSON은 오류를 던진다', () => {
    expect(() => parseConfigJson('{"key":"value"}')).toThrow('--config-json 값은 배열이어야 합니다');
  });

  it('잘못된 JSON 문자열은 SyntaxError를 던진다', () => {
    expect(() => parseConfigJson('not-json')).toThrow(SyntaxError);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

```bash
npx vitest run tests/collect.test.ts
```

Expected: FAIL — `REGION_CODES`, `parseConfigJson`이 collect.ts에서 export되지 않아 import 오류 발생.

- [ ] **Step 3: `collect.ts`에 `REGION_CODES`와 `parseConfigJson`을 추가한다**

`scripts/collect.ts` 파일 상단 import 아래 (`DATA_DIR` 선언 앞)에 추가:

```typescript
export const REGION_CODES: Record<string, string> = {
  '서울특별시': '1100',
  '부산광역시': '2600',
  '대구광역시': '2700',
  '인천광역시': '2800',
  '광주광역시': '2900',
  '대전광역시': '3000',
  '울산광역시': '3100',
  '세종특별자치시': '3600',
  '경기도': '4100',
  '강원특별자치도': '4200',
  '충청북도': '4300',
  '충청남도': '4400',
  '전북특별자치도': '4500',
  '전라남도': '4600',
  '경상북도': '4700',
  '경상남도': '4800',
  '제주특별자치도': '5000',
};

export function parseConfigJson(json: string): ScraperConfig[] {
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) throw new Error('--config-json 값은 배열이어야 합니다');
  return parsed as ScraperConfig[];
}
```

- [ ] **Step 4: `main()` 함수에 `--config-json` 플래그 처리를 추가한다**

`collect.ts`의 `main()` 함수 첫 부분을 아래로 교체한다:

```typescript
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const configJsonIdx = args.indexOf('--config-json');
  const typeIdx = args.indexOf('--type');

  let configs: ScraperConfig[];

  if (configJsonIdx !== -1) {
    const configJsonArg = args[configJsonIdx + 1];
    if (!configJsonArg) {
      console.error('오류: --config-json 뒤에 JSON 배열을 입력해주세요');
      process.exit(1);
    }
    try {
      configs = parseConfigJson(configJsonArg);
    } catch (err) {
      console.error('오류: --config-json 파싱 실패:', (err as Error).message);
      process.exit(1);
    }
  } else {
    const typeArg = typeIdx !== -1 ? (args[typeIdx + 1] as ElectionType) : undefined;
    configs = typeArg
      ? DONGTAN5_CONFIGS.filter((c) => c.electionType === typeArg)
      : DONGTAN5_CONFIGS;

    if (configs.length === 0) {
      console.error(`오류: 알 수 없는 선거 유형 "${typeArg}"`);
      console.error(`가능한 값: ${DONGTAN5_CONFIGS.map((c) => c.electionType).join(', ')}`);
      process.exit(1);
    }
  }

  console.log(`\n=== PolLens 데이터 수집 시작 ===`);
  console.log(`대상: ${configs.map((c) => `${c.electionType}(${c.district})`).join(', ')}\n`);

  const succeeded: ElectionType[] = [];
  const failed: ElectionType[] = [];
  const allCandidates: CandidateMeta[] = [];

  for (const config of configs) {
    console.log(`\n[${config.electionType}] ${config.district} 수집 중...`);
    try {
      const candidates = await runScraper(config);
      allCandidates.push(...candidates);
      console.log(`[${config.electionType}] ✓ 완료 (${candidates.length}명)`);
      succeeded.push(config.electionType);
    } catch (err) {
      console.error(`[${config.electionType}] ✗ 실패:`, err);
      failed.push(config.electionType);
    }
  }

  if (succeeded.length > 0) {
    updateMeta(DATA_DIR, succeeded, allCandidates);
  }

  console.log(`\n=== 수집 완료 ===`);
  console.log(`성공: ${succeeded.join(', ') || '없음'} (총 ${allCandidates.length}명)`);
  if (failed.length > 0) {
    console.log(`실패: ${failed.join(', ')}`);
    process.exit(1);
  }
}
```

- [ ] **Step 5: 테스트를 다시 실행해 통과하는지 확인한다**

```bash
npx vitest run tests/collect.test.ts
```

Expected: PASS — 3개 describe, 5개 it 모두 통과.

- [ ] **Step 6: 전체 테스트를 실행해 기존 테스트가 깨지지 않았는지 확인한다**

```bash
npx vitest run
```

Expected: 기존 cache.test.ts 등 모두 통과.

- [ ] **Step 7: 타입 체크를 실행한다**

```bash
npx tsc --noEmit
```

Expected: 오류 없음.

- [ ] **Step 8: 커밋한다**

```bash
git add scripts/collect.ts tests/collect.test.ts
git commit -m "feat: add --config-json flag and REGION_CODES table to collect.ts"
```

---

## Task 4: resolve-district.ts 생성 (Path B Playwright 모듈)

**Files:**
- Create: `scripts/resolve-district.ts`
- Create: `tests/resolve-district.test.ts`

- [ ] **Step 1: 타입과 순수 함수 `parseDistrictResult`의 실패 테스트를 먼저 작성한다**

`tests/resolve-district.test.ts`를 생성한다:

```typescript
// tests/resolve-district.test.ts
import { describe, it, expect } from 'vitest';
import { parseDistrictResult } from '../scripts/resolve-district';
import type { DistrictRow } from '../scripts/resolve-district';

describe('parseDistrictResult', () => {
  const mockRows: DistrictRow[] = [
    { electionName: '시·도의회의원선거', districtCity: '화성시동탄구', districtName: '화성시제3선거구' },
    { electionName: '구·시·군의회의원선거', districtCity: '화성시동탄구', districtName: '화성시다선거구' },
    { electionName: '시·도지사선거', districtCity: '', districtName: '경기도' },
  ];

  it('도의원 선거구를 추출한다', () => {
    const result = parseDistrictResult(mockRows, '화성시');
    expect(result.provincialDistrict).toBe('화성시제3선거구');
  });

  it('시의원 선거구를 추출한다', () => {
    const result = parseDistrictResult(mockRows, '화성시');
    expect(result.municipalDistrict).toBe('화성시다선거구');
  });

  it('districtCityText는 도의원 행의 districtCity를 사용한다', () => {
    const result = parseDistrictResult(mockRows, '화성시');
    expect(result.districtCityText).toBe('화성시동탄구');
  });

  it('mayorCityText는 전달된 sigungu를 그대로 사용한다', () => {
    const result = parseDistrictResult(mockRows, '화성시');
    expect(result.mayorCityText).toBe('화성시');
  });

  it('도의원 행이 없으면 오류를 던진다', () => {
    const rowsWithoutProvincial = mockRows.filter(r => r.electionName !== '시·도의회의원선거');
    expect(() => parseDistrictResult(rowsWithoutProvincial, '화성시')).toThrow('도의원 선거구를 찾을 수 없습니다');
  });

  it('시의원 행이 없으면 오류를 던진다', () => {
    const rowsWithoutMunicipal = mockRows.filter(r => r.electionName !== '구·시·군의회의원선거');
    expect(() => parseDistrictResult(rowsWithoutMunicipal, '화성시')).toThrow('시의원 선거구를 찾을 수 없습니다');
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

```bash
npx vitest run tests/resolve-district.test.ts
```

Expected: FAIL — `resolve-district.ts` 파일 없음.

- [ ] **Step 3: `scripts/resolve-district.ts`를 생성한다**

```typescript
// scripts/resolve-district.ts
import { chromium } from 'playwright';
import { REGION_CODES } from './collect';

export const DISTRICT_LOOKUP_URL =
  'https://info.nec.go.kr/bizcommon/popup/popup_search_sg_emd.xhtml?electionId=0020260603';

export interface DistrictRow {
  electionName: string;
  districtCity: string;
  districtName: string;
}

export interface ResolvedDistricts {
  sido: string;
  sigungu: string;
  regionCode: string;
  mayorCityText: string;
  districtCityText: string;
  provincialDistrict: string;
  municipalDistrict: string;
}

export function parseDistrictResult(
  rows: DistrictRow[],
  sigungu: string
): Omit<ResolvedDistricts, 'sido' | 'sigungu' | 'regionCode'> {
  const provincial = rows.find((r) => r.electionName === '시·도의회의원선거');
  if (!provincial) throw new Error('도의원 선거구를 찾을 수 없습니다');

  const municipal = rows.find((r) => r.electionName === '구·시·군의회의원선거');
  if (!municipal) throw new Error('시의원 선거구를 찾을 수 없습니다');

  return {
    mayorCityText: sigungu,
    districtCityText: provincial.districtCity || sigungu,
    provincialDistrict: provincial.districtName,
    municipalDistrict: municipal.districtName,
  };
}

/**
 * Playwright로 info.nec.go.kr를 탐색해 읍/면/동 기준 선거구를 반환한다.
 * 실제 DOM 구조는 사이트 접속 후 확인 필요. 아래는 예상 구조 기반 구현.
 */
export async function resolveDistrictByAddress(
  sido: string,
  sigungu: string,
  emd: string
): Promise<ResolvedDistricts> {
  const regionCode = REGION_CODES[sido];
  if (!regionCode) {
    throw new Error(`알 수 없는 시도: "${sido}". 가능한 값: ${Object.keys(REGION_CODES).join(', ')}`);
  }

  const browser = await chromium.launch({ headless: false });
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    console.log(`  선거구 조회 중: ${sido} ${sigungu} ${emd}`);
    await page.goto(DISTRICT_LOOKUP_URL, { waitUntil: 'networkidle', timeout: 30_000 });

    // 읍면동 검색 입력
    // 주의: 실제 DOM selector는 사이트 접속 후 확인 필요
    await page.waitForSelector('input[type="text"]', { timeout: 10_000 });
    await page.fill('input[type="text"]', emd);
    await page.click('button[type="submit"], input[type="submit"]');
    await page.waitForTimeout(1_000);

    // 결과 테이블에서 행 추출
    // 주의: 실제 테이블 selector는 사이트 접속 후 확인 필요
    const rows = await page.$$eval('table tbody tr', (trs) =>
      trs.map((tr) => {
        const cells = Array.from(tr.querySelectorAll('td'));
        return {
          electionName: cells[0]?.textContent?.trim() ?? '',
          districtCity: cells[1]?.textContent?.trim() ?? '',
          districtName: cells[2]?.textContent?.trim() ?? '',
        };
      })
    );

    const partial = parseDistrictResult(rows, sigungu);
    return { sido, sigungu, regionCode, ...partial };
  } finally {
    await browser.close();
  }
}
```

- [ ] **Step 4: 테스트를 실행해 순수 함수 테스트가 통과하는지 확인한다**

```bash
npx vitest run tests/resolve-district.test.ts
```

Expected: PASS — 6개 it 모두 통과.

- [ ] **Step 5: 전체 테스트를 실행한다**

```bash
npx vitest run
```

Expected: 모든 테스트 통과.

- [ ] **Step 6: 타입 체크를 실행한다**

```bash
npx tsc --noEmit
```

Expected: 오류 없음.

- [ ] **Step 7: 커밋한다**

```bash
git add scripts/resolve-district.ts tests/resolve-district.test.ts
git commit -m "feat: add resolve-district.ts for Playwright-based district lookup (Path B)"
```

---

## Task 5: `.claude/commands/pollens-collect.md` 개정

**Files:**
- Modify: `.claude/commands/pollens-collect.md`

- [ ] **Step 1: 스킬 파일 전체를 Path A/B 선택 흐름으로 교체한다**

`.claude/commands/pollens-collect.md` 전체를 아래 내용으로 교체한다:

```markdown
# /pollens-collect — PolLens 데이터 수집

2026-06-03 지방선거 후보 공약 데이터를 중앙선거관리위원회(policy.nec.go.kr)에서 수집하여
`/Users/mksoo/Documents/dev/tmp/PolLens/data/` 에 저장한다.

---

## 실행

먼저 다음 메시지를 출력한다:

```
선거구를 어떻게 찾을까요?

A) 직접 입력
   아래 링크에서 읍/면/동을 검색하면 선거구 정보가 나옵니다.
   → https://info.nec.go.kr/bizcommon/popup/popup_search_sg_emd.xhtml?electionId=0020260603
   결과 내용을 복사해서 붙여넣어 주세요.

B) 자동 탐색
   주소만 알려주면 위 사이트를 자동으로 탐색합니다.
   (Playwright 사용, 토큰 추가 소모)
```

---

## Path A — 직접 입력

사용자가 NEC 사이트 결과를 붙여넣으면 다음을 파싱한다:
- 시도명 (예: "경기도") → `scripts/collect.ts`의 `REGION_CODES` 테이블로 region code 조회
- 시군구명 (예: "화성시") → 시장·도의원·시의원 스크래퍼의 `cityText`
- 시군구+구 조합 (예: "화성시동탄구") → 도의원·시의원 스크래퍼의 `cityText` (districtCityText)
- 도의원 선거구명 (예: "화성시제3선거구") → 도의원 `districtText`
- 시의원 선거구명 (예: "화성시다선거구") → 시의원 `districtText`

파싱 후 아래 명령을 실행한다 (JSON은 실제 파싱 결과로 채운다):

```bash
cd /Users/mksoo/Documents/dev/tmp/PolLens && npx ts-node scripts/collect.ts --config-json '[
  {"electionType":"도지사","regionCode":"<regionCode>","region":"<sido>","district":"<sido>"},
  {"electionType":"시장","regionCode":"<regionCode>","region":"<sigungu>","district":"<sigungu>","cityText":"<sigungu>"},
  {"electionType":"도의원","regionCode":"<regionCode>","region":"<sido>","district":"<provincialDistrict>","cityText":"<districtCityText>","districtText":"<provincialDistrict>"},
  {"electionType":"시의원","regionCode":"<regionCode>","region":"<sigungu>","district":"<municipalDistrict>","cityText":"<districtCityText>","districtText":"<municipalDistrict>"},
  {"electionType":"교육감","regionCode":"<regionCode>","region":"<sido>","district":"<sido>"}
]'
```

---

## Path B — 자동 탐색

다음 경고를 먼저 출력한다:

```
Playwright로 선관위 사이트를 탐색합니다. 추가 토큰이 소모됩니다.
```

그런 다음 사용자에게 순서대로 질문한다:
1. 시도 (예: 경기도)
2. 시군구 (예: 화성시)
3. 읍/면/동 (예: 동탄5동)

입력 완료 후 아래 명령을 실행한다:

```bash
cd /Users/mksoo/Documents/dev/tmp/PolLens && npx ts-node -e "
const { resolveDistrictByAddress } = require('./scripts/resolve-district');
resolveDistrictByAddress('<sido>', '<sigungu>', '<emd>').then(r => console.log(JSON.stringify(r)));
"
```

출력된 JSON을 파싱해 Path A와 동일한 `--config-json` 형식으로 collect.ts를 실행한다.

---

## 완료 후 안내

명령이 성공적으로 완료되면 다음을 출력한다:

```
✅ 수집 완료!
저장 위치: /Users/mksoo/Documents/dev/tmp/PolLens/data/

후보 공약을 분석하려면 /pollens 스킬을 실행하세요.
```

오류가 발생하면 오류 메시지를 그대로 출력하고 원인을 설명한다.
```

- [ ] **Step 2: 커밋한다**

```bash
git add .claude/commands/pollens-collect.md
git commit -m "feat: rewrite /pollens-collect with Path A/B address-based district selection"
```

---

## 최종 검증

- [ ] **전체 테스트 통과 확인**

```bash
npx vitest run
```

Expected: 전체 통과.

- [ ] **타입 체크**

```bash
npx tsc --noEmit
```

Expected: 오류 없음.

- [ ] **하위 호환 확인**: `npm run collect`가 동탄5동 기준으로 여전히 동작하는지 dry-run 확인

```bash
node -e "
const { DONGTAN5_CONFIGS } = require('./scripts/collect');
console.log('configs:', JSON.stringify(DONGTAN5_CONFIGS, null, 2));
" 2>/dev/null || npx ts-node -e "import { REGION_CODES } from './scripts/collect'; console.log('REGION_CODES 로드 성공, 경기도:', REGION_CODES['경기도']);"
```

Expected: `경기도: 4100` 출력.
