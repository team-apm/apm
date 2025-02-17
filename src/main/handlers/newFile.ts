import fs from 'fs-extra';
import { execSync } from 'child_process';
import { ipcMain, app } from 'electron';
import path from 'path';
import { IPC_CHANNELS } from '../../common/ipc';

ipcMain.handle(IPC_CHANNELS.OPEN_PATH, (event, relativePath) => {
  const folderPath = path.join(app.getPath('userData'), 'Data/', relativePath);
  const folderExists = fs.existsSync(folderPath);
  if (folderExists) execSync(`start "" "${folderPath}"`);
  return folderExists;
});
