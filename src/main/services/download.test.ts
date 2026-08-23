import type { BrowserWindow } from 'electron';
import {
  ensureDir,
  mkdtemp,
  pathExists,
  readFile,
  remove,
  writeFile,
} from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getHash } from '../../shared/getHash';
import { downloadFile } from './download';
import { existsTempFile } from './tempFile';

// データフォルダ外への書き込みを拒む関門の検証。install 側の同型の関門
// (resolveInside / safeRemove)はテストされているのに、ダウンロード側は
// 覆われていなかった。実際のダウンロードは行わず、ローカルパスを渡して
// コピー経路(url が http で始まらない側)だけを通す
const mocks = vi.hoisted(() => ({ userDataDir: { value: '' } }));

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name !== 'userData') throw new Error(`Unexpected getPath: ${name}`);
      return mocks.userDataDir.value;
    },
  },
  BrowserWindow: class {},
}));
vi.mock('electron-dl', () => ({
  download: vi.fn(() => {
    throw new Error('ネットワーク経路はこのテストでは通らないはず');
  }),
  CancelError: class extends Error {},
}));
vi.mock('electron-log/main', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const win = {} as BrowserWindow;

describe('downloadFile の関門', () => {
  const tempDirs: string[] = [];
  let srcFile: string;

  const makeTempDir = async (prefix: string) => {
    const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    // userData を root の内側に作る。脱出先(userData/..)も後片付けの
    // 対象に入れないと、関門が壊れたときに os.tmpdir() 直下へ実ファイルが
    // 残り、次回以降のテストがそれを拾って誤って落ちる
    const root = await makeTempDir('apm-dl-');
    mocks.userDataDir.value = path.join(root, 'userData');
    await ensureDir(mocks.userDataDir.value);
    const srcDir = path.join(root, 'src');
    await ensureDir(srcDir);
    srcFile = path.join(srcDir, 'plugin.auf');
    await writeFile(srcFile, 'contents');
  });

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => remove(dir)));
  });

  it('データフォルダの中へ保存する', async () => {
    const result = await downloadFile(win, srcFile, { subDir: 'package' });

    expect(result).toBe(
      path.join(mocks.userDataDir.value, 'Data', 'package', 'plugin.auf'),
    );
    expect(await readFile(result as string, 'utf8')).toBe('contents');
  });

  it('subDir でデータフォルダの外へ出る指定を拒む', async () => {
    const outside = path.join(mocks.userDataDir.value, '..', 'escaped');

    const result = await downloadFile(win, srcFile, {
      subDir: path.join('..', '..', 'escaped'),
    });

    expect(result).toBeUndefined();
    expect(await pathExists(path.join(outside, 'plugin.auf'))).toBe(false);
  });

  it('ファイル名にエンコードされたパス区切りがあれば拒む', async () => {
    // 将来どこかで decode されるとパス区切りに化ける値
    for (const name of ['a%2fb.auf', 'a%5cb.auf', 'a%2Fb.auf']) {
      const src = path.join(path.dirname(srcFile), name);
      await writeFile(src, 'x');
      expect(
        await downloadFile(win, src, { subDir: 'package' }),
      ).toBeUndefined();
    }
  });

  it('アーカイブ拡張子は archive サブディレクトリへ分ける', async () => {
    const zip = path.join(path.dirname(srcFile), 'a.zip');
    await writeFile(zip, 'x');

    expect(await downloadFile(win, zip, { subDir: 'package' })).toBe(
      path.join(mocks.userDataDir.value, 'Data', 'package', 'archive', 'a.zip'),
    );
  });

  it('keyText を渡すとハッシュを前置した名前になる', async () => {
    const result = await downloadFile(win, srcFile, {
      subDir: 'package',
      keyText: 'https://example.com/list.json',
    });

    expect(path.basename(result as string)).toBe(
      `${getHash('https://example.com/list.json')}_plugin.auf`,
    );
  });

  it('loadCache は既存ファイルがあればコピーせずそのパスを返す', async () => {
    const first = (await downloadFile(win, srcFile, {
      subDir: 'package',
    })) as string;
    await writeFile(first, 'cached');

    const second = await downloadFile(win, srcFile, {
      subDir: 'package',
      loadCache: true,
    });

    expect(second).toBe(first);
    // 中身を見ずに返す(整合性の検証は呼び出し側の責務)
    expect(await readFile(first, 'utf8')).toBe('cached');
  });
});

describe('existsTempFile の関門', () => {
  const tempDirs: string[] = [];

  beforeEach(async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'apm-tmpf-'));
    tempDirs.push(root);
    mocks.userDataDir.value = path.join(root, 'userData');
    await ensureDir(mocks.userDataDir.value);
  });

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => remove(dir)));
  });

  it('データフォルダの中のパスを解決する', () => {
    expect(existsTempFile(path.join('package', 'list.json')).path).toBe(
      path.join(mocks.userDataDir.value, 'Data', 'package', 'list.json'),
    );
  });

  it('データフォルダの外へ出るパスを拒む', () => {
    expect(() => existsTempFile(path.join('..', '..', 'passwd'))).toThrow(
      /invalid path/i,
    );
  });
});
