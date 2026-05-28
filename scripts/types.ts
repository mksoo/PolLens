// scripts/types.ts

export type ElectionType = '도지사' | '시장' | '도의원' | '시의원' | '교육감';

export interface Pledge {
  rank: number;
  title: string;
  goal: string[];
  method: string[];
  period: string[];
  budget: string[];
}

export interface Candidate {
  name: string;
  ballotNumber: number;
  party: string;
  electionType: ElectionType;
  /** 지역 파일명 디렉토리 (예: 경기도, 화성시) */
  region: string;
  /** 실제 선거구명 (예: 동탄제1선거구, 동탄5동) */
  district: string;
  pledges: Pledge[];
  collectedAt: string; // ISO8601
}

export interface ScraperConfig {
  electionType: ElectionType;
  /** data/<electionType>/<region>/ 경로에 사용 */
  region: string;
  /** 선관위 사이트에서 필터링할 선거구명 */
  district: string;
}

export interface CandidateRef {
  documentKey: string;
  name: string;
  ballotNumber: number;
  party: string;
}

export interface CacheMeta {
  collectedAt: string; // ISO8601
  elections: ElectionType[];
}
