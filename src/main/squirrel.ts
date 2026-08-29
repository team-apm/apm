import { app } from 'electron';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { removeAviUtlShortcut } from './shortcut';

/**
 * Runs Squirrel's `Update.exe` with the given arguments.
 * @param {string[]} args - Arguments passed to Update.exe.
 */
function runUpdateExe(args: string[]) {
  const updateExe = path.resolve(
    path.dirname(process.execPath),
    '..',
    'Update.exe',
  );
  spawn(updateExe, args, { detached: true }).on('close', () => app.quit());
}

/**
 * Handles the Squirrel.Windows startup events.
 *
 * 旧 electron-squirrel-startup を取り込んだもの。あちらは
 * `module.exports = check()` で **require したその瞬間に** イベントを
 * 処理するため、AviUtl のショートカット削除を先に済ませる必要が
 * 「index.ts の行の位置」でしか担保できなかった(#2417)。ここへ畳むと
 * 順序が文として書かれ、テストも書ける。
 * @param {string} appDataPath - The path to AppData.
 * @returns {boolean} Whether a Squirrel event was handled (the app should quit).
 */
export function handleSquirrelEvent(appDataPath: string): boolean {
  if (process.platform !== 'win32') return false;

  const target = path.basename(process.execPath);
  switch (process.argv[1]) {
    case '--squirrel-install':
    case '--squirrel-updated':
      runUpdateExe([`--createShortcut=${target}`]);
      return true;
    case '--squirrel-uninstall':
      // apm 自身が消える前に AviUtl のショートカットを消す。Update.exe は
      // detached で spawn され、その完了で app.quit() が走るため、こちらを
      // 後回しにすると間に合わない
      removeAviUtlShortcut(appDataPath);
      runUpdateExe([`--removeShortcut=${target}`]);
      return true;
    case '--squirrel-obsolete':
      app.quit();
      return true;
    default:
      return false;
  }
}
