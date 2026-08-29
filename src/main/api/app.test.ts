import type { IpcMainInvokeEvent } from 'electron';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type Config from '../Config';
import { appProcedures } from './app';
import { t } from './trpc';

const mocks = vi.hoisted(() => ({
  showItemInFolder: vi.fn(),
  openPath: vi.fn(),
  logFilePath: { value: '' },
}));

vi.mock('electron', () => ({
  app: { getVersion: () => '0.0.0', getName: () => 'apm', quit: vi.fn() },
  BrowserWindow: { getFocusedWindow: () => null },
  clipboard: { writeText: vi.fn() },
  dialog: { showMessageBox: vi.fn(), showOpenDialog: vi.fn() },
  shell: {
    showItemInFolder: mocks.showItemInFolder,
    openPath: mocks.openPath,
  },
}));
vi.mock('electron-log/main', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    transports: {
      file: { getFile: () => ({ path: mocks.logFilePath.value }) },
    },
  },
}));
vi.mock('../aboutWindow', () => ({ openAboutWindow: vi.fn() }));
vi.mock('../Config', () => ({ getConfig: () => ({}) }));
vi.mock('../installation', () => ({ openInstallation: vi.fn() }));
vi.mock('../services/appUpdate', () => ({
  checkUpdate: vi.fn(),
  isExeVersion: () => false,
}));

const caller = t.createCallerFactory(t.router(appProcedures))({
  event: {} as IpcMainInvokeEvent,
  config: {} as Config,
});

describe('openLogFolder', () => {
  let dir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    dir = mkdtempSync(path.join(tmpdir(), 'apm-log-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('ログファイルを選択した状態でフォルダを開く', async () => {
    const logPath = path.join(dir, 'main.log');
    writeFileSync(logPath, 'log');
    mocks.logFilePath.value = logPath;

    await caller.openLogFolder();

    expect(mocks.showItemInFolder).toHaveBeenCalledWith(logPath);
    expect(mocks.openPath).not.toHaveBeenCalled();
  });

  it('ログファイルがまだ無いときはフォルダだけを開く', async () => {
    mocks.logFilePath.value = path.join(dir, 'not-written-yet.log');

    await caller.openLogFolder();

    expect(mocks.openPath).toHaveBeenCalledWith(dir);
    expect(mocks.showItemInFolder).not.toHaveBeenCalled();
  });
});
