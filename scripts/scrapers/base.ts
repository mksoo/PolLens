// scripts/scrapers/base.ts
import { chromium, type Browser, type Page } from 'playwright';
import type { CandidateRef } from '../types';

export const LISTING_URL =
  'https://policy.nec.go.kr/plc/commiment/initUCACommiment.do?menuId=CNDDT25';

/** 경기도 지역 코드 */
export const REGION_CODE = '4100';

/**
 * 선거 유형 탭 LI 요소의 onclick 코드(sgId) 매핑.
 * 실제 DOM: <li onclick="fnSgIdChange('320260603')">시·도지사선거</li>
 */
const ELECTION_SG_IDS: Record<string, string> = {
  '시·도지사선거': '320260603',
  '구·시·군의 장선거': '420260603',
  '시·도의회의원선거': '520260603',
  '구·시·군의회의원선거': '620260603',
  '광역의원비례대표선거': '820260603',
  '기초의원비례대표선거': '920260603',
  '교육감선거': '1120260603',
  '국회의원선거': '220260603',
};

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({ headless: true });
}

/** 탭 UI가 렌더링되는 충분한 뷰포트로 페이지를 생성한다. */
export async function createPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  return context.newPage();
}

/**
 * 후보자 목록 페이지로 이동한다.
 * @param electionTabText  탭 버튼 텍스트 (예: "시·도지사선거")
 * @param regionCode       지역 코드 (예: "4100" for 경기도)
 * @param cityText         시·군 선택 팝업에서 클릭할 텍스트 (예: "화성시")
 * @param districtText     선거구 선택 팝업에서 클릭할 텍스트 (예: "동탄제1선거구")
 */
export async function navigateToElectionList(
  page: Page,
  electionTabText: string,
  regionCode: string,
  cityText?: string,
  districtText?: string
): Promise<void> {
  await page.goto(LISTING_URL, { waitUntil: 'networkidle', timeout: 60_000 });

  // 선거 유형 탭: <li onclick="fnSgIdChange('...')"> 요소를 JS로 직접 호출
  // fnSgIdChange는 동기 jQuery AJAX를 사용하며 success 콜백에서
  // parent._FN_INDEX_RESIZE(레이아웃 조정용)를 호출한다.
  // iframe 없이 직접 로드 시 이 함수가 없어 에러가 발생하므로 미리 스텁한다.
  const sgId = ELECTION_SG_IDS[electionTabText];
  if (!sgId) throw new Error(`알 수 없는 선거 유형: ${electionTabText}`);
  await page.evaluate((id) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (typeof w._FN_INDEX_RESIZE !== 'function') w._FN_INDEX_RESIZE = () => {};
    try {
      if (typeof w.parent._FN_INDEX_RESIZE !== 'function') w.parent._FN_INDEX_RESIZE = () => {};
    } catch { /* cross-origin guard */ }
    w.fnSgIdChange(id);
  }, sgId);
  await page.waitForTimeout(800);

  // 지역 버튼 클릭
  await page.waitForSelector(`#region${regionCode}`, { timeout: 10_000 });
  await page.click(`#region${regionCode}`);
  await page.waitForTimeout(1_200);

  // 시·군 선택 팝업: <input type="button"> + <label for="..."> 구조
  if (cityText) {
    await page.waitForSelector(`#modalDiv label:has-text("${cityText}")`, { timeout: 10_000 });
    await page.click(`#modalDiv label:has-text("${cityText}")`);
    await page.waitForTimeout(1_200);
  }

  // 선거구 선택 팝업: 같은 모달 재사용, label 클릭
  if (districtText) {
    await page.waitForSelector(`#modalDiv label:has-text("${districtText}")`, { timeout: 10_000 });
    await page.click(`#modalDiv label:has-text("${districtText}")`);
    await page.waitForTimeout(1_200);
  }

  // 후보자 카드 대기
  await page.waitForSelector('.commit_l_box', { timeout: 15_000 });
}

/**
 * 현재 페이지에서 후보자 목록을 추출한다.
 * 이름·기호번호·정당은 HTML에서, PDF URL은 CDN 다운로드 링크에서 가져온다.
 */
export async function extractCandidateRefs(page: Page): Promise<CandidateRef[]> {
  return page.$$eval('.commit_l_box', (cards) => {
    return cards.flatMap((card) => {
      const nameDiv = card.querySelector('.info .name');
      if (!nameDiv) return [];

      const name = nameDiv.querySelector('p')?.textContent?.trim() ?? '';
      // 기호번호는 .name div의 직접 텍스트 노드에 존재
      const ballotText = Array.from(nameDiv.childNodes)
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent?.trim())
        .filter(Boolean)
        .join('');
      const ballotNumber = parseInt(ballotText || '0', 10);
      const party = card.querySelector('.info ul li')?.textContent?.trim() ?? '';

      const links = Array.from(card.querySelectorAll('a.btn_down.cdn')) as HTMLAnchorElement[];
      // P5_PRMS_PUB 링크만 텍스트 추출용으로 사용. PBINFO(이미지 PDF)는 fallback 금지
      const pdfUrl = links.find((a) => a.href.includes('P5_PRMS_PUB'))?.href;
      const pbinfoUrl = links.find((a) => a.href.includes('PBINFO'))?.href;

      if (!name) return [];
      return [{ name, ballotNumber, party, pdfUrl, pbinfoUrl }];
    });
  });
}

/**
 * CDN PDF를 직접 다운로드하고 텍스트를 추출한다.
 * pdf-parse 라이브러리를 사용한다.
 */
export async function downloadPdfText(pdfUrl: string): Promise<string> {
  const response = await fetch(pdfUrl);
  if (!response.ok) {
    throw new Error(`PDF 다운로드 실패: ${response.status} ${pdfUrl}`);
  }
  const arrayBuf = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require('pdf-parse');
  const data = await pdfParse(buffer);
  return data.text;
}
