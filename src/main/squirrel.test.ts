import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleSquirrelEvent } from './squirrel';

const mocks = vi.hoisted(() => ({
  quit: vi.fn(),
  spawn: vi.fn<(exe: string, args: string[]) => { on: () => void }>(() => ({
    on: vi.fn(),
  })),
  removeAviUtlShortcut: vi.fn(),
}));

vi.mock('electron', () => ({ app: { quit: mocks.quit } }));
vi.mock('node:child_process', () => ({ spawn: mocks.spawn }));
vi.mock('./shortcut', () => ({
  removeAviUtlShortcut: mocks.removeAviUtlShortcut,
}));

const APP_DATA = 'C:\\Users\\x\\AppData\\Roaming';

describe('handleSquirrelEvent', () => {
  const platform = process.platform;
  const argv = process.argv;

  const setUp = (command: string, plat: string = 'win32') => {
    Object.defineProperty(process, 'platform', { value: plat });
    process.argv = ['apm.exe', command];
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: platform });
    process.argv = argv;
  });

  it('win32 以外では何もしない', () => {
    setUp('--squirrel-uninstall', 'darwin');
    expect(handleSquirrelEvent(APP_DATA)).toBe(false);
    expect(mocks.spawn).not.toHaveBeenCalled();
    expect(mocks.removeAviUtlShortcut).not.toHaveBeenCalled();
  });

  it('Squirrel のイベントでなければ何もしない', () => {
    setUp('--some-other-flag');
    expect(handleSquirrelEvent(APP_DATA)).toBe(false);
    expect(mocks.spawn).not.toHaveBeenCalled();
  });

  it('インストール・更新ではショートカットを作る', () => {
    for (const command of ['--squirrel-install', '--squirrel-updated']) {
      vi.clearAllMocks();
      setUp(command);
      expect(handleSquirrelEvent(APP_DATA)).toBe(true);
      expect(mocks.spawn.mock.calls[0][1]).toEqual([
        expect.stringContaining('--createShortcut='),
      ]);
      // 作る側では AviUtl のショートカットに触らない
      expect(mocks.removeAviUtlShortcut).not.toHaveBeenCalled();
    }
  });

  it('アンインストールでは AviUtl のショートカットを Update.exe より先に消す', () => {
    setUp('--squirrel-uninstall');

    expect(handleSquirrelEvent(APP_DATA)).toBe(true);

    // 順序がこのテストの主眼。Update.exe は detached で spawn され、その完了で
    // app.quit() が走るため、後回しにすると削除が間に合わない
    expect(mocks.removeAviUtlShortcut).toHaveBeenCalledWith(APP_DATA);
    expect(mocks.removeAviUtlShortcut.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.spawn.mock.invocationCallOrder[0],
    );
    expect(mocks.spawn.mock.calls[0][1]).toEqual([
      expect.stringContaining('--removeShortcut='),
    ]);
  });

  it('obsolete では Update.exe を呼ばずに終了する', () => {
    setUp('--squirrel-obsolete');
    expect(handleSquirrelEvent(APP_DATA)).toBe(true);
    expect(mocks.quit).toHaveBeenCalled();
    expect(mocks.spawn).not.toHaveBeenCalled();
  });
});
