// scripts/scrapers/base.ts
import { chromium, type Browser, type Page } from 'playwright';
import type { CandidateRef } from '../types';

// ⚠️ PLACEHOLDER SELECTORS — fill in after running: npm run explore
// See exploration/SCRAPER_NOTES.md for actual values after site exploration
export const SELECTORS = {
  // 후보자 목록 페이지
  candidateItem: '.candidate-item',         // 교체 필요
  candidateName: '.candidate-name',          // 교체 필요
  ballotNumber: '.ballot-number',            // 교체 필요
  party: '.party-name',                      // 교체 필요
  documentLink: 'a[href*="viewer"]',         // 교체 필요

  // 문서 뷰어
  textLayer: '[class*="textLayer"]',         // 교체 필요
  nextPageBtn: '[class*="nextPage"]',        // 교체 필요
  pageInfo: '[class*="pageInfo"]',           // 교체 필요
};

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({ headless: true });
}

/**
 * 현재 페이지의 textLayer에서 텍스트를 추출한다.
 * SELECTORS.textLayer가 올바른 값으로 교체된 후에 실제 동작.
 */
export async function extractCurrentPageText(page: Page): Promise<string> {
  await page.waitForSelector(SELECTORS.textLayer, { timeout: 30_000 });
  return page.evaluate((selector) => {
    const layers = document.querySelectorAll(selector);
    return Array.from(layers)
      .map((el) => el.textContent ?? '')
      .join('\n');
  }, SELECTORS.textLayer);
}

/**
 * 문서 뷰어의 모든 페이지를 순회하며 텍스트를 추출한다.
 * ⚠️ viewerUrl 패턴은 SCRAPER_NOTES.md의 "문서 key URL 패턴"으로 교체 필요.
 */
export async function extractAllPagesText(
  page: Page,
  documentKey: string
): Promise<string> {
  // ⚠️ URL 패턴을 실제 값으로 교체 필요 (exploration/SCRAPER_NOTES.md 참조)
  const viewerUrl = `https://policy.nec.go.kr/viewer?key=${documentKey}`;
  await page.goto(viewerUrl, { waitUntil: 'networkidle', timeout: 60_000 });

  const allText: string[] = [];
  let pageNum = 0;

  while (true) {
    const pageText = await extractCurrentPageText(page);
    allText.push(pageText);
    pageNum++;

    // 다음 페이지 버튼 확인
    const nextBtn = page.locator(SELECTORS.nextPageBtn);
    const isDisabled = await nextBtn.isDisabled().catch(() => true);
    if (isDisabled) break;

    await nextBtn.click();
    // 새 textLayer 로딩 대기
    await page.waitForTimeout(800);
  }

  console.log(`    → ${pageNum}페이지 추출 완료`);
  return allText.join('\n');
}

/**
 * 후보자 목록 페이지에서 CandidateRef 목록을 수집한다.
 * ⚠️ listingUrl과 SELECTORS가 실제 값으로 교체된 후에 실제 동작.
 */
export async function extractCandidateRefs(
  page: Page,
  listingUrl: string
): Promise<CandidateRef[]> {
  await page.goto(listingUrl, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForSelector(SELECTORS.candidateItem, { timeout: 20_000 });

  return page.$$eval(
    SELECTORS.candidateItem,
    (items: Element[], selectors: typeof SELECTORS) =>
      items.map((item) => {
        const linkEl = item.querySelector(selectors.documentLink) as HTMLAnchorElement | null;
        const href = linkEl?.href ?? '';
        // 문서 키는 URL의 마지막 경로 세그먼트 또는 쿼리 파라미터
        // ⚠️ 실제 URL 패턴에 맞게 교체 필요
        const keyMatch = href.match(/key=([^&]+)/i) ?? href.match(/\/([^/?]+)(?:\?|$)/);
        return {
          documentKey: keyMatch?.[1] ?? '',
          name: item.querySelector(selectors.candidateName)?.textContent?.trim() ?? '',
          ballotNumber: parseInt(
            item.querySelector(selectors.ballotNumber)?.textContent?.trim() ?? '0',
            10
          ),
          party: item.querySelector(selectors.party)?.textContent?.trim() ?? '',
        };
      }),
    SELECTORS
  );
}
