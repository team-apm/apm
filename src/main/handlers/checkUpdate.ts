import { app, dialog, net, shell } from 'electron';
import log from 'electron-log';
import { readJsonSync } from 'fs-extra';
import path from 'node:path';

/**
 * Checks whether a newer version is available.
 * @param {boolean} [silent] - Whether the dialog is not shown if apm is up to date.
 */
async function checkUpdate(silent = true) {
  const server = 'https://update.electronjs.org';

  const pkg = readJsonSync(path.join(app.getAppPath(), 'package.json'));
  const repoString = (pkg.repository && pkg.repository.url) || pkg.repository;
  const repoURL = new URL(repoString);
  const dirs = repoURL.pathname.split('/');
  dirs.shift();
  // const repo = `${dirs[0]}/${dirs[1].split('.')[0]}`;
  const repo = 'team-apm/apm';

  const feed = `${server}/${repo}/${process.platform}-${
    process.arch
  }/${app.getVersion()}`;

  if (repoURL.hostname === 'github.com') {
    await app.whenReady().then(() => {
      const request = net.request(feed);
      request.on('response', async (response) => {
        const icon = path.join(__dirname, '../icon/apm1024.png');
        if (response.statusCode === 204) {
          log.debug('It is up to date.');
          if (!silent)
            await dialog.showMessageBox({
              title: '更新確認完了',
              message: 'apmは最新のバージョンです。',
              type: 'info',
              icon: icon,
            });
        } else if (response.statusCode === 404) {
          log.debug('No updates are found');
          if (!silent)
            await dialog.showMessageBox({
              title: '更新確認失敗',
              message: 'apmの更新が見つかりませんでした。',
              type: 'warning',
              icon: icon,
            });
        } else {
          let body = '';
          response.on('data', (chunk) => {
            body += chunk;
          });
          response.on('end', async () => {
            try {
              const data = JSON.parse(body);
              if ('name' in data) {
                const res = dialog.showMessageBoxSync({
                  title: 'アップデート',
                  message:
                    `${data.name}が公開されています。\n` +
                    `現在のバージョン: v${app.getVersion()}\n` +
                    'apmを終了して、ダウンロードページを開きますか？',
                  detail: data?.notes
                    ? 'リリースノート:\n' + data?.notes
                    : undefined,
                  buttons: ['開く', 'キャンセル'],
                  cancelId: 1,
                  type: 'info',
                  icon: icon,
                });
                if (res === 0) {
                  const releasePage = `https://github.com/${repo}/releases/latest`;
                  await shell.openExternal(releasePage);
                  app.quit();
                }
              }
            } catch (e) {
              log.error(e);
              if (!silent)
                await dialog.showMessageBox({
                  title: '更新確認失敗',
                  message: 'apmの更新を解析できませんでした。',
                  type: 'error',
                  icon: icon,
                });
            }
          });
        }
      });
      request.end();
    });
  }
}

export default checkUpdate;
