# PolLens 오케스트레이터 재구성 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/pollens`를 오케스트레이터로 전환하고, 공약 비교 분석을 `/pollens-compare` 서브에이전트로 분리한다.

**Architecture:** 3개 스킬로 책임 분리. `pollens`(오케스트레이터)가 대화 흐름을 소유하고 `pollens-compare`(단일 작업 실행기)에 electionType 파라미터를 전달해 비교표를 생성한다. `pollens-collect`는 변경 없음.

**Tech Stack:** Claude Code skill files (Markdown), `.claude/commands/` 디렉터리

---

### Task 1: `/pollens-compare` 스킬 파일 생성

현재 `pollens.md`의 Step 3~4(PDF 읽기 + 비교표 출력) 로직을 추출해 새 파일로 만든다.

**Files:**
- Create: `.claude/commands/pollens-compare.md`
- Reference: `.claude/commands/pollens.md` (Step 3~4 추출)

- [ ] **Step 1: 현재 pollens.md Step 3~4 내용 확인**

  `.claude/commands/pollens.md` 파일을 읽어 Step 3(후보 목록 및 PDF 읽기)와 Step 4(공약 비교표 출력) 전체 내용을 파악한다.

- [ ] **Step 2: pollens-compare.md 파일 생성**

  `.claude/commands/pollens-compare.md`를 아래 내용으로 생성한다:

  ```markdown
  # /pollens-compare — 후보 공약 비교표 출력

  `/pollens` 오케스트레이터에서 호출하거나 단독으로 실행한다.
  `electionType`을 입력받아 비교표 하나를 출력하고 종료한다.

  ---

  ## 금지 표현 (FORBIDDEN — 절대 사용 금지)

  다음 표현은 이 스킬 실행 중 **어떤 상황에서도 사용하지 않는다**:

  - `1위`
  - `가장 적합`
  - `추천`
  - `승자`
  - `점수`
  - `더 나은 후보`
  - `좋은 후보`

  AI는 정보만 제공한다. 판단·추천·순위는 절대 표시하지 않는다.

  ---

  ## Step 1: electionType 확인

  대화 컨텍스트에서 `electionType` 값을 확인한다 (도지사|시장|도의원|시의원|교육감).

  값이 없으면 묻는다:

  ```
  어떤 선거의 후보 공약을 비교할까요?
  1. 도지사
  2. 시장
  3. 도의원
  4. 시의원
  5. 교육감
  ```

  ---

  ## Step 2: 후보 목록 추출

  `/Users/mksoo/Documents/dev/tmp/PolLens/data/meta.json` 파일을 읽는다.

  `candidates` 배열에서 해당 `electionType` 후보를 모두 추출한다.

  후보가 없으면:

  ```
  이 선거 데이터가 없습니다. /pollens-collect 를 실행해주세요.
  ```

  ---

  ## Step 3: PDF 읽기

  후보를 `ballotNumber` 오름차순으로 정렬한다.

  각 후보에 대해:
  - `pdfPath`가 있으면: `/Users/mksoo/Documents/dev/tmp/PolLens/<pdfPath>` 경로의 PDF를 Read 도구로 읽는다. 공약 내용을 해석한다.
  - `pdfPath`가 없고 `pbinfoPdfPath`가 있으면: `/Users/mksoo/Documents/dev/tmp/PolLens/<pbinfoPdfPath>` 경로의 PDF를 Read 도구로 읽는다. 이미지 기반 PDF이므로 텍스트 추출이 어려울 수 있다. 읽을 수 없으면 공약 셀에 `(선거공보 링크 참조)` 표시.
  - 아무 PDF도 없으면: 공약 셀에 `(공약 파일 없음)` 표시.

  ---

  ## Step 4: 공약 비교표 출력

  기호번호 오름차순으로 정렬된 후보자들의 공약을 아래 형식의 Markdown 표로 출력한다.

  형식:

  ```
  ## [선거명] 후보 공약 비교

  | | 기호 1 · [이름] ([정당]) | 기호 2 · [이름] ([정당]) | ...  |
  |--|--|--|--|
  | **공약 1** | [공약 제목] | [공약 제목] | ... |
  | **공약 2** | [공약 제목] | [공약 제목] | ... |
  | **공약 3** | [공약 제목] | [공약 제목] | ... |
  | **공약 4** | [공약 제목] | [공약 제목] | ... |
  | **공약 5** | [공약 제목] | [공약 제목] | ... |

  ※ 기호번호 순 정렬 / 판단·추천 없음
  ```

  규칙:
  - 열 순서는 기호번호 오름차순으로만 배치한다.
  - 공약이 5개 미만인 후보는 해당 셀을 `-`로 채운다.
  - PDF 열람 불가 후보는 공약 셀 대신 `(선거공보 링크 참조)`를 표시하고, 표 아래에 `pbinfoUrl`을 별도 나열한다.
  - 공약 제목은 AI가 PDF 내용을 해석한 결과를 간결하게 기재한다. 평가하거나 의견을 추가하지 않는다.
  - 표 외에 어떤 평가·비교·판단도 추가하지 않는다.

  ---

  ## 종료

  표 출력 후 추가 대화 없이 종료한다.
  후속 안내(다른 선거, 추가 검색)는 `/pollens` 오케스트레이터가 담당한다.
  ```

- [ ] **Step 3: 파일 생성 확인**

  ```bash
  ls -la /Users/mksoo/Documents/dev/tmp/PolLens/.claude/commands/pollens-compare.md
  ```

  Expected: 파일이 존재함

- [ ] **Step 4: Commit**

  ```bash
  git add .claude/commands/pollens-compare.md
  git commit -m "feat: add pollens-compare sub-agent skill"
  ```

---

### Task 2: `/pollens` 오케스트레이터로 전환

현재 `pollens.md`에서 Step 3~4(PDF + 표)를 제거하고, `pollens-compare` 호출 + 루프 구조로 교체한다.

**Files:**
- Modify: `.claude/commands/pollens.md`

- [ ] **Step 1: 현재 pollens.md 전체 내용 파악**

  `.claude/commands/pollens.md`를 읽는다.

- [ ] **Step 2: pollens.md를 오케스트레이터 버전으로 교체**

  아래 내용으로 `.claude/commands/pollens.md`를 교체한다:

  ```markdown
  # /pollens — 2026 지방선거 후보 공약 비교

  경기도 화성시 동탄5동 유권자를 위한 2026-06-03 지방선거 후보 공약 비교 오케스트레이터.

  ---

  ## 금지 표현 (FORBIDDEN — 절대 사용 금지)

  다음 표현은 이 스킬 실행 중 **어떤 상황에서도 사용하지 않는다**:

  - `1위`
  - `가장 적합`
  - `추천`
  - `승자`
  - `점수`
  - `더 나은 후보`
  - `좋은 후보`

  AI는 정보만 제공한다. 판단·추천·순위는 절대 표시하지 않는다.

  ---

  ## Step 1: 캐시 확인

  `/Users/mksoo/Documents/dev/tmp/PolLens/data/meta.json` 파일을 읽는다.

  - 파일이 없거나 `collectedAt` 값이 현재 시각 기준 24시간 이전이면 → 중단:

    ```
    데이터가 없거나 오래되었습니다. 먼저 /pollens-collect 를 실행해 데이터를 수집하세요.
    ```

  - `collectedAt`이 24시간 이내이면 → Step 2로 진행.

  ---

  ## Step 2: 선거 목록 안내

  다음을 **그대로** 출력한다:

  ```
  경기도 화성시 동탄5동 기준으로 2026-06-03에 다음 선거가 예정되어 있습니다:

  1. 도지사 — 경기도
  2. 시장 — 화성시
  3. 도의원 — 화성시제3선거구
  4. 시의원 — 화성시다선거구
  5. 교육감 — 경기도

  어떤 선거부터 볼까요?
  ```

  사용자의 선택을 기다린다.

  ---

  ## Step 3: pollens-compare 호출

  사용자가 선택한 번호를 아래 매핑으로 `electionType`으로 변환한다:

  ```
  1 → 도지사
  2 → 시장
  3 → 도의원
  4 → 시의원
  5 → 교육감
  ```

  `/pollens-compare` 스킬을 호출한다. 호출 시 위에서 결정한 `electionType`을 대화 컨텍스트로 전달한다.

  ---

  ## Step 4: 후속 안내 및 루프

  `/pollens-compare`가 비교표를 출력하면 다음을 묻는다:

  ```
  다른 선거도 볼까요? 이 후보들에 대해 추가 정보를 찾아드릴까요?
  ```

  ### 4a. 다른 선거를 선택한 경우

  Step 2로 돌아가 선거 목록을 다시 안내한다.

  ### 4b. 추가 정보를 요청한 경우

  다음을 묻는다:

  ```
  어떤 분야가 가장 중요하세요?
  (예: 교통, 환경, 복지, 주거, 교육, 경제 등)
  ```

  사용자가 분야를 답하면 WebSearch를 사용해 해당 후보자들의 관련 기사·SNS·과거 발언을 검색한다.

  검색 결과 제시 규칙:
  - 사실 정보만 제시한다.
  - 출처(매체명, 날짜)를 함께 표기한다.
  - 판단·추천·순위는 절대 표시하지 않는다.
  - 금지 표현 목록의 표현을 사용하지 않는다.

  ### 4c. 종료

  사용자가 더 이상 원하지 않으면 종료한다.
  ```

- [ ] **Step 3: 변경 내용 확인**

  `.claude/commands/pollens.md`를 읽어 Step 3가 "pollens-compare 호출"로 변경되었고 PDF 읽기 로직이 없어졌는지 확인한다.

- [ ] **Step 4: Commit**

  ```bash
  git add .claude/commands/pollens.md
  git commit -m "refactor: convert pollens to orchestrator, delegate analysis to pollens-compare"
  ```

---

### Task 3: 스킬 파일 최종 검증

두 스킬 파일이 올바르게 작성되었는지 확인한다.

**Files:**
- Read: `.claude/commands/pollens.md`
- Read: `.claude/commands/pollens-compare.md`

- [ ] **Step 1: pollens.md 검증**

  파일을 읽어 다음을 확인한다:
  - PDF 읽기 로직이 없음
  - `pollens-compare` 호출 지시가 있음
  - 금지 표현 목록이 있음
  - Step 4 루프(다른 선거, 추가 정보) 로직이 있음

- [ ] **Step 2: pollens-compare.md 검증**

  파일을 읽어 다음을 확인한다:
  - `electionType` 입력 처리가 있음
  - PDF 읽기 로직(pdfPath/pbinfoPdfPath 분기)이 있음
  - 비교표 형식이 정확히 명시되어 있음
  - 금지 표현 목록이 있음
  - "종료" 섹션에서 후속 대화 없이 종료한다고 명시됨

- [ ] **Step 3: 최종 Commit (필요 시)**

  미커밋 변경이 있으면:

  ```bash
  git status
  git add .claude/commands/
  git commit -m "chore: finalize pollens skill restructure"
  ```
