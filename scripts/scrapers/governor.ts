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
