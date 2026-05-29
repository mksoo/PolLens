// tests/collect.test.ts
import { describe, it, expect } from 'vitest';
import { parseConfigJson, REGION_CODES } from '../scripts/collect';

describe('REGION_CODES', () => {
  it('경기도 코드가 4100이다', () => {
    expect(REGION_CODES['경기도']).toBe('4100');
  });

  it('17개 시도를 모두 포함한다', () => {
    expect(Object.keys(REGION_CODES)).toHaveLength(17);
  });

  it('서울특별시 코드가 1100이다', () => {
    expect(REGION_CODES['서울특별시']).toBe('1100');
  });
});

describe('parseConfigJson', () => {
  it('유효한 JSON 배열을 ScraperConfig[]로 반환한다', () => {
    const configs = [
      { electionType: '도지사', regionCode: '1100', region: '서울특별시', district: '서울특별시' }
    ];
    expect(parseConfigJson(JSON.stringify(configs))).toEqual(configs);
  });

  it('배열이 아닌 JSON은 오류를 던진다', () => {
    expect(() => parseConfigJson('{"key":"value"}')).toThrow('--config-json 값은 배열이어야 합니다');
  });

  it('잘못된 JSON 문자열은 SyntaxError를 던진다', () => {
    expect(() => parseConfigJson('not-json')).toThrow(SyntaxError);
  });
});
