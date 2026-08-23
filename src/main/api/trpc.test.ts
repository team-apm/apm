import type { IpcMainInvokeEvent } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Config from '../Config';
import { procedure, t } from './trpc';

const mocks = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock('electron', () => ({
  BrowserWindow: { fromWebContents: () => null },
}));
vi.mock('electron-log/main', () => ({
  default: { error: mocks.error, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('../Config', () => ({ getConfig: () => ({}) }));
vi.mock('../installation', () => ({ openInstallation: vi.fn() }));

const router = t.router({
  boom: procedure.query(() => {
    throw new Error('procedure が投げた例外');
  }),
  fine: procedure.query(() => 'ok'),
});
const createCaller = t.createCallerFactory(router);
const caller = createCaller({
  event: {} as IpcMainInvokeEvent,
  config: {} as Config,
});

describe('tRPC 境界のログ', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('procedure が投げた例外を、呼び出し元へ返す前にログへ残す', async () => {
    await expect(caller.boom()).rejects.toThrow('procedure が投げた例外');

    expect(mocks.error).toHaveBeenCalledTimes(1);
    const [message, error] = mocks.error.mock.calls[0] as [string, Error];
    // どの procedure の失敗かがログだけで分かる
    expect(message).toContain('boom');
    expect(message).toContain('query');
    expect(error.message).toContain('procedure が投げた例外');
  });

  it('成功した procedure では何もログしない', async () => {
    await expect(caller.fine()).resolves.toBe('ok');

    expect(mocks.error).not.toHaveBeenCalled();
  });
});
