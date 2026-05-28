// scripts/parser.ts
import type { Candidate, Pledge, ElectionType } from './types';

export function extractSection(text: string, sectionName: string): string[] {
  const sectionPattern = new RegExp(`□\\s*${sectionName}(.+?)(?=□|공약순위:|$)`, 's');
  const match = text.match(sectionPattern);
  if (!match) return [];

  const itemPattern = /○\s*(.+?)(?=○|$)/gs;
  const items: string[] = [];
  let itemMatch: RegExpExecArray | null;

  while ((itemMatch = itemPattern.exec(match[1])) !== null) {
    const item = itemMatch[1].trim();
    if (item) items.push(item);
  }
  return items;
}

export function parsePledges(text: string): Pledge[] {
  // 공약순위: N 제목 : [제목] 패턴으로 분리
  const pledgePattern = /공약순위:\s*(\d+)\s*제목\s*:\s*(.+?)(?=공약순위:|$)/gs;
  const pledges: Pledge[] = [];
  let match: RegExpExecArray | null;

  while ((match = pledgePattern.exec(text)) !== null) {
    const rank = parseInt(match[1], 10);
    const block = match[0];
    // 제목은 □ 앞까지
    const titleRaw = match[2];
    const title = titleRaw.split('□')[0].trim();

    pledges.push({
      rank,
      title,
      goal: extractSection(block, '목\\s*표'),
      method: extractSection(block, '이행방법'),
      period: extractSection(block, '이행기간'),
      budget: extractSection(block, '재원조달방안'),
    });
  }

  return pledges;
}

export function parseRawText(
  rawText: string,
  electionType: ElectionType,
  region: string
): Candidate {
  const nameMatch = rawText.match(/후보자명\s+(\S+)/);
  const ballotMatch = rawText.match(/기호\s+(\d+)/);
  const partyMatch = rawText.match(/소속정당명\s+(.+?)(?=공약순위|$)/s);
  const districtMatch = rawText.match(/선거구명\s+(.+?)(?=\s*후보자명|\s*기호|\s*소속정당명|$)/);

  if (!nameMatch || !ballotMatch || !partyMatch) {
    throw new Error(
      `후보자 헤더 파싱 실패. 텍스트 앞 100자: "${rawText.slice(0, 100)}"`
    );
  }

  return {
    name: nameMatch[1].trim(),
    ballotNumber: parseInt(ballotMatch[1], 10),
    party: partyMatch[1].trim(),
    electionType,
    region,
    district: districtMatch?.[1].trim() ?? region,
    pledges: parsePledges(rawText),
    collectedAt: new Date().toISOString(),
  };
}
