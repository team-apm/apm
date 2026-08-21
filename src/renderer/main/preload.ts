// __electronLog を両ワールドに生やす(electron-log/renderer の ipc transport が
// 依存)。main 側のセッション preload 注入は dev でパス解決が壊れるため使わない
import 'electron-log/preload';
import log from 'electron-log/renderer';
import { exposeElectronTRPC } from 'trpc-electron/main';
import { openDialog } from '../../lib/ipcWrapper';

// 初期化フロー(migration → initSettings → ensureInstallationPath →
// changeInstallationPath)はメインワールドの React 側
// (src/renderer/main/startup.ts)へ移設済み。preload はログの捕捉と
// tRPC bridge の公開のみを行う
log.errorHandler.startCatching({
  onError: async () => {
    await openDialog('エラー', '予期しないエラーが発生しました。', 'error');
  },
});

// メインワールドの React から tRPC を使うための bridge
process.once('loaded', () => {
  exposeElectronTRPC();
});
