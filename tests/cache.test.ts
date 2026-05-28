// tests/cache.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { isCacheValid, updateMeta, readMeta } from '../scripts/cache';

describe('isCacheValid', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pollens-cache-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('meta.json이 없으면 false를 반환한다', () => {
    expect(isCacheValid(tmpDir)).toBe(false);
  });

  it('collectedAt이 24시간 이내면 true를 반환한다', () => {
    const meta = {
      collectedAt: new Date().toISOString(),
      elections: ['도지사'],
    };
    fs.writeFileSync(path.join(tmpDir, 'meta.json'), JSON.stringify(meta));
    expect(isCacheValid(tmpDir)).toBe(true);
  });

  it('collectedAt이 25시간 전이면 false를 반환한다', () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const meta = { collectedAt: old.toISOString(), elections: ['도지사'] };
    fs.writeFileSync(path.join(tmpDir, 'meta.json'), JSON.stringify(meta));
    expect(isCacheValid(tmpDir)).toBe(false);
  });
});

describe('updateMeta', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pollens-meta-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('meta.json을 생성한다', () => {
    updateMeta(tmpDir, ['도지사', '시장']);
    expect(fs.existsSync(path.join(tmpDir, 'meta.json'))).toBe(true);
  });

  it('저장된 elections 목록이 일치한다', () => {
    updateMeta(tmpDir, ['도지사', '시장']);
    const meta = readMeta(tmpDir);
    expect(meta?.elections).toEqual(['도지사', '시장']);
  });

  it('collectedAt이 현재 시각 근처이다', () => {
    const before = Date.now();
    updateMeta(tmpDir, ['시장']);
    const after = Date.now();
    const meta = readMeta(tmpDir);
    const collectedAt = new Date(meta!.collectedAt).getTime();
    expect(collectedAt).toBeGreaterThanOrEqual(before);
    expect(collectedAt).toBeLessThanOrEqual(after);
  });
});

describe('readMeta', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pollens-read-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('meta.json이 없으면 null을 반환한다', () => {
    expect(readMeta(tmpDir)).toBeNull();
  });
});
