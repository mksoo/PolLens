// scripts/scrapers/municipal.ts
import { chromium } from 'playwright';
import type { ScraperConfig } from '../types';
import { parseRawText } from '../parser';
import { saveCandidateMd } from '../mdWriter';
import { extractCandidateRefs, extractAllPagesText } from './base';

/**
 * 화성시의원 후보 공약을 수집한다.
 * ⚠️ listingUrl을 실제 URL로 교체 필요 (exploration/SCRAPER_NOTES.md 참조)
 */
export async function scrapeMunicipal(config: ScraperConfig, dataDir: string): Promise<void> {
  // ⚠️ 실제 URL 패턴으로 교체 필요
  const listingUrl = `https://policy.nec.go.kr/candidate/list?electionType=시의원&district=${encodeURIComponent(config.district)}`;

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log(`  후보자 목록 조회: ${listingUrl}`);
    const refs = await extractCandidateRefs(page, listingUrl);
    console.log(`  시의원 후보 ${refs.length}명 발견`);

    for (const ref of refs) {
      console.log(`  수집 중: 기호${ref.ballotNumber} ${ref.name} (${ref.party})`);
      const rawText = await extractAllPagesText(page, ref.documentKey);
      const candidate = parseRawText(rawText, config.electionType, config.region);
      saveCandidateMd(candidate, dataDir);
      console.log(`  → 저장 완료: ${candidate.name}`);
    }
  } finally {
    await browser.close();
  }
}
