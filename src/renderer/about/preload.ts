import { contextBridge } from 'electron';
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
