import { app } from 'electron';
import path from 'node:path';

/**
 * Checks whether it is the installed version of apm.
 * @returns {boolean} Whether it is the installed version of apm.
 */
function isExeVersion() {
  if (process.platform === 'win32') {
    const appDataPath = app.getPath('appData');
    const apmPath = app.getPath('exe');
    return apmPath.includes(path.dirname(appDataPath)); // Verify that it is the installed version of apm
  } else {
    return false;
  }
}

export default isExeVersion;
