import '../../../node_modules/bootstrap/dist/css/bootstrap.min.css';
import '../main.css';
import './about.css';
import replaceText from '../../lib/replaceText';

declare const appVersion: () => Promise<string>;
declare const versions: { [key: string]: string };

window.addEventListener('click', () => {
  window.close();
});

window.addEventListener('DOMContentLoaded', async () => {
  replaceText('app-version', await appVersion());
  for (const dependency of ['chrome', 'node', 'electron']) {
    replaceText(`${dependency}-version`, versions[dependency]);
  }
});
