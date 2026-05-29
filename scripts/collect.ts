// scripts/collect.ts
import * as path from 'path';
import { updateMeta } from './cache';
import { scrapeGovernor } from './scrapers/governor';
import { scrapeMayor } from './scrapers/mayor';
import { scrapeProvincial } from './scrapers/provincial';
import { scrapeMunicipal } from './scrapers/municipal';
import { scrapeEducation } from './scrapers/education';
import type { ElectionType, ScraperConfig, CandidateMeta } from './types';

export const REGION_CODES: Record<string, string> = {
  '서울특별시': '1100',
  '부산광역시': '2600',
  '대구광역시': '2700',
  '인천광역시': '2800',
  '광주광역시': '2900',
  '대전광역시': '3000',
  '울산광역시': '3100',
  '세종특별자치시': '3600',
  '경기도': '4100',
  '강원특별자치도': '4200',
  '충청북도': '4300',
  '충청남도': '4400',
  '전북특별자치도': '4500',
  '전라남도': '4600',
  '경상북도': '4700',
  '경상남도': '4800',
  '제주특별자치도': '5000',
};

export function parseConfigJson(json: string): ScraperConfig[] {
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) throw new Error('--config-json 값은 배열이어야 합니다');
  return parsed as ScraperConfig[];
}

const DATA_DIR = path.join(process.cwd(), 'data');

/** 동탄5동 기준 선거 목록 */
const DONGTAN5_CONFIGS: ScraperConfig[] = [
  { electionType: '도지사',  regionCode: '4100', region: '경기도', district: '경기도' },
  { electionType: '시장',    regionCode: '4100', region: '화성시', district: '화성시',             cityText: '화성시' },
  { electionType: '도의원',  regionCode: '4100', region: '경기도', district: '화성시제3선거구',   cityText: '화성시동탄구', districtText: '화성시제3선거구' },
  { electionType: '시의원',  regionCode: '4100', region: '화성시', district: '화성시다선거구',   cityText: '화성시동탄구', districtText: '화성시다선거구' },
  { electionType: '교육감',  regionCode: '4100', region: '경기도', district: '경기도' },
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

  const configJsonIdx = args.indexOf('--config-json');
  const typeIdx = args.indexOf('--type');

  let configs: ScraperConfig[];

  if (configJsonIdx !== -1) {
    const configJsonArg = args[configJsonIdx + 1];
    if (!configJsonArg) {
      console.error('오류: --config-json 뒤에 JSON 배열을 입력해주세요');
      process.exit(1);
    }
    try {
      configs = parseConfigJson(configJsonArg);
    } catch (err) {
      console.error('오류: --config-json 파싱 실패:', (err as Error).message);
      process.exit(1);
    }
  } else {
    const typeArg = typeIdx !== -1 ? (args[typeIdx + 1] as ElectionType) : undefined;
    configs = typeArg
      ? DONGTAN5_CONFIGS.filter((c) => c.electionType === typeArg)
      : DONGTAN5_CONFIGS;

    if (configs.length === 0) {
      console.error(`오류: 알 수 없는 선거 유형 "${typeArg}"`);
      console.error(`가능한 값: ${DONGTAN5_CONFIGS.map((c) => c.electionType).join(', ')}`);
      process.exit(1);
    }
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

if (require.main === module) {
  main().catch((err) => {
    console.error('예상치 못한 오류:', err);
    process.exit(1);
  });
}
