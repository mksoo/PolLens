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

  const browser = await chromium.launch({ headless: true });
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
