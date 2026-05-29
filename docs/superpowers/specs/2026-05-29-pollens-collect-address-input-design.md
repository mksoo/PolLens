# Design: `/pollens-collect` 주소 입력 기반 선거구 자동 결정

**날짜:** 2026-05-29  
**범위:** `/pollens-collect` 커맨드 + `collect.ts` 및 관련 스크래퍼 수정

---

## 목표

현재 동탄5동으로 하드코딩된 수집 대상을 제거하고, 사용자가 자신의 주소를 입력하면 전국 어디서든 해당 선거구 후보 공약을 수집할 수 있도록 확장한다.

---

## 사용자 흐름

`/pollens-collect` 실행 시 Claude가 다음 선택지를 제시한다:

```
선거구를 어떻게 찾을까요?

A) 직접 입력
   아래 링크에서 읍/면/동을 검색하면 선거구 정보가 나옵니다.
   → https://info.nec.go.kr/bizcommon/popup/popup_search_sg_emd.xhtml?electionId=0020260603
   결과 내용을 복사해서 붙여넣어 주세요.

B) 자동 탐색
   주소만 알려주면 위 사이트를 자동으로 탐색합니다.
   (Playwright 사용, 토큰 추가 소모)
```

### Path A — 직접 입력

1. NEC URL 안내 후 "결과를 붙여넣어 주세요" 요청
2. 사용자가 NEC 사이트에서 본인 읍/면/동 검색 후 결과 붙여넣기
3. Claude가 붙여넣기 내용에서 파싱:
   - 시도명 → region code
   - 시군구명 → cityText (시장 스크래퍼용)
   - 중간 구획(구/읍/면/동 조합) → intermediateCityText (도의원/시의원 스크래퍼용)
   - 도의원 선거구명 → 도의원 districtText
   - 시의원 선거구명 → 시의원 districtText
4. ScraperConfig 배열 구성 → `collect.ts --config-json '[...]'` 실행

### Path B — 자동 탐색

1. 토큰 소모 사전 경고 표시
2. Claude가 질문: 시도, 시군구, 읍면동
3. Playwright로 `info.nec.go.kr/bizcommon/popup/popup_search_sg_emd.xhtml?electionId=0020260603` 접근
4. 주소 입력 후 결과 테이블에서 도의원/시의원 선거구명 추출
5. 확인 메시지 출력 후 `collect.ts --config-json '[...]'` 실행

---

## 코드 변경 범위

### 1. `scripts/types.ts` — ScraperConfig 확장

```typescript
export interface ScraperConfig {
  electionType: ElectionType;
  regionCode: string;     // NEC region code (e.g. '4100')
  region: string;         // 데이터 경로용 (e.g. '경기도', '화성시')
  district: string;       // 데이터 경로용 (e.g. '화성시제3선거구')
  cityText?: string;      // 시·군 팝업 텍스트 (시장/도의원/시의원)
  districtText?: string;  // 선거구 팝업 텍스트 (도의원/시의원)
}
```

기존 `district` 필드는 데이터 저장 경로에 계속 사용. `districtText`가 새로 추가되어 NEC 사이트 팝업 클릭에 사용됨.

### 2. `scripts/scrapers/base.ts`

- `export const REGION_CODE = '4100'` 제거
- 모든 스크래퍼가 `config.regionCode`를 직접 사용

### 3. `scripts/scrapers/mayor.ts`

```typescript
// 변경 전
await navigateToElectionList(page, '구·시·군의 장선거', REGION_CODE, '화성시');
// 변경 후
await navigateToElectionList(page, '구·시·군의 장선거', config.regionCode, config.cityText);
```

### 4. `scripts/scrapers/provincial.ts`

```typescript
// 변경 전
await navigateToElectionList(page, '시·도의회의원선거', REGION_CODE, '화성시동탄구', config.district);
// 변경 후
await navigateToElectionList(page, '시·도의회의원선거', config.regionCode, config.cityText, config.districtText);
```

### 5. `scripts/scrapers/municipal.ts`

`provincial.ts`와 동일한 패턴. `config.regionCode`, `config.cityText`, `config.districtText` 사용.

### 6. `scripts/collect.ts`

- `--config-json '[...]'` 플래그 추가: JSON 문자열로 ScraperConfig 배열을 직접 전달
- 17개 시도 → region code 룩업 테이블 추가 (collect.ts 내부 상수)
- 인자 없이 실행하면 기존 `DONGTAN5_CONFIGS` 사용 (하위 호환 유지)

**region code 테이블 (예시):**
```typescript
const REGION_CODES: Record<string, string> = {
  '서울특별시': '1100', '부산광역시': '2600', '대구광역시': '2700',
  '인천광역시': '2800', '광주광역시': '2900', '대전광역시': '3000',
  '울산광역시': '3100', '세종특별자치시': '3600', '경기도': '4100',
  '강원특별자치도': '4200', '충청북도': '4300', '충청남도': '4400',
  '전북특별자치도': '4500', '전라남도': '4600', '경상북도': '4700',
  '경상남도': '4800', '제주특별자치도': '5000',
};
```

### 7. `scripts/resolve-district.ts` (신규)

Path B 전용 Playwright 모듈:

```typescript
interface ResolvedDistricts {
  sido: string;
  sigungu: string;
  regionCode: string;
  mayorCityText: string;        // 시장 팝업용 (e.g. '화성시')
  districtCityText: string;     // 도의원/시의원 팝업용 (e.g. '화성시동탄구')
  provincialDistrict: string;   // 도의원 선거구명
  municipalDistrict: string;    // 시의원 선거구명
}

export async function resolveDistrictByAddress(
  sido: string,
  sigungu: string,
  emd: string   // 읍/면/동
): Promise<ResolvedDistricts>
```

### 8. `.claude/commands/pollens-collect.md`

Path A/B 선택 흐름으로 전면 개정. 기존 동탄5동 고정 실행 내용 제거.

---

## 하위 호환성

- `npm run collect` (인자 없음): 기존 동탄5동 configs 그대로 동작
- `npx ts-node scripts/collect.ts --type 시장`: 기존 동작 유지
- 새 `--config-json` 플래그는 추가 옵션

---

## 에러 처리

- Path A에서 붙여넣기 내용 파싱 실패 시: Claude가 구체적으로 어떤 정보가 부족한지 안내
- Path B에서 Playwright 탐색 실패 시: 오류 메시지 출력 후 Path A로 안내
- 알 수 없는 시도명 입력 시: region code 테이블 목록 출력
