// tests/mdWriter.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { saveRawCandidate } from '../scripts/mdWriter';
import type { RawCandidate } from '../scripts/types';

const MOCK_CANDIDATE: RawCandidate = {
  name: '추미애',
  ballotNumber: 1,
  party: '더불어민주당',
  electionType: '도지사',
  region: '경기도',
  district: '경기도',
  pdfUrl: 'https://cdn.nec.go.kr/test.pdf',
  rawText: '경기도를 더 살기 좋은 곳으로 만들겠습니다.',
  collectedAt: '2026-05-28T10:00:00.000Z',
};

describe('saveRawCandidate', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pollens-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('올바른 경로에 .txt 파일을 생성한다', () => {
    saveRawCandidate(MOCK_CANDIDATE, tmpDir);
    const expectedPath = path.join(tmpDir, '도지사', '경기도', '추미애.txt');
    expect(fs.existsSync(expectedPath)).toBe(true);
  });

  it('저장된 파일에 이름, 기호, 정당이 포함된다', () => {
    saveRawCandidate(MOCK_CANDIDATE, tmpDir);
    const content = fs.readFileSync(
      path.join(tmpDir, '도지사', '경기도', '추미애.txt'),
      'utf-8'
    );
    expect(content).toContain('이름: 추미애');
    expect(content).toContain('기호: 1');
    expect(content).toContain('정당: 더불어민주당');
  });

  it('rawText가 파일에 포함된다', () => {
    saveRawCandidate(MOCK_CANDIDATE, tmpDir);
    const content = fs.readFileSync(
      path.join(tmpDir, '도지사', '경기도', '추미애.txt'),
      'utf-8'
    );
    expect(content).toContain('경기도를 더 살기 좋은 곳으로 만들겠습니다.');
  });

  it('rawText가 비어있으면 안내 메시지를 표시한다', () => {
    saveRawCandidate({ ...MOCK_CANDIDATE, rawText: '' }, tmpDir);
    const content = fs.readFileSync(
      path.join(tmpDir, '도지사', '경기도', '추미애.txt'),
      'utf-8'
    );
    expect(content).toContain('PDF 텍스트 추출 불가');
  });

  it('pdfUrl이 있으면 공약PDF 링크를 포함한다', () => {
    saveRawCandidate(MOCK_CANDIDATE, tmpDir);
    const content = fs.readFileSync(
      path.join(tmpDir, '도지사', '경기도', '추미애.txt'),
      'utf-8'
    );
    expect(content).toContain('공약PDF: https://cdn.nec.go.kr/test.pdf');
  });

  it('pdfUrl이 없으면 공약PDF 줄을 생략하고 안내 메시지를 표시한다', () => {
    saveRawCandidate(
      { ...MOCK_CANDIDATE, pdfUrl: undefined, rawText: '', pbinfoUrl: 'https://cdn.nec.go.kr/pbinfo.pdf' },
      tmpDir
    );
    const content = fs.readFileSync(
      path.join(tmpDir, '도지사', '경기도', '추미애.txt'),
      'utf-8'
    );
    expect(content).not.toContain('공약PDF:');
    expect(content).toContain('선거공보PDF: https://cdn.nec.go.kr/pbinfo.pdf');
    expect(content).toContain('PDF 텍스트 추출 불가');
  });

  it('pbinfoUrl이 있으면 선거공보PDF 링크를 포함한다', () => {
    saveRawCandidate(
      { ...MOCK_CANDIDATE, pbinfoUrl: 'https://cdn.nec.go.kr/pbinfo.pdf' },
      tmpDir
    );
    const content = fs.readFileSync(
      path.join(tmpDir, '도지사', '경기도', '추미애.txt'),
      'utf-8'
    );
    expect(content).toContain('선거공보PDF: https://cdn.nec.go.kr/pbinfo.pdf');
  });
});
