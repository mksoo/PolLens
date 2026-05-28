import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const OUT_DIR = path.join(process.cwd(), 'exploration');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function pause(msg: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(`\n[PAUSE] ${msg}\nEnter를 누르면 계속: `, () => {
    rl.close();
    resolve();
  }));
}

async function dumpInterestingElements(page: any, label: string): Promise<void> {
  const info = await page.evaluate(() => {
    const results: string[] = [];

    // All elements with class containing text/layer/candidate/viewer keywords
    document.querySelectorAll('*').forEach((el: Element) => {
      const cls = typeof el.className === 'string' ? el.className : '';
      const id = el.id || '';
      const text = el.textContent?.trim().slice(0, 60) ?? '';

      const isInteresting =
        cls.match(/text|layer|candidate|viewer|list|item|page|next|prev|btn|button|nav|ballot|party|name/i) ||
        id.match(/text|layer|candidate|viewer|list|item|page|next|prev|btn|button/i);

      if (isInteresting && el.children.length < 8 && text) {
        results.push(`${el.tagName}${id ? '#' + id : ''}${cls ? '.' + cls.split(' ').slice(0, 2).join('.') : ''} → "${text.slice(0, 50)}"`);
      }
    });

    return results.slice(0, 40);
  });

  console.log(`\n=== ${label} ===`);
  info.forEach((line: string) => console.log(' ', line));
}

async function explore() {
  console.log('브라우저 시작 (headful 모드)...');
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // 1. 홈페이지 탐색
  console.log('policy.nec.go.kr 접속 중...');
  await page.goto('https://policy.nec.go.kr', { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: path.join(OUT_DIR, '01-home.png') });

  const currentUrl1 = page.url();
  console.log('현재 URL:', currentUrl1);
  await dumpInterestingElements(page, '홈 페이지 요소');

  console.log('\n지시사항:');
  console.log('  화성시 관련 선거 (예: 시장)를 찾아 후보자 목록 페이지로 이동하세요.');
  await pause('후보자 목록 페이지로 이동 후 Enter');

  // 2. 후보자 목록 페이지
  await page.screenshot({ path: path.join(OUT_DIR, '02-candidate-list.png') });
  const currentUrl2 = page.url();
  console.log('\n현재 URL:', currentUrl2);
  await dumpInterestingElements(page, '후보자 목록 페이지 요소');

  // 후보자 기호/이름/정당 관련 요소 집중 탐색
  const candidateData = await page.evaluate(() => {
    const results: string[] = [];
    document.querySelectorAll('*').forEach((el: Element) => {
      const text = el.textContent?.trim() ?? '';
      if ((text.includes('기호') || text.includes('후보') || text.includes('더불어') || text.includes('국민'))
          && el.children.length < 5 && text.length < 80) {
        const cls = typeof el.className === 'string' ? el.className : '';
        results.push(`${el.tagName}.${cls.slice(0, 40)} → "${text.slice(0, 60)}"`);
      }
    });
    return results.slice(0, 30);
  });
  console.log('\n=== 기호/후보/정당 관련 요소 ===');
  candidateData.forEach((line: string) => console.log(' ', line));

  console.log('\n지시사항:');
  console.log('  후보자 1명을 클릭해서 공보 문서 뷰어를 여세요.');
  await pause('문서 뷰어 열린 후 Enter');

  // 3. 문서 뷰어 탐색
  await page.screenshot({ path: path.join(OUT_DIR, '03-viewer.png') });
  const currentUrl3 = page.url();
  console.log('\n현재 URL:', currentUrl3);
  await dumpInterestingElements(page, '문서 뷰어 요소');

  // textLayer 집중 탐색
  const textLayerInfo = await page.evaluate(() => {
    const results: string[] = [];
    document.querySelectorAll('div, span').forEach((el: Element) => {
      const cls = typeof el.className === 'string' ? el.className : '';
      const text = el.textContent?.trim() ?? '';
      if (cls && text.length > 10 && el.children.length < 10) {
        results.push(`${el.tagName}.${cls.slice(0, 50)} → "${text.slice(0, 60)}"`);
      }
    });
    return results.slice(0, 40);
  });
  console.log('\n=== textLayer 후보 (모든 div/span with class+text) ===');
  textLayerInfo.forEach((line: string) => console.log(' ', line));

  // 페이지 이동 버튼 탐색
  const navButtons = await page.evaluate(() => {
    const results: string[] = [];
    document.querySelectorAll('button, a, [role="button"]').forEach((el: Element) => {
      const text = el.textContent?.trim() ?? '';
      const cls = typeof el.className === 'string' ? el.className : '';
      if (text || cls) {
        results.push(`${el.tagName}.${cls.slice(0, 40)} → "${text.slice(0, 30)}"`);
      }
    });
    return results.slice(0, 30);
  });
  console.log('\n=== 버튼/링크 요소 ===');
  navButtons.forEach((line: string) => console.log(' ', line));

  // 현재 페이지 텍스트 전체 출력 (가장 텍스트가 많은 단일 요소 찾기)
  const richestText = await page.evaluate(() => {
    let best = { cls: '', text: '', len: 0 };
    document.querySelectorAll('div').forEach((el: Element) => {
      const text = el.textContent?.trim() ?? '';
      if (text.length > best.len && el.children.length < 20) {
        best = {
          cls: typeof el.className === 'string' ? el.className : '',
          text: text.slice(0, 200),
          len: text.length
        };
      }
    });
    return best;
  });
  console.log('\n=== 가장 텍스트가 많은 div ===');
  console.log(`Class: ${richestText.cls}`);
  console.log(`Text (200자): ${richestText.text}`);

  await pause('탐색 완료. 브라우저를 닫습니다.');
  await browser.close();

  // SCRAPER_NOTES.md 템플릿 생성
  const notes = `# Scraper Notes
> 탐색일: ${new Date().toISOString()}

## URLs

### 홈
${currentUrl1}

### 후보자 목록 (예시)
${currentUrl2}

### 문서 뷰어 (예시)
${currentUrl3}

---

## 후보자 목록 페이지 셀렉터
<!-- 콘솔 출력을 보며 아래 빈칸을 채워주세요 -->

- 후보자 항목 셀렉터:
- 이름 셀렉터:
- 기호번호 셀렉터:
- 정당 셀렉터:
- 문서 링크 셀렉터:

## 문서 뷰어 셀렉터
<!-- 콘솔 출력을 보며 아래 빈칸을 채워주세요 -->

- textLayer 셀렉터:
- 다음 페이지 버튼 셀렉터:
- 전체 페이지 수 표시 셀렉터:
- 문서 key URL 패턴:
`;

  fs.writeFileSync(path.join(OUT_DIR, 'SCRAPER_NOTES.md'), notes, 'utf-8');
  console.log('\n✓ exploration/SCRAPER_NOTES.md 생성됨');
  console.log('✓ 스크린샷: exploration/*.png');
  console.log('\n다음 단계: SCRAPER_NOTES.md를 열어 셀렉터를 채운 뒤 scripts/scrapers/base.ts에 적용하세요.');
}

explore().catch(console.error);
