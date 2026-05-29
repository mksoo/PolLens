// scripts/types.ts

export type ElectionType = '도지사' | '시장' | '도의원' | '시의원' | '교육감';

export interface ScraperConfig {
  electionType: ElectionType;
  /** data/<electionType>/<region>/ 경로에 사용 */
  region: string;
  /** 선관위 사이트에서 필터링할 선거구명 */
  district: string;
}

export interface CandidateRef {
  name: string;
  ballotNumber: number;
  party: string;
  /** P5_PRMS_PUB 텍스트 PDF URL. 없으면 undefined — 이미지 PDF만 존재 */
  pdfUrl?: string;
  /** 선거공보 이미지 PDF URL (유저 직접 열람용) */
  pbinfoUrl?: string;
}

export interface CandidateMeta {
  name: string;
  ballotNumber: number;
  party: string;
  electionType: ElectionType;
  region: string;
  district: string;
  /** 프로젝트 루트 기준 상대 경로 (P5_PRMS_PUB 텍스트 PDF) */
  pdfPath?: string;
  /** 프로젝트 루트 기준 상대 경로 (PBINFO 선거공보 이미지 PDF) */
  pbinfoPdfPath?: string;
  /** 원본 CDN URL (직접 열람용) */
  pdfUrl?: string;
  pbinfoUrl?: string;
  collectedAt: string;
}

export interface CacheMeta {
  collectedAt: string;
  elections: ElectionType[];
  candidates: CandidateMeta[];
}
