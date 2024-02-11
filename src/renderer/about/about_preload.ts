// import log from 'electron-log';
// import 'source-map-support/register';
import { contextBridge } from 'electron';
import { app } from '../../lib/ipcWrapper';

/* log.catchErrors({
  onError: async () => {
    await openDialog(
      'エラー',
      `予期しないエラーが発生しました。\nログファイル: ${
        log.transports.file.getFile().path
      }`,
      'error',
    );
  },
}); */

contextBridge.exposeInMainWorld(
  'appVersion',
  async () => await app.getVersion(),
);
contextBridge.exposeInMainWorld('versions', process.versions);
