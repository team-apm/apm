import { contextBridge } from 'electron';
// __electronLog を両ワールドに生やす(electron-log/renderer の ipc transport が
// 依存)。main 側のセッション preload 注入は dev でパス解決が壊れるため使わない
import 'electron-log/preload';
import log from 'electron-log/renderer';
import { exposeElectronTRPC } from 'electron-trpc/main';
import 'source-map-support/register';
import { openDialog } from '../../lib/ipcWrapper';

log.errorHandler.startCatching({
  onError: async () => {
    await openDialog('エラー', '予期しないエラーが発生しました。', 'error');
  },
});

window.addEventListener('click', () => {
  window.close();
});

process.once('loaded', async () => {
  exposeElectronTRPC();
});

contextBridge.exposeInMainWorld('process', {
  versions: process.versions,
});
