// tests/mdWriter.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { candidateToMd, saveCandidateMd } from '../scripts/mdWriter';
import type { Candidate } from '../scripts/types';

const MOCK_CANDIDATE: Candidate = {
  name: '추미애',
  ballotNumber: 1,
  party: '더불어민주당',
  electionType: '도지사',
  region: '경기도',
  district: '경기도',
  collectedAt: '2026-05-28T10:00:00.000Z',
  pledges: [
    {
      rank: 1,
      title: '수도권 30분 출근 대전환',
      goal: ['광역교통망 구축'],
      method: ['GTX 지체 없는 개통 추진'],
      period: ['2026년~2030년 추진'],
      budget: ['추가경정예산 편성을 통해 추진'],
    },
  ],
};

describe('candidateToMd', () => {
  it('제목 줄에 이름, 선거유형, 지역을 포함한다', () => {
    const md = candidateToMd(MOCK_CANDIDATE);
    expect(md).toContain('# 추미애 — 도지사 · 경기도');
  });

  it('기호번호, 정당, 수집일을 메타 줄에 포함한다', () => {
    const md = candidateToMd(MOCK_CANDIDATE);
    expect(md).toContain('기호: 1');
    expect(md).toContain('더불어민주당');
    expect(md).toContain('2026-05-28T10:00:00.000Z');
  });

  it('공약 제목을 포함한다', () => {
    const md = candidateToMd(MOCK_CANDIDATE);
    expect(md).toContain('### 공약 1: 수도권 30분 출근 대전환');
  });

  it('목표 항목을 - 리스트로 변환한다', () => {
    const md = candidateToMd(MOCK_CANDIDATE);
    expect(md).toContain('- 광역교통망 구축');
  });

  it('항목이 없으면 (정보 없음)을 표시한다', () => {
    const candidate: Candidate = {
      ...MOCK_CANDIDATE,
      pledges: [{ rank: 1, title: '테스트', goal: [], method: [], period: [], budget: [] }],
    };
    const md = candidateToMd(candidate);
    expect(md).toContain('- (정보 없음)');
  });
});

describe('saveCandidateMd', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pollens-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('올바른 경로에 파일을 생성한다', () => {
    saveCandidateMd(MOCK_CANDIDATE, tmpDir);
    const expectedPath = path.join(tmpDir, '도지사', '경기도', '추미애.md');
    expect(fs.existsSync(expectedPath)).toBe(true);
  });

  it('저장된 파일에 후보자 이름이 포함된다', () => {
    saveCandidateMd(MOCK_CANDIDATE, tmpDir);
    const content = fs.readFileSync(
      path.join(tmpDir, '도지사', '경기도', '추미애.md'),
      'utf-8'
    );
    expect(content).toContain('# 추미애');
  });
});
