// scripts/debug-compare-pdfs.ts
// 도지사 후보들의 PDF 링크 타입과 텍스트 앞부분 비교
import { chromium } from 'playwright';
import * as os from 'os';
import * as path from 'path';
import { createPage, downloadPdf } from './scrapers/base';

const LISTING_URL = 'https://policy.nec.go.kr/plc/commiment/initUCACommiment.do?menuId=CNDDT25';
const REGION_CODE = '4100'; // 경기도

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await createPage(browser);

  await page.goto(LISTING_URL, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (typeof w._FN_INDEX_RESIZE !== 'function') w._FN_INDEX_RESIZE = () => {};
    try { if (typeof w.parent._FN_INDEX_RESIZE !== 'function') w.parent._FN_INDEX_RESIZE = () => {}; } catch {}
    w.fnSgIdChange('320260603'); // 도지사
  });
  await page.waitForTimeout(800);
  await page.waitForSelector(`#region${REGION_CODE}`, { timeout: 10_000 });
  await page.click(`#region${REGION_CODE}`);
  await page.waitForSelector('.commit_l_box', { timeout: 15_000 });

  const cards = await page.$$eval('.commit_l_box', (els) =>
    els.map((el) => {
      const nameEl = el.querySelector('.info .name p');
      const links = Array.from(el.querySelectorAll('a.btn_down.cdn')) as HTMLAnchorElement[];
      return {
        name: nameEl?.textContent?.trim() ?? '',
        links: links.map((a) => ({
          type: a.href.includes('P5_PRMS_PUB') ? 'P5_PRMS_PUB'
              : a.href.includes('PBINFO') ? 'PBINFO'
              : a.href.includes('PRMS_DOC_PUB') ? 'PRMS_DOC_PUB'
              : 'OTHER',
          href: a.href,
        })),
      };
    })
  );

  for (const card of cards) {
    console.log(`\n=== ${card.name} ===`);
    console.log('PDF 링크:', card.links.map((l) => l.type).join(', '));

    const chosen = card.links.find((l) => l.type === 'P5_PRMS_PUB')
      ?? card.links.find((l) => l.type === 'PBINFO')
      ?? card.links[0];

    if (!chosen) { console.log('  링크 없음'); continue; }

    try {
      const tmpPath = path.join(os.tmpdir(), `debug-${Date.now()}.pdf`);
      await downloadPdf(chosen.href, tmpPath);
      console.log(`  URL 타입: ${chosen.type}`);
      console.log(`  다운로드 성공: ${tmpPath}`);
    } catch (e) {
      console.log('  에러:', (e as Error).message.slice(0, 100));
    }
  }

  await browser.close();
}

main().catch(console.error);
