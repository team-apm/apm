import log from 'electron-log';
import { app, openErrDialog } from '../../lib/ipcWrapper';
import replaceText from '../../lib/replaceText';

log.catchErrors({
  onError: () => {
    openErrDialog(
      'エラー',
      `予期しないエラーが発生しました。\nログファイル: ${
        log.transports.file.getFile().path
      }`
    );
  },
});

window.addEventListener('click', () => {
  window.close();
});

window.addEventListener('DOMContentLoaded', async () => {
  const appVersion = await app.getVersion();
  replaceText('app-version', appVersion);
  for (const dependency of ['chrome', 'node', 'electron']) {
    replaceText(`${dependency}-version`, process.versions[dependency]);
  }
});
