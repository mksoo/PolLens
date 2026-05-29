# /pollens-collect — PolLens 데이터 수집

2026-06-03 지방선거 후보 공약 데이터를 중앙선거관리위원회(policy.nec.go.kr)에서 수집하여
`/Users/mksoo/Documents/dev/tmp/PolLens/data/` 에 저장한다.

---

## 실행

먼저 다음 메시지를 출력한다:

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

---

## Path A — 직접 입력

사용자가 NEC 사이트 결과를 붙여넣으면 다음을 파싱한다:
- 시도명 (예: "경기도") → `scripts/collect.ts`의 `REGION_CODES` 테이블로 region code 조회
- 시군구명 (예: "화성시") → 시장·도의원·시의원 스크래퍼의 `cityText`
- 시군구+구 조합 (예: "화성시동탄구") → 도의원·시의원 스크래퍼의 `cityText` (districtCityText)
- 도의원 선거구명 (예: "화성시제3선거구") → 도의원 `districtText`
- 시의원 선거구명 (예: "화성시다선거구") → 시의원 `districtText`

파싱 후 아래 명령을 실행한다 (JSON은 실제 파싱 결과로 채운다):

```bash
cd /Users/mksoo/Documents/dev/tmp/PolLens && npx ts-node scripts/collect.ts --config-json '[
  {"electionType":"도지사","regionCode":"<regionCode>","region":"<sido>","district":"<sido>"},
  {"electionType":"시장","regionCode":"<regionCode>","region":"<sigungu>","district":"<sigungu>","cityText":"<sigungu>"},
  {"electionType":"도의원","regionCode":"<regionCode>","region":"<sido>","district":"<provincialDistrict>","cityText":"<districtCityText>","districtText":"<provincialDistrict>"},
  {"electionType":"시의원","regionCode":"<regionCode>","region":"<sigungu>","district":"<municipalDistrict>","cityText":"<districtCityText>","districtText":"<municipalDistrict>"},
  {"electionType":"교육감","regionCode":"<regionCode>","region":"<sido>","district":"<sido>"}
]'
```

---

## Path B — 자동 탐색

다음 경고를 먼저 출력한다:

```
Playwright로 선관위 사이트를 탐색합니다. 추가 토큰이 소모됩니다.
```

그런 다음 사용자에게 순서대로 질문한다:
1. 시도 (예: 경기도)
2. 시군구 (예: 화성시)
3. 읍/면/동 (예: 동탄5동)

입력 완료 후 아래 명령을 실행한다:

```bash
cd /Users/mksoo/Documents/dev/tmp/PolLens && npx ts-node --transpile-only -e "
const { resolveDistrictByAddress } = require('./scripts/resolve-district');
resolveDistrictByAddress('<sido>', '<sigungu>', '<emd>').then(r => console.log(JSON.stringify(r)));
"
```

출력된 JSON을 파싱해 Path A와 동일한 `--config-json` 형식으로 collect.ts를 실행한다.

---

## 완료 후 안내

명령이 성공적으로 완료되면 다음을 출력한다:

```
✅ 수집 완료!
저장 위치: /Users/mksoo/Documents/dev/tmp/PolLens/data/

후보 공약을 분석하려면 /pollens 스킬을 실행하세요.
```

오류가 발생하면 오류 메시지를 그대로 출력하고 원인을 설명한다.
