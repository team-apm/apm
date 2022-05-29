import fs from 'fs-extra';
import path from 'path';
import { checkStream } from 'ssri';

/**
 * Check for integrity.
 *
 * @param {string} instPath - An installation path.
 * @param {object[]} integrities - List of integrity objects.
 * @returns {Promise<boolean>} Integrities match or don't match.
 */
async function checkIntegrity(instPath, integrities) {
  if (integrities.length === 0) return false;

  let match = true;
  for (const integrity of integrities) {
    match =
      match &&
      (await verifyFile(path.join(instPath, integrity.target), integrity.hash));
  }

  return match;
}

/**
 * Check the integrity of the file.
 *
 * @param {string} filePath - An file path.
 * @param {string} integrity - Integrity of the file.
 * @returns {Promise<boolean>} Integrities match or don't match.
 */
async function verifyFile(filePath, integrity) {
  if (!fs.existsSync(filePath)) return false;

  let readStream;
  try {
    readStream = fs.createReadStream(filePath);
    await checkStream(readStream, integrity);
  } catch {
    return false;
  } finally {
    if (readStream) readStream.destroy();
  }

  return true;
}

const integrity = { checkIntegrity, verifyFile };
export default integrity;
