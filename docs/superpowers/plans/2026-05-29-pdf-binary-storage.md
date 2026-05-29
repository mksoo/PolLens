# PDF 바이너리 저장 + meta.json 통합 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PDF를 수집 시 바이너리로 저장하고, 후보 메타데이터를 meta.json 하나에 통합한다.

**Architecture:** 스크래퍼는 PDF를 `data/<선거>/<지역>/<이름>.pdf`로 저장하고, `CandidateMeta[]`를 반환한다. `collect.ts`가 모든 후보를 취합해 `meta.json`에 통합 저장한다. `/pollens` 스킬은 `meta.json`에서 후보 목록을 읽은 뒤 각 PDF 파일을 Claude의 Read 도구로 직접 열람한다.

**Tech Stack:** TypeScript, ts-node, Playwright, Vitest. `pdf-parse` 의존성 제거.

---

## 파일 맵

| 파일 | 변경 |
|------|------|
| `scripts/types.ts` | `RawCandidate` 제거, `CandidateMeta` 신규, `CacheMeta`에 `candidates[]` 추가 |
| `scripts/cache.ts` | `updateMeta` 시그니처 변경 (candidates 포함) |
| `scripts/scrapers/base.ts` | `downloadPdfText` → `downloadPdf(url, destPath)` |
| `scripts/scrapers/governor.ts` | `CandidateMeta[]` 반환, `downloadPdf` 사용 |
| `scripts/scrapers/mayor.ts` | 동일 |
| `scripts/scrapers/provincial.ts` | 동일 |
| `scripts/scrapers/municipal.ts` | 동일 |
| `scripts/scrapers/education.ts` | 동일 |
| `scripts/collect.ts` | candidates 취합 후 `updateMeta` 호출 |
| `scripts/mdWriter.ts` | **삭제** |
| `tests/mdWriter.test.ts` | **삭제** |
| `tests/cache.test.ts` | candidates 케이스 추가 |
| `tests/base.test.ts` | **신규**: `downloadPdf` 테스트 |
| `.claude/commands/pollens.md` | meta.json + PDF Read 방식으로 재작성 |
| `package.json` | `pdf-parse` 제거 |
| `CLAUDE.md` | 아키텍처 설명 업데이트 |

---

### Task 1: types.ts 업데이트

**Files:**
- Modify: `scripts/types.ts`

- [ ] **Step 1: types.ts 전체 교체**

```typescript
// scripts/types.ts

export type ElectionType = '도지사' | '시장' | '도의원' | '시의원' | '교육감';

export interface ScraperConfig {
  electionType: ElectionType;
  region: string;
  district: string;
}

export interface CandidateRef {
  name: string;
  ballotNumber: number;
  party: string;
  /** P5_PRMS_PUB 텍스트 PDF URL. 없으면 undefined */
  pdfUrl?: string;
  /** PBINFO 선거공보 이미지 PDF URL */
  pbinfoUrl?: string;
}

export interface CandidateMeta {
  name: string;
  ballotNumber: number;
  party: string;
  electionType: ElectionType;
  region: string;
  district: string;
  /** 프로젝트 루트 기준 상대 경로 (P5_PRMS_PUB) */
  pdfPath?: string;
  /** 프로젝트 루트 기준 상대 경로 (PBINFO) */
  pbinfoPdfPath?: string;
  /** 원본 CDN URL (직접 열람용) */
  pdfUrl?: string;
  pbinfoUrl?: string;
  collectedAt: string;
}

export interface CacheMeta {
  collectedAt: string;
  elections: ElectionType[];
  candidates: CandidateMeta[];
}
```

- [ ] **Step 2: 타입 체크**

```bash
npx tsc --noEmit
```

예상: 컴파일 오류 다수 (RawCandidate 사용처 미업데이트). 정상. Task 5까지 오류 지속.

- [ ] **Step 3: 커밋**

```bash
git add scripts/types.ts
git commit -m "refactor(types): replace RawCandidate with CandidateMeta, add candidates to CacheMeta"
```

---

### Task 2: cache.ts 업데이트

**Files:**
- Modify: `scripts/cache.ts`
- Modify: `tests/cache.test.ts`

- [ ] **Step 1: cache.test.ts에 candidates 테스트 추가**

파일 끝에 다음 블록을 추가한다:

```typescript
describe('updateMeta with candidates', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pollens-cand-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('candidates 배열을 meta.json에 저장한다', () => {
    const candidate = {
      name: '홍길동',
      ballotNumber: 1,
      party: '무소속',
      electionType: '도지사' as const,
      region: '경기도',
      district: '경기도',
      pdfPath: 'data/도지사/경기도/홍길동.pdf',
      collectedAt: new Date().toISOString(),
    };
    updateMeta(tmpDir, ['도지사'], [candidate]);
    const meta = readMeta(tmpDir);
    expect(meta?.candidates).toHaveLength(1);
    expect(meta?.candidates[0].name).toBe('홍길동');
    expect(meta?.candidates[0].pdfPath).toBe('data/도지사/경기도/홍길동.pdf');
  });

  it('candidates가 없으면 빈 배열로 저장한다', () => {
    updateMeta(tmpDir, ['시장'], []);
    const meta = readMeta(tmpDir);
    expect(meta?.candidates).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npx vitest run tests/cache.test.ts
```

예상: `updateMeta` 시그니처 불일치로 타입 오류 또는 런타임 실패.

- [ ] **Step 3: cache.ts 업데이트**

```typescript
// scripts/cache.ts
import * as fs from 'fs';
import * as path from 'path';
import type { CacheMeta, CandidateMeta, ElectionType } from './types';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function getMetaPath(dataDir: string): string {
  return path.join(dataDir, 'meta.json');
}

export function isCacheValid(dataDir: string): boolean {
  const metaPath = getMetaPath(dataDir);
  if (!fs.existsSync(metaPath)) return false;
  const meta: CacheMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  return Date.now() - new Date(meta.collectedAt).getTime() < CACHE_TTL_MS;
}

export function updateMeta(dataDir: string, elections: ElectionType[], candidates: CandidateMeta[]): void {
  fs.mkdirSync(dataDir, { recursive: true });
  const meta: CacheMeta = {
    collectedAt: new Date().toISOString(),
    elections,
    candidates,
  };
  fs.writeFileSync(getMetaPath(dataDir), JSON.stringify(meta, null, 2), 'utf-8');
}

export function readMeta(dataDir: string): CacheMeta | null {
  const metaPath = getMetaPath(dataDir);
  if (!fs.existsSync(metaPath)) return null;
  return JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as CacheMeta;
}
```

- [ ] **Step 4: 기존 cache.test.ts의 updateMeta 호출도 수정**

`tests/cache.test.ts` 내 기존 `updateMeta(tmpDir, ['도지사', '시장'])` 호출을 전부 `updateMeta(tmpDir, ['도지사', '시장'], [])` 로 변경한다 (3곳).

- [ ] **Step 5: 테스트 실행 — 전부 통과 확인**

```bash
npx vitest run tests/cache.test.ts
```

예상: PASS (모든 케이스)

- [ ] **Step 6: 커밋**

```bash
git add scripts/cache.ts tests/cache.test.ts
git commit -m "feat(cache): updateMeta now stores candidates[], add candidates tests"
```

---

### Task 3: base.ts — downloadPdf 추가

**Files:**
- Modify: `scripts/scrapers/base.ts`
- Create: `tests/base.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// tests/base.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { downloadPdf } from '../scripts/scrapers/base';

describe('downloadPdf', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pollens-base-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
    vi.restoreAllMocks();
  });

  it('PDF를 지정 경로에 저장한다', async () => {
    const fakeBytes = Buffer.from('%PDF-1.4 fake content');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => fakeBytes.buffer,
    }) as unknown as typeof fetch;

    const destPath = path.join(tmpDir, 'sub', '추미애.pdf');
    await downloadPdf('https://cdn.nec.go.kr/test.pdf', destPath);

    expect(fs.existsSync(destPath)).toBe(true);
    expect(fs.readFileSync(destPath)).toEqual(fakeBytes);
  });

  it('중간 디렉토리가 없어도 생성한다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from('x').buffer,
    }) as unknown as typeof fetch;

    const destPath = path.join(tmpDir, 'a', 'b', 'c', 'test.pdf');
    await downloadPdf('https://cdn.nec.go.kr/test.pdf', destPath);
    expect(fs.existsSync(destPath)).toBe(true);
  });

  it('HTTP 오류 시 에러를 던진다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }) as unknown as typeof fetch;

    await expect(
      downloadPdf('https://cdn.nec.go.kr/notfound.pdf', path.join(tmpDir, 'test.pdf'))
    ).rejects.toThrow('PDF 다운로드 실패: 404');
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npx vitest run tests/base.test.ts
```

예상: FAIL — `downloadPdf` not exported from base.ts

- [ ] **Step 3: base.ts에 downloadPdf 추가, downloadPdfText 제거**

`scripts/scrapers/base.ts` 에서 `downloadPdfText` 함수 전체를 아래로 교체한다:

```typescript
/**
 * CDN에서 PDF를 다운로드해 destPath에 바이너리 그대로 저장한다.
 * 중간 디렉토리가 없으면 자동 생성한다.
 */
export async function downloadPdf(pdfUrl: string, destPath: string): Promise<void> {
  const response = await fetch(pdfUrl);
  if (!response.ok) {
    throw new Error(`PDF 다운로드 실패: ${response.status} ${pdfUrl}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, buffer);
}
```

파일 상단에 import를 추가한다:

```typescript
import * as fs from 'fs';
import * as path from 'path';
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
npx vitest run tests/base.test.ts
```

예상: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add scripts/scrapers/base.ts tests/base.test.ts
git commit -m "feat(base): replace downloadPdfText with downloadPdf (binary save)"
```

---

### Task 4: 스크래퍼 5개 업데이트

**Files:**
- Modify: `scripts/scrapers/governor.ts`, `mayor.ts`, `provincial.ts`, `municipal.ts`, `education.ts`

각 스크래퍼는 동일한 패턴으로 변경된다. 아래는 `governor.ts` 전체 예시이며, 나머지 4개도 같은 패턴을 적용한다.

- [ ] **Step 1: governor.ts 전체 교체**

```typescript
// scripts/scrapers/governor.ts
import { chromium } from 'playwright';
import * as path from 'path';
import type { ScraperConfig, CandidateMeta } from '../types';
import { navigateToElectionList, extractCandidateRefs, downloadPdf, createPage, REGION_CODE } from './base';

export async function scrapeGovernor(config: ScraperConfig, dataDir: string): Promise<CandidateMeta[]> {
  const browser = await chromium.launch({ headless: true });
  const candidates: CandidateMeta[] = [];
  try {
    const page = await createPage(browser);
    console.log(`  도지사 후보 목록 탐색 중...`);
    await navigateToElectionList(page, '시·도지사선거', REGION_CODE);
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

- [ ] **Step 2: mayor.ts 전체 교체**

```typescript
// scripts/scrapers/mayor.ts
import { chromium } from 'playwright';
import * as path from 'path';
import type { ScraperConfig, CandidateMeta } from '../types';
import { navigateToElectionList, extractCandidateRefs, downloadPdf, createPage, REGION_CODE } from './base';

export async function scrapeMayor(config: ScraperConfig, dataDir: string): Promise<CandidateMeta[]> {
  const browser = await chromium.launch({ headless: true });
  const candidates: CandidateMeta[] = [];
  try {
    const page = await createPage(browser);
    console.log(`  시장 후보 목록 탐색 중...`);
    await navigateToElectionList(page, '구·시·군의 장선거', REGION_CODE, '화성시');
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

- [ ] **Step 3: provincial.ts 전체 교체**

```typescript
// scripts/scrapers/provincial.ts
import { chromium } from 'playwright';
import * as path from 'path';
import type { ScraperConfig, CandidateMeta } from '../types';
import { navigateToElectionList, extractCandidateRefs, downloadPdf, createPage, REGION_CODE } from './base';

export async function scrapeProvincial(config: ScraperConfig, dataDir: string): Promise<CandidateMeta[]> {
  const browser = await chromium.launch({ headless: true });
  const candidates: CandidateMeta[] = [];
  try {
    const page = await createPage(browser);
    console.log(`  도의원 후보 목록 탐색 중...`);
    await navigateToElectionList(page, '시·도의회의원선거', REGION_CODE, '화성시동탄구', config.district);
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

- [ ] **Step 4: municipal.ts 전체 교체**

```typescript
// scripts/scrapers/municipal.ts
import { chromium } from 'playwright';
import * as path from 'path';
import type { ScraperConfig, CandidateMeta } from '../types';
import { navigateToElectionList, extractCandidateRefs, downloadPdf, createPage, REGION_CODE } from './base';

export async function scrapeMunicipal(config: ScraperConfig, dataDir: string): Promise<CandidateMeta[]> {
  const browser = await chromium.launch({ headless: true });
  const candidates: CandidateMeta[] = [];
  try {
    const page = await createPage(browser);
    console.log(`  시의원 후보 목록 탐색 중...`);
    await navigateToElectionList(page, '구·시·군의회의원선거', REGION_CODE, '화성시동탄구', config.district);
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

- [ ] **Step 5: education.ts 전체 교체**

```typescript
// scripts/scrapers/education.ts
import { chromium } from 'playwright';
import * as path from 'path';
import type { ScraperConfig, CandidateMeta } from '../types';
import { navigateToElectionList, extractCandidateRefs, downloadPdf, createPage, REGION_CODE } from './base';

export async function scrapeEducation(config: ScraperConfig, dataDir: string): Promise<CandidateMeta[]> {
  const browser = await chromium.launch({ headless: true });
  const candidates: CandidateMeta[] = [];
  try {
    const page = await createPage(browser);
    console.log(`  교육감 후보 목록 탐색 중...`);
    await navigateToElectionList(page, '교육감선거', REGION_CODE);
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

- [ ] **Step 6: 타입 체크**

```bash
npx tsc --noEmit
```

예상: collect.ts에서 오류 (반환 타입 불일치). 다음 Task에서 수정.

- [ ] **Step 7: 커밋**

```bash
git add scripts/scrapers/governor.ts scripts/scrapers/mayor.ts scripts/scrapers/provincial.ts scripts/scrapers/municipal.ts scripts/scrapers/education.ts
git commit -m "refactor(scrapers): download PDFs as binary, return CandidateMeta[]"
```

---

### Task 5: collect.ts 업데이트

**Files:**
- Modify: `scripts/collect.ts`

- [ ] **Step 1: collect.ts 전체 교체**

```typescript
// scripts/collect.ts
import * as path from 'path';
import { updateMeta } from './cache';
import { scrapeGovernor } from './scrapers/governor';
import { scrapeMayor } from './scrapers/mayor';
import { scrapeProvincial } from './scrapers/provincial';
import { scrapeMunicipal } from './scrapers/municipal';
import { scrapeEducation } from './scrapers/education';
import type { ElectionType, ScraperConfig, CandidateMeta } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');

const DONGTAN5_CONFIGS: ScraperConfig[] = [
  { electionType: '도지사',  region: '경기도',  district: '경기도' },
  { electionType: '시장',    region: '화성시',  district: '화성시' },
  { electionType: '도의원',  region: '경기도',  district: '화성시제3선거구' },
  { electionType: '시의원',  region: '화성시',  district: '화성시다선거구' },
  { electionType: '교육감',  region: '경기도',  district: '경기도' },
];

async function runScraper(config: ScraperConfig): Promise<CandidateMeta[]> {
  switch (config.electionType) {
    case '도지사':  return scrapeGovernor(config, DATA_DIR);
    case '시장':    return scrapeMayor(config, DATA_DIR);
    case '도의원':  return scrapeProvincial(config, DATA_DIR);
    case '시의원':  return scrapeMunicipal(config, DATA_DIR);
    case '교육감':  return scrapeEducation(config, DATA_DIR);
    default:
      throw new Error(`알 수 없는 선거 유형: ${config.electionType}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const typeIdx = args.indexOf('--type');
  const typeArg = typeIdx !== -1 ? (args[typeIdx + 1] as ElectionType) : undefined;

  const configs = typeArg
    ? DONGTAN5_CONFIGS.filter((c) => c.electionType === typeArg)
    : DONGTAN5_CONFIGS;

  if (configs.length === 0) {
    console.error(`오류: 알 수 없는 선거 유형 "${typeArg}"`);
    console.error(`가능한 값: ${DONGTAN5_CONFIGS.map((c) => c.electionType).join(', ')}`);
    process.exit(1);
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

main().catch((err) => {
  console.error('예상치 못한 오류:', err);
  process.exit(1);
});
```

- [ ] **Step 2: 타입 체크 — 오류 없음 확인**

```bash
npx tsc --noEmit
```

예상: 오류 없음

- [ ] **Step 3: 커밋**

```bash
git add scripts/collect.ts
git commit -m "feat(collect): accumulate CandidateMeta[] and pass to updateMeta"
```

---

### Task 6: mdWriter 삭제 + pdf-parse 제거

**Files:**
- Delete: `scripts/mdWriter.ts`
- Delete: `tests/mdWriter.test.ts`
- Modify: `package.json`

- [ ] **Step 1: 파일 삭제**

```bash
rm scripts/mdWriter.ts tests/mdWriter.test.ts
```

- [ ] **Step 2: pdf-parse 의존성 제거**

`package.json`의 `dependencies`에서 `"pdf-parse": "^1.1.1"` 줄을 삭제한다.

그리고 실제로 패키지를 제거한다:

```bash
npm uninstall pdf-parse
```

- [ ] **Step 3: 전체 테스트 실행**

```bash
npx vitest run
```

예상: `tests/cache.test.ts` (8 tests), `tests/base.test.ts` (3 tests) PASS.
`tests/index.test.ts`는 기존 내용에 따라 달라질 수 있음 — 실패 시 내용 확인.

- [ ] **Step 4: 타입 체크**

```bash
npx tsc --noEmit
```

예상: 오류 없음

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "chore: remove mdWriter and pdf-parse dependency"
```

---

### Task 7: pollens.md 스킬 업데이트

**Files:**
- Modify: `.claude/commands/pollens.md`

- [ ] **Step 1: pollens.md 전체 교체**

```markdown
# /pollens — 2026 지방선거 후보 공약 비교

경기도 화성시 동탄5동 유권자를 위한 2026-06-03 지방선거 후보 공약 비교 도구.

---

## 금지 표현 (FORBIDDEN — 절대 사용 금지)

다음 표현은 이 스킬 실행 중 **어떤 상황에서도 사용하지 않는다**:

- `1위`
- `가장 적합`
- `추천`
- `승자`
- `점수`
- `더 나은 후보`
- `좋은 후보`

AI는 정보만 제공한다. 판단·추천·순위는 절대 표시하지 않는다.

---

## Step 1: 캐시 확인

`/Users/mksoo/Documents/dev/tmp/PolLens/data/meta.json` 파일을 읽는다.

- 파일이 없거나 `collectedAt` 값이 현재 시각 기준 24시간 이전이면 → 중단:

  ```
  데이터가 없거나 오래되었습니다. 먼저 /pollens-collect 를 실행해 데이터를 수집하세요.
  ```

- `collectedAt`이 24시간 이내이면 → Step 2로 진행.

---

## Step 2: 선거 목록 안내

다음을 **그대로** 출력한다:

```
경기도 화성시 동탄5동 기준으로 2026-06-03에 다음 선거가 예정되어 있습니다:

1. 도지사 — 경기도
2. 시장 — 화성시
3. 도의원 — 화성시제3선거구
4. 시의원 — 화성시다선거구
5. 교육감 — 경기도

어떤 선거부터 볼까요?
```

사용자의 선택을 기다린다.

---

## Step 3: 후보 목록 및 PDF 읽기

meta.json의 `candidates` 배열에서 사용자가 선택한 `electionType`에 해당하는 후보를 모두 추출한다.

```
electionType 매핑:
1. 도지사  → electionType === "도지사"
2. 시장    → electionType === "시장"
3. 도의원  → electionType === "도의원"
4. 시의원  → electionType === "시의원"
5. 교육감  → electionType === "교육감"
```

후보가 없으면:

```
이 선거 데이터가 없습니다. /pollens-collect 를 실행해주세요.
```

후보가 있으면:
1. `ballotNumber` 오름차순으로 정렬한다.
2. 각 후보에 대해:
   - `pdfPath`가 있으면: `/Users/mksoo/Documents/dev/tmp/PolLens/<pdfPath>` 경로의 PDF를 Read 도구로 읽는다.
     공약 내용을 해석한다.
   - `pdfPath`가 없고 `pbinfoPdfPath`가 있으면: `/Users/mksoo/Documents/dev/tmp/PolLens/<pbinfoPdfPath>` 경로의 PDF를 Read 도구로 읽는다.
     이미지 기반 PDF이므로 텍스트 추출이 어려울 수 있다. 읽을 수 없으면 공약 셀에 `(선거공보 링크 참조)` 표시.
   - 아무 PDF도 없으면: 공약 셀에 `(공약 파일 없음)` 표시.

---

## Step 4: 공약 비교표 출력

기호번호 오름차순으로 정렬된 후보자들의 공약을 아래 형식의 Markdown 표로 출력한다.

```
## [선거명] 후보 공약 비교

| | 기호 1 · [이름] ([정당]) | 기호 2 · [이름] ([정당]) | ...  |
|--|--|--|--|
| **공약 1** | [공약 제목] | [공약 제목] | ... |
| **공약 2** | [공약 제목] | [공약 제목] | ... |
| **공약 3** | [공약 제목] | [공약 제목] | ... |
| **공약 4** | [공약 제목] | [공약 제목] | ... |
| **공약 5** | [공약 제목] | [공약 제목] | ... |

※ 기호번호 순 정렬 / 판단·추천 없음
```

규칙:
- 열 순서는 기호번호 오름차순으로만 배치한다.
- 공약이 5개 미만인 후보는 해당 셀을 `-`로 채운다.
- PDF 열람 불가 후보는 공약 셀 대신 `(선거공보 링크 참조)`를 표시하고, 표 아래에 `pbinfoUrl`을 별도 나열한다.
- 공약 제목은 AI가 PDF 내용을 해석한 결과를 간결하게 기재한다. 평가하거나 의견을 추가하지 않는다.
- 표 외에 어떤 평가·비교·판단도 추가하지 않는다.

---

## Step 5: 후속 안내

표 출력 후 다음을 묻는다:

```
다른 선거도 볼까요? 이 후보들에 대해 추가 정보를 찾아드릴까요?
```

### 5a. 다른 선거를 선택한 경우

Step 2로 돌아가 선거 목록을 다시 안내한다.

### 5b. 추가 정보를 요청한 경우

다음을 묻는다:

```
어떤 분야가 가장 중요하세요?
(예: 교통, 환경, 복지, 주거, 교육, 경제 등)
```

사용자가 분야를 답하면 WebSearch를 사용해 해당 후보자들의 관련 기사·SNS·과거 발언을 검색한다.

검색 결과 제시 규칙:
- 사실 정보만 제시한다.
- 출처(매체명, 날짜)를 함께 표기한다.
- 판단·추천·순위는 절대 표시하지 않는다.
- 금지 표현 목록의 표현을 사용하지 않는다.
```

- [ ] **Step 2: 커밋**

```bash
git add .claude/commands/pollens.md
git commit -m "feat(pollens): read candidates from meta.json and PDFs directly"
```

---

### Task 8: CLAUDE.md 아키텍처 업데이트

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: 아키텍처 섹션 업데이트**

`CLAUDE.md`의 `### 데이터 흐름` 섹션을 아래로 교체한다:

```markdown
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
```

`### 주요 설계 결정` 섹션을 아래로 교체한다:

```markdown
### 주요 설계 결정

**PDF 바이너리 저장** — 수집 시 텍스트 추출 없이 PDF를 바이너리로 저장한다. Claude Code의 Read 도구가 PDF를 네이티브로 읽을 수 있어 `pdf-parse` 의존성이 불필요하다. 이미지 기반 PDF(PBINFO)도 동일하게 처리된다.

**meta.json 통합 관리** — 후보별 `.txt` 파일 대신 `data/meta.json`의 `candidates[]` 배열 하나에 모든 메타데이터를 저장한다. `pdfPath` / `pbinfoPdfPath`는 프로젝트 루트 기준 상대 경로.

**두 종류 PDF** — `P5_PRMS_PUB`(5대공약 텍스트 PDF)는 `<이름>.pdf`로, `PBINFO`(선거공보 이미지 PDF)는 `<이름>_공보.pdf`로 저장한다. PBINFO를 공약 파싱 fallback으로 사용하지 않는다 (이미지 PDF는 Claude가 직접 읽음).

**선관위 DOM 특이사항** — (기존 내용 유지)
```

`.txt` 파일 형식 섹션은 삭제한다.

- [ ] **Step 2: 커밋**

```bash
git add CLAUDE.md
git commit -m "docs(CLAUDE.md): update architecture for PDF binary storage"
```

---

### Task 9: 최종 검증

- [ ] **Step 1: 전체 테스트**

```bash
npx vitest run
```

예상: 모든 테스트 PASS

- [ ] **Step 2: 타입 체크**

```bash
npx tsc --noEmit
```

예상: 오류 없음

- [ ] **Step 3: 기존 data/ 정리 (선택)**

기존 `.txt` 파일이 남아있다면 삭제한다:

```bash
find data -name "*.txt" -delete
```

- [ ] **Step 4: 최종 커밋**

```bash
git add -A
git status  # 변경 없으면 커밋 생략
```
