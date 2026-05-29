# PDF 바이너리 저장 + meta.json 통합 설계

날짜: 2026-05-29  
상태: 승인됨

## 배경

현재 아키텍처는 수집 시점에 `pdf-parse`로 텍스트를 추출해 후보별 `.txt` 파일에 저장한다.
이미지 기반 선거공보 PDF(PBINFO)는 파싱 시 글자가 깨지고, `/pollens` 스킬 실행 시
Claude가 이미 추출된 텍스트를 해석하는 구조다.

## 목표

- PDF를 수집 시점에 바이너리 그대로 저장한다. 파싱은 `/pollens` 실행 시 Claude가 직접 담당한다.
- 후보별 `.txt` 파일을 제거하고 `meta.json` 하나에 모든 후보 메타데이터를 통합한다.
- `pdf-parse` 의존성을 제거한다.

## 데이터 흐름

```
collect.ts
  → scraper/*.ts
    → PDF 바이너리 다운로드
    → data/<electionType>/<region>/<name>.pdf         (P5_PRMS_PUB, optional)
    → data/<electionType>/<region>/<name>_공보.pdf    (PBINFO, optional)
    → data/meta.json 의 candidates[] 업데이트

/pollens skill
  → meta.json 읽기 (선거 필터링, 기호번호 정렬)
  → 후보별 pdfPath / pbinfoPdfPath 를 Read 도구로 직접 열람
  → Claude가 PDF 내용을 해석해 공약 비교표 출력
```

## meta.json 스키마

```json
{
  "collectedAt": "2026-05-29T11:00:00.000Z",
  "elections": ["도지사", "시장", "도의원", "시의원", "교육감"],
  "candidates": [
    {
      "name": "추미애",
      "ballotNumber": 1,
      "party": "더불어민주당",
      "electionType": "도지사",
      "region": "경기도",
      "district": "경기도",
      "pdfPath": "data/도지사/경기도/추미애.pdf",
      "pbinfoPdfPath": "data/도지사/경기도/추미애_공보.pdf",
      "pdfUrl": "https://cdn.nec.go.kr/...",
      "pbinfoUrl": "https://cdn.nec.go.kr/...",
      "collectedAt": "2026-05-29T11:00:00.000Z"
    }
  ]
}
```

- `pdfPath`: P5_PRMS_PUB 링크가 있을 때만 설정 (optional)
- `pbinfoPdfPath`: PBINFO 링크가 있을 때만 설정 (optional)
- `pdfUrl` / `pbinfoUrl`: 원본 CDN URL 보존 (직접 열람용)

## 파일 시스템 변경

| Before | After |
|--------|-------|
| `data/도지사/경기도/추미애.txt` | 제거 |
| `data/meta.json` (collectedAt, elections만) | `candidates[]` 배열 추가 |
| — | `data/도지사/경기도/추미애.pdf` |
| — | `data/도지사/경기도/추미애_공보.pdf` |

## 코드 변경

### 제거
- `scripts/mdWriter.ts` — txt 저장 로직 전체 제거
- `pdf-parse` npm 의존성

### 변경
- `scripts/types.ts`
  - `RawCandidate`: `rawText` 제거, `pdfPath?` / `pbinfoPdfPath?` 추가
  - `CacheMeta`: `candidates: CandidateMeta[]` 배열 추가 (새 타입)
- `scripts/cache.ts`
  - `saveMeta()`: candidates 배열도 함께 저장
  - `loadMeta()`: candidates 배열 반환
- `scripts/scrapers/base.ts`
  - `downloadPdfText()` → `downloadPdf(url, destPath)`: 바이너리 저장
- `scripts/scrapers/*.ts` (5개)
  - `downloadPdf` 호출로 교체, `saveRawCandidate` 제거, `saveMeta` 호출로 교체
- `.claude/commands/pollens.md`
  - Step 3: txt 파일 읽기 → meta.json에서 후보 목록 조회 후 PDF 파일 Read

### 유지
- `scripts/collect.ts` — 진입점 구조 동일
- `scripts/scrapers/base.ts` — `navigateToElectionList`, `extractCandidateRefs` 동일

## 테스트 영향

- `tests/mdWriter.test.ts` — 전체 제거 (mdWriter 삭제됨)
- `tests/cache.test.ts` — candidates 저장/로드 케이스 추가
- 새 `tests/base.test.ts` — `downloadPdf` 파일 저장 테스트

## 엣지 케이스

- PDF 다운로드 실패 시: pdfPath를 meta.json에 기록하지 않고 계속 진행 (기존과 동일)
- pdfPath도 pbinfoPdfPath도 없는 후보: meta.json에 등록되지만 `/pollens`에서 "공약 파일 없음" 표시
- 재수집 시: 기존 PDF 파일 덮어쓰기, meta.json candidates 전체 교체
