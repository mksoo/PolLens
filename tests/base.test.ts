import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { downloadPdf } from '../scripts/scrapers/base';

describe('downloadPdf', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pollens-base-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
    vi.restoreAllMocks();
  });

  it('PDF를 지정 경로에 저장한다', async () => {
    const testContent = '%PDF-1.4 fake content';
    const testBuffer = new Uint8Array(Buffer.from(testContent));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => testBuffer.buffer,
    }));

    const destPath = path.join(tmpDir, 'sub', '추미애.pdf');
    await downloadPdf('https://cdn.nec.go.kr/test.pdf', destPath);

    expect(fs.existsSync(destPath)).toBe(true);
    const saved = fs.readFileSync(destPath);
    expect(saved.length).toBeGreaterThan(0);
    expect(saved.toString('utf-8')).toContain('PDF-1.4');
  });

  it('중간 디렉토리가 없어도 생성한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from('x').buffer,
    }));

    const destPath = path.join(tmpDir, 'a', 'b', 'c', 'test.pdf');
    await downloadPdf('https://cdn.nec.go.kr/test.pdf', destPath);
    expect(fs.existsSync(destPath)).toBe(true);
  });

  it('HTTP 오류 시 에러를 던진다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }));

    await expect(
      downloadPdf('https://cdn.nec.go.kr/notfound.pdf', path.join(tmpDir, 'test.pdf'))
    ).rejects.toThrow('PDF 다운로드 실패: 404');
  });
});
