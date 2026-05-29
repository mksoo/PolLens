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

/** 동탄5동 기준 선거 목록 */
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
