// scripts/mdWriter.ts
import * as fs from 'fs';
import * as path from 'path';
import type { Candidate } from './types';

export function candidateToMd(candidate: Candidate): string {
  const header = `# ${candidate.name} — ${candidate.electionType} · ${candidate.district}
> 기호: ${candidate.ballotNumber} · ${candidate.party} · 수집: ${candidate.collectedAt}

---
`;

  const pledgeSections = candidate.pledges
    .map((p) => {
      const lines = [
        `### 공약 ${p.rank}: ${p.title}`,
        '',
        '**목표**',
        ...(p.goal.length > 0 ? p.goal.map((g) => `- ${g}`) : ['- (정보 없음)']),
        '',
        '**이행방법**',
        ...(p.method.length > 0 ? p.method.map((m) => `- ${m}`) : ['- (정보 없음)']),
        '',
        '**이행기간**',
        ...(p.period.length > 0 ? p.period.map((t) => `- ${t}`) : ['- (정보 없음)']),
        '',
        '**재원조달**',
        ...(p.budget.length > 0 ? p.budget.map((b) => `- ${b}`) : ['- (정보 없음)']),
      ];
      return lines.join('\n');
    })
    .join('\n\n---\n\n');

  return header + '\n' + pledgeSections + '\n';
}

export function saveCandidateMd(candidate: Candidate, dataDir: string): void {
  const dir = path.join(dataDir, candidate.electionType, candidate.region);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${candidate.name}.md`);
  fs.writeFileSync(filePath, candidateToMd(candidate), 'utf-8');
}
