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

    // 읍면동 입력 후 검색 (버튼은 button[type="button"], fn_submit_vote() 호출)
    await page.waitForSelector('input[type="text"]', { timeout: 10_000 });
    await page.fill('input[type="text"]', emd);
    await page.click('button[type="button"]');

    // popup_search_sg_emd_req.xhtml 로 이동 후 결과 로드 대기
    await page.waitForURL('**/popup_search_sg_emd_req.xhtml', { timeout: 15_000 });
    await page.waitForSelector('ul.list li', { timeout: 10_000 });

    // 시도별로 결과 항목을 찾아 매칭 — 동일한 읍면동 이름이 여러 시도에 존재할 수 있음
    const allItems = await page.$$('ul.list li');
    let targetItem = null;
    for (const item of allItems) {
      const sidoText = await item.$eval(
        'div.zone_tit div.path p:nth-child(1)',
        (el) => el.textContent?.trim() ?? ''
      ).catch(() => '');
      if (sidoText === sido) {
        targetItem = item;
        break;
      }
    }
    if (!targetItem) {
      const found = await Promise.all(
        allItems.map((item) =>
          item.$eval('div.zone_tit div.path p:nth-child(1)', (el) => el.textContent?.trim() ?? '').catch(() => '')
        )
      );
      throw new Error(`${sido}의 "${emd}" 검색 결과를 찾을 수 없습니다. 실제 결과: ${found.join(', ')}`);
    }

    // zone_tit > .path > p 순서: [0]=시도, [1]=구/시군, [2]=동
    const districtCity = await targetItem.$eval(
      'div.zone_tit div.path p:nth-child(2)',
      (el) => el.textContent?.trim() ?? ''
    );

    // zone_con li(헤더 제외)에서 선거구 정보 추출 — CSS hide여도 DOM에 존재하므로 접근 가능
    const rows = await targetItem.$$eval(
      'ul.zone_con li:not(.th)',
      (lis) =>
        lis.map((li) => {
          const zone = li.querySelector('div.zone');
          if (!zone) return { electionName: '', districtCity: '', districtName: '' };
          const nodes = Array.from(zone.childNodes)
            .filter((n) => n.nodeType === Node.ELEMENT_NODE)
            .map((n) => (n as Element).textContent?.trim() ?? '')
            .filter(Boolean);
          return {
            electionName: nodes[0] ?? '',
            districtCity: '',
            districtName: nodes[1] ?? '',
          };
        })
    );

    const rowsWithCity = rows.map((r) => ({ ...r, districtCity }));
    const partial = parseDistrictResult(rowsWithCity, sigungu);
    return { sido, sigungu, regionCode, ...partial };
  } finally {
    await browser.close();
  }
}
