import { execSync } from 'child_process';
import { app } from 'electron';
import fs from 'fs-extra';
import path from 'node:path';

/**
 * Opens the specified folder.
 * @param {string} relativePath - The relative path to the folder.
 * @returns {boolean} Whether the folder exists.
 */
function openPath(relativePath: string) {
  const folderPath = path.join(app.getPath('userData'), 'Data/', relativePath);
  const folderExists = fs.existsSync(folderPath);
  if (folderExists) execSync(`start "" "${folderPath}"`);
  return folderExists;
}

export default openPath;
