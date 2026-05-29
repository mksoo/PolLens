// scripts/scrapers/municipal.ts
import { chromium } from 'playwright';
import type { ScraperConfig } from '../types';
import { saveRawCandidate } from '../mdWriter';
import { navigateToElectionList, extractCandidateRefs, downloadPdfText, createPage, REGION_CODE } from './base';

export async function scrapeMunicipal(config: ScraperConfig, dataDir: string): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await createPage(browser);
    console.log(`  시의원 후보 목록 탐색 중...`);
    // 시의원: 경기도 → 화성시동탄구(구) → 화성시다선거구(선거구)
    await navigateToElectionList(
      page, '구·시·군의회의원선거', REGION_CODE, '화성시동탄구', config.district
    );
    const refs = await extractCandidateRefs(page);
    console.log(`  시의원 후보 ${refs.length}명 발견`);

    for (const ref of refs) {
      console.log(`  수집 중: 기호${ref.ballotNumber} ${ref.name} (${ref.party})`);
      let rawText = '';
      if (ref.pdfUrl) {
        try {
          rawText = await downloadPdfText(ref.pdfUrl);
        } catch (e) {
          console.log(`    PDF 추출 실패: ${(e as Error).message.slice(0, 80)}`);
        }
      }
      saveRawCandidate({
        name: ref.name, ballotNumber: ref.ballotNumber, party: ref.party,
        electionType: config.electionType, region: config.region, district: config.district,
        pdfUrl: ref.pdfUrl, pbinfoUrl: ref.pbinfoUrl,
        rawText, collectedAt: new Date().toISOString(),
      }, dataDir);
      console.log(`  → 저장 완료: ${ref.name}`);
    }
  } finally {
    await browser.close();
  }
}
