# pollens 페르소나 입력 기능 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** pollens/pollens-compare 스킬에 선택적 페르소나 입력 기능을 추가하고, 하드코딩된 지역 텍스트를 일반화한다.

**Architecture:** 두 개의 마크다운 스킬 파일만 수정한다. `pollens.md`에 Step 1.5(페르소나 수집)를 추가하고, `pollens-compare.md`에 Step 4.5(페르소나 요약 출력)를 추가한다. `personaContext` 세션 변수를 통해 두 스킬이 데이터를 공유한다.

**Tech Stack:** Markdown skill files only — `.claude/commands/pollens.md`, `.claude/commands/pollens-compare.md`

---

## 파일 구조

| 파일 | 변경 유형 | 책임 |
|---|---|---|
| `.claude/commands/pollens.md` | Modify | 오케스트레이터 — 페르소나 수집, 읽기모드, 선거목록, 루프 |
| `.claude/commands/pollens-compare.md` | Modify | 비교표 출력 — 페르소나 요약 섹션 추가 |

---

## Task 1: pollens.md — 헤더 일반화

**Files:**
- Modify: `.claude/commands/pollens.md:3`

- [ ] **Step 1: Edit — 헤더에서 하드코딩된 지역 텍스트 제거**

  `old_string`:
  ```
  경기도 화성시 동탄5동 유권자를 위한 2026-06-03 지방선거 후보 공약 비교 오케스트레이터.
  ```

  `new_string`:
  ```
  2026-06-03 지방선거 후보 공약 비교 오케스트레이터.
  ```

- [ ] **Step 2: Verify**

  Read `.claude/commands/pollens.md` lines 1-5.  
  Expected: 3번째 줄이 `2026-06-03 지방선거 후보 공약 비교 오케스트레이터.`

- [ ] **Step 3: Commit**

  ```bash
  git add .claude/commands/pollens.md
  git commit -m "refactor(pollens): 헤더 하드코딩 지역 텍스트 제거"
  ```

---

## Task 2: pollens.md — Step 1.5 → Step 1.6 이름 변경

**Files:**
- Modify: `.claude/commands/pollens.md:46`

- [ ] **Step 1: Edit — 읽기 모드 단계 번호 변경**

  `old_string`:
  ```
  ## Step 1.5: 읽기 모드 선택 (세션 시작 시 한 번)
  ```

  `new_string`:
  ```
  ## Step 1.6: 읽기 모드 선택 (세션 시작 시 한 번)
  ```

  같은 파일 내 `readingMode` 설명 줄 직전 조건문도 변경:

  `old_string`:
  ```
  대화 컨텍스트에 `readingMode` 값이 이미 설정되어 있으면 이 단계를 건너뛴다.
  ```

  `new_string`:
  ```
  대화 컨텍스트에 `readingMode` 값이 이미 설정되어 있으면 이 단계를 건너뛴다.
  ```
  (내용 동일, 단계 번호 헤더만 변경으로 충분)

- [ ] **Step 2: Verify**

  Read `.claude/commands/pollens.md` lines 44-62.  
  Expected: `## Step 1.6: 읽기 모드 선택 (세션 시작 시 한 번)` 포함.

- [ ] **Step 3: Commit**

  ```bash
  git add .claude/commands/pollens.md
  git commit -m "refactor(pollens): Step 1.5 읽기모드 → Step 1.6 이름 변경"
  ```

---

## Task 3: pollens.md — 새 Step 1.5 삽입 (페르소나 수집)

**Files:**
- Modify: `.claude/commands/pollens.md` (Step 1 종료 ~ Step 1.6 사이)

- [ ] **Step 1: Edit — Step 1 구분선 직후에 새 Step 1.5 블록 삽입**

  `old_string` (Step 1 끝 ~ Step 1.6 헤더 사이의 현재 텍스트):
  ```
  - `collectedAt`이 24시간 이내이면 → Step 2로 진행.

  ---

  ## Step 1.6: 읽기 모드 선택 (세션 시작 시 한 번)
  ```

  `new_string`:
  ````
  - `collectedAt`이 24시간 이내이면 → Step 2로 진행.

  ---

  ## Step 1.5: 페르소나 / 관심분야 입력 (선택)

  대화 컨텍스트에 `personaContext` 값이 이미 설정되어 있으면 이 단계를 건너뛴다.

  아직 설정되지 않은 경우 다음을 출력하고 사용자 응답을 기다린다:

  ```
  분석에 반영할 관심분야나 페르소나가 있으면 알려주세요. (건너뛰려면 Enter)
  예: "30대 워킹맘, 교육과 보육 관심", "스타트업 종사자, 경제·규제 관심",
      또는 Notion/URL 링크로 페르소나 문서를 공유해도 됩니다.
  ```

  응답 처리:
  - **자유 텍스트 입력** → 그대로 `personaContext`에 저장한다.
  - **URL 입력** → `WebFetch` 도구로 내용을 가져와 핵심 관심분야만 요약해 `personaContext`에 저장한다.
  - **빈 입력 (Enter)** → `personaContext = null`로 설정한다. 이 세션에서 페르소나 관련 기능은 모두 비활성화된다.

  `personaContext`는 세션 전체에 유지된다 (세션 내 재질문 없음).

  ---

  ## Step 1.6: 읽기 모드 선택 (세션 시작 시 한 번)
  ````

- [ ] **Step 2: Verify**

  Read `.claude/commands/pollens.md` lines 40-75.  
  Expected: Step 1 → `---` → Step 1.5(페르소나) → `---` → Step 1.6(읽기모드) 순서로 등장.

- [ ] **Step 3: Commit**

  ```bash
  git add .claude/commands/pollens.md
  git commit -m "feat(pollens): Step 1.5 페르소나/관심분야 입력 단계 추가"
  ```

---

## Task 4: pollens.md — Step 2 / Step 4a 출력 텍스트 일반화

**Files:**
- Modify: `.claude/commands/pollens.md` (Step 2 및 Step 4a)

- [ ] **Step 1a: Edit — Step 2 출력 텍스트**

  `replace_all: true`로 아래 문자열 전체 치환:

  `old_string`:
  ```
  경기도 화성시 동탄5동 기준으로 2026-06-03에 다음 선거가 예정되어 있습니다:
  ```

  `new_string`:
  ```
  수집된 데이터 기준으로 2026-06-03에 다음 선거가 예정되어 있습니다:
  ```

  (Step 2와 Step 4a에 동일 문자열이 2번 등장하므로 `replace_all`로 한 번에 처리)

- [ ] **Step 2: Verify**

  ```bash
  grep -n "동탄5동" .claude/commands/pollens.md
  ```
  Expected: 출력 없음 (0 matches).

  ```bash
  grep -n "수집된 데이터 기준으로" .claude/commands/pollens.md
  ```
  Expected: 2개 라인 (Step 2, Step 4a).

- [ ] **Step 3: Commit**

  ```bash
  git add .claude/commands/pollens.md
  git commit -m "refactor(pollens): Step 2/4a 출력 텍스트 일반화"
  ```

---

## Task 5: pollens.md — Step 4에 MD 저장 옵션 추가

**Files:**
- Modify: `.claude/commands/pollens.md` (Step 4 ~ Step 4c)

- [ ] **Step 1: Edit — Step 4 후속 안내 프롬프트에 MD 옵션 추가**

  `old_string`:
  ```
  `/pollens-compare`가 비교표를 출력하면 다음을 묻는다:

  ```
  다른 선거도 볼까요? 이 후보들에 대해 추가 정보를 찾아드릴까요?
  ```
  ```

  `new_string`:
  ````
  `/pollens-compare`가 비교표를 출력하면 다음을 묻는다:

  ```
  다른 선거도 볼까요? 이 후보들에 대해 추가 정보를 찾아드릴까요?
  이 선거 분석을 MD 파일로 저장할까요?
  ```
  ````

- [ ] **Step 2: Edit — Step 4c 뒤에 Step 4d (MD 저장) 섹션 추가**

  `old_string`:
  ```
  ### 4c. 종료

  사용자가 더 이상 원하지 않으면 종료한다.
  ```

  `new_string`:
  ```
  ### 4c. MD 파일로 저장하는 경우

  파일명: `<PROJECT_ROOT>/<electionType>_후보_분석_<YYYY-MM-DD>.md`

  내용 구성:
  1. 방금 출력한 비교표 전체 (마크다운)
  2. 페르소나 관련 요약 섹션 (`personaContext`가 있는 경우)
  3. 출처 목록 (WebSearch 결과를 사용한 경우)

  Write 도구로 파일을 저장한 뒤 다음을 출력한다:

  ```
  분석 결과를 저장했습니다: <파일 경로>
  ```

  ### 4d. 종료

  사용자가 더 이상 원하지 않으면 종료한다.
  ```

- [ ] **Step 3: Verify**

  Read `.claude/commands/pollens.md` 마지막 30줄.  
  Expected: `### 4c. MD 파일로 저장하는 경우`와 `### 4d. 종료` 순서로 등장.

- [ ] **Step 4: Commit**

  ```bash
  git add .claude/commands/pollens.md
  git commit -m "feat(pollens): Step 4에 MD 보고서 저장 옵션 추가"
  ```

---

## Task 6: pollens-compare.md — Step 4.5 추가

**Files:**
- Modify: `.claude/commands/pollens-compare.md` (종료 섹션 바로 앞)

- [ ] **Step 1: Edit — `## 종료` 직전에 Step 4.5 블록 삽입**

  `old_string`:
  ```
  ---

  ## 종료

  표 출력 후 추가 대화 없이 종료한다.
  후속 안내(다른 선거 보기, 추가 정보 검색)는 `/pollens` 오케스트레이터가 담당한다.
  ```

  `new_string`:
  ````
  ---

  ## Step 4.5: 페르소나 관련 요약 (조건부)

  대화 컨텍스트에 `personaContext`가 null이거나 설정되어 있지 않으면 이 단계를 **완전히 건너뛴다**.

  `personaContext`가 있는 경우:

  1. `personaContext`에서 관심 분야 키워드를 1~5개 추출한다 (추가 PDF 읽기 없음 — Step 3에서 읽은 내용 활용).
  2. 구분선과 함께 아래 형식으로 출력한다:

  ```markdown
  ---
  ## 페르소나 관련 요약 ([관심분야 키워드])

  | | 기호 N · [이름] ([정당]) | 기호 N · [이름] ([정당]) | ... |
  |---|---|---|---|
  | [관심분야 1] | [해당 공약 1줄 요약] | [해당 공약 1줄 요약] | ... |
  | [관심분야 2] | [해당 공약 1줄 요약] | ... | ... |
  ```

  규칙:
  - 행: `personaContext`에서 추출한 관심 분야 1~5개
  - 열: 기호번호 오름차순 (Step 4 표와 동일 순서)
  - 각 셀: 해당 분야와 관련된 공약 1줄 요약. 관련 공약이 없으면 `-`
  - 금지 표현 목록 동일 적용 (`1위`, `가장 적합`, `추천`, `승자`, `점수`, `더 나은 후보`, `좋은 후보`)
  - 비교·평가·순위 표현 불가 (예: "이 분야에서 [후보]가 더 구체적" 등)

  ---

  ## 종료

  표 출력 후 추가 대화 없이 종료한다.
  후속 안내(다른 선거 보기, 추가 정보 검색)는 `/pollens` 오케스트레이터가 담당한다.
  ````

- [ ] **Step 2: Verify**

  Read `.claude/commands/pollens-compare.md` 마지막 45줄.  
  Expected: `## Step 4.5: 페르소나 관련 요약 (조건부)` → `## 종료` 순서로 등장. `personaContext`가 null일 때 건너뛰는 조건 명시.

  ```bash
  grep -n "personaContext" .claude/commands/pollens-compare.md
  ```
  Expected: 3개 이상 라인 등장.

- [ ] **Step 3: Commit**

  ```bash
  git add .claude/commands/pollens-compare.md
  git commit -m "feat(pollens-compare): Step 4.5 페르소나 관련 요약 섹션 추가"
  ```

---

## 최종 검증

- [ ] **전체 파일 최종 확인**

  ```bash
  grep -n "동탄5동" .claude/commands/pollens.md .claude/commands/pollens-compare.md
  ```
  Expected: 출력 없음.

  ```bash
  grep -n "Step 1\.5\|Step 1\.6\|Step 4\.5\|personaContext" .claude/commands/pollens.md
  ```
  Expected: Step 1.5(페르소나), Step 1.6(읽기모드), personaContext 다수 등장.

  ```bash
  grep -n "Step 4\.5\|personaContext" .claude/commands/pollens-compare.md
  ```
  Expected: Step 4.5, personaContext 등장.
