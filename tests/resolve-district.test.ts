// tests/resolve-district.test.ts
import { describe, it, expect } from 'vitest';
import { parseDistrictResult } from '../scripts/resolve-district';
import type { DistrictRow } from '../scripts/resolve-district';

describe('parseDistrictResult', () => {
  const mockRows: DistrictRow[] = [
    { electionName: '시·도의회의원선거', districtCity: '화성시동탄구', districtName: '화성시제3선거구' },
    { electionName: '구·시·군의회의원선거', districtCity: '화성시동탄구', districtName: '화성시다선거구' },
    { electionName: '시·도지사선거', districtCity: '', districtName: '경기도' },
  ];

  it('도의원 선거구를 추출한다', () => {
    const result = parseDistrictResult(mockRows, '화성시');
    expect(result.provincialDistrict).toBe('화성시제3선거구');
  });

  it('시의원 선거구를 추출한다', () => {
    const result = parseDistrictResult(mockRows, '화성시');
    expect(result.municipalDistrict).toBe('화성시다선거구');
  });

  it('districtCityText는 도의원 행의 districtCity를 사용한다', () => {
    const result = parseDistrictResult(mockRows, '화성시');
    expect(result.districtCityText).toBe('화성시동탄구');
  });

  it('mayorCityText는 전달된 sigungu를 그대로 사용한다', () => {
    const result = parseDistrictResult(mockRows, '화성시');
    expect(result.mayorCityText).toBe('화성시');
  });

  it('도의원 행이 없으면 오류를 던진다', () => {
    const rowsWithoutProvincial = mockRows.filter(r => r.electionName !== '시·도의회의원선거');
    expect(() => parseDistrictResult(rowsWithoutProvincial, '화성시')).toThrow('도의원 선거구를 찾을 수 없습니다');
  });

  it('시의원 행이 없으면 오류를 던진다', () => {
    const rowsWithoutMunicipal = mockRows.filter(r => r.electionName !== '구·시·군의회의원선거');
    expect(() => parseDistrictResult(rowsWithoutMunicipal, '화성시')).toThrow('시의원 선거구를 찾을 수 없습니다');
  });
});
