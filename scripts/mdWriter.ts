// scripts/mdWriter.ts
import * as fs from 'fs';
import * as path from 'path';
import type { RawCandidate } from './types';

/** 후보자 raw 데이터를 단순 텍스트 파일로 저장한다. AI가 직접 해석한다. */
export function saveRawCandidate(candidate: RawCandidate, dataDir: string): void {
  const dir = path.join(dataDir, candidate.electionType, candidate.region);
  fs.mkdirSync(dir, { recursive: true });

  const lines = [
    `이름: ${candidate.name}`,
    `기호: ${candidate.ballotNumber}`,
    `정당: ${candidate.party}`,
    `선거: ${candidate.electionType} / ${candidate.district}`,
    `공약PDF: ${candidate.pdfUrl}`,
    ...(candidate.pbinfoUrl ? [`선거공보PDF: ${candidate.pbinfoUrl}`] : []),
    `수집일: ${candidate.collectedAt}`,
    '',
    '---',
    '',
    candidate.rawText.trim() || '(PDF 텍스트 추출 불가 — 선거공보PDF 링크를 직접 열람하세요)',
  ];

  const filePath = path.join(dir, `${candidate.name}.txt`);
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
}
