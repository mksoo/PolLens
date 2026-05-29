# /pollens-collect — PolLens 데이터 수집

2026-06-03 지방선거 후보 공약 데이터를 중앙선거관리위원회(policy.nec.go.kr)에서 수집하여
`/Users/mksoo/Documents/dev/tmp/PolLens/data/` 에 저장한다.

수집 대상:
- 도지사 (경기도)
- 시장 (화성시)
- 도의원 (화성시제3선거구)
- 시의원 (화성시다선거구)
- 교육감 (경기도)

---

## 실행

다음 메시지를 출력한다:

```
데이터를 수집합니다. Playwright 브라우저를 실행하여 후보 공약 PDF를 다운로드합니다.
약 2~3분 소요됩니다...
```

그런 다음 아래 명령을 실행한다:

```bash
cd /Users/mksoo/Documents/dev/tmp/PolLens && npx ts-node scripts/collect.ts
```

---

## 완료 후 안내

명령이 성공적으로 완료되면 다음을 출력한다:

```
✅ 수집 완료!
저장 위치: /Users/mksoo/Documents/dev/tmp/PolLens/data/

후보 공약을 분석하려면 /pollens 스킬을 실행하세요.
```

오류가 발생하면 오류 메시지를 그대로 출력하고 원인을 설명한다.
