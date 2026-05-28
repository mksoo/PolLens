// scripts/cache.ts
import * as fs from 'fs';
import * as path from 'path';
import type { CacheMeta, ElectionType } from './types';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24시간

export function getMetaPath(dataDir: string): string {
  return path.join(dataDir, 'meta.json');
}

export function isCacheValid(dataDir: string): boolean {
  const metaPath = getMetaPath(dataDir);
  if (!fs.existsSync(metaPath)) return false;

  const meta: CacheMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  const collectedAt = new Date(meta.collectedAt).getTime();
  return Date.now() - collectedAt < CACHE_TTL_MS;
}

export function updateMeta(dataDir: string, elections: ElectionType[]): void {
  fs.mkdirSync(dataDir, { recursive: true });
  const meta: CacheMeta = {
    collectedAt: new Date().toISOString(),
    elections,
  };
  fs.writeFileSync(getMetaPath(dataDir), JSON.stringify(meta, null, 2), 'utf-8');
}

export function readMeta(dataDir: string): CacheMeta | null {
  const metaPath = getMetaPath(dataDir);
  if (!fs.existsSync(metaPath)) return null;
  return JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as CacheMeta;
}
