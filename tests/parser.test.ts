// tests/parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseRawText, parsePledges, extractSection } from '../scripts/parser';

// 실제 policy.nec.go.kr에서 복사한 원문
const SAMPLE_RAW_TEXT = `선거명 경기도지사선거 선거구명 경기도후보자명 추미애 기호 1 소속정당명 더불어민주당공약순위: 1 제목 : 수도권 30분 출근 대전환□ 목 표○ 길 위에 버리는 시간을 도민에게 돌려주기 위한 광역교통망 구축○ 이동에 대한 부담과 피로도를 덜어 도민의 보편적 이동권 보장을 확대□ 이행방법○ GTX 지체 없는 개통 추진○ 수도권 원(One)패스 추진□ 이행기간○ 2026년~2030년 추진□ 재원조달방안 등○ 2026년의 경우 기존 예산의 조정 또는 추가경정예산 편성을 통해 추진공약순위: 2 제목 : 경기도 청년 기회 확대□ 목 표○ 청년 일자리·주거·문화 지원 강화□ 이행방법○ 청년 특별 채용 확대○ 청년 임대주택 공급□ 이행기간○ 2026년~2027년□ 재원조달방안 등○ 도 자체 예산으로 추진`;

describe('extractSection', () => {
  it('목 표 섹션에서 ○ 항목을 추출한다', () => {
    const result = extractSection(SAMPLE_RAW_TEXT, '목\\s*표');
    expect(result).toContain('길 위에 버리는 시간을 도민에게 돌려주기 위한 광역교통망 구축');
    expect(result).toContain('이동에 대한 부담과 피로도를 덜어 도민의 보편적 이동권 보장을 확대');
  });

  it('이행방법 섹션에서 ○ 항목을 추출한다', () => {
    const result = extractSection(SAMPLE_RAW_TEXT, '이행방법');
    expect(result).toContain('GTX 지체 없는 개통 추진');
  });

  it('해당 섹션이 없으면 빈 배열을 반환한다', () => {
    const result = extractSection('아무 텍스트', '목\\s*표');
    expect(result).toEqual([]);
  });
});

describe('parsePledges', () => {
  it('공약순위 마커로 공약 블록을 분리한다', () => {
    const pledges = parsePledges(SAMPLE_RAW_TEXT);
    expect(pledges).toHaveLength(2);
    expect(pledges[0].rank).toBe(1);
    expect(pledges[0].title).toBe('수도권 30분 출근 대전환');
    expect(pledges[1].rank).toBe(2);
    expect(pledges[1].title).toBe('경기도 청년 기회 확대');
  });

  it('각 공약의 목표 항목을 파싱한다', () => {
    const pledges = parsePledges(SAMPLE_RAW_TEXT);
    expect(pledges[0].goal).toContain('길 위에 버리는 시간을 도민에게 돌려주기 위한 광역교통망 구축');
  });

  it('각 공약의 이행방법 항목을 파싱한다', () => {
    const pledges = parsePledges(SAMPLE_RAW_TEXT);
    expect(pledges[0].method).toContain('GTX 지체 없는 개통 추진');
  });

  it('각 공약의 이행기간 항목을 파싱한다', () => {
    const pledges = parsePledges(SAMPLE_RAW_TEXT);
    expect(pledges[0].period).toContain('2026년~2030년 추진');
  });

  it('각 공약의 재원조달 항목을 파싱한다', () => {
    const pledges = parsePledges(SAMPLE_RAW_TEXT);
    expect(pledges[0].budget).toContain('2026년의 경우 기존 예산의 조정 또는 추가경정예산 편성을 통해 추진');
  });
});

describe('parseRawText', () => {
  it('헤더에서 후보자 정보를 추출한다', () => {
    const candidate = parseRawText(SAMPLE_RAW_TEXT, '도지사', '경기도');
    expect(candidate.name).toBe('추미애');
    expect(candidate.ballotNumber).toBe(1);
    expect(candidate.party).toBe('더불어민주당');
    expect(candidate.district).toBe('경기도');
    expect(candidate.electionType).toBe('도지사');
  });

  it('공약 목록을 포함한다', () => {
    const candidate = parseRawText(SAMPLE_RAW_TEXT, '도지사', '경기도');
    expect(candidate.pledges).toHaveLength(2);
  });

  it('collectedAt이 ISO8601 형식이다', () => {
    const candidate = parseRawText(SAMPLE_RAW_TEXT, '도지사', '경기도');
    expect(() => new Date(candidate.collectedAt)).not.toThrow();
    expect(new Date(candidate.collectedAt).toISOString()).toBe(candidate.collectedAt);
  });

  it('파싱 불가능한 텍스트에서 오류를 던진다', () => {
    expect(() => parseRawText('이상한 텍스트', '도지사', '경기도')).toThrow();
  });
});
