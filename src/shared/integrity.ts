import fs from 'fs-extra';
import path from 'node:path';
import { checkStream } from 'ssri';

/**
 * Check for integrity.
 * @param {string} instPath - An installation path.
 * @param {object[]} integrities - List of integrity objects.
 * @returns {Promise<boolean>} Integrities match or don't match.
 */
export async function checkIntegrity(
  instPath: string,
  integrities: { target: string; hash: string }[],
) {
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
 * @param {string} filePath - An file path.
 * @param {string} integrity - Integrity of the file.
 * @returns {Promise<boolean>} Integrities match or don't match.
 */
export async function verifyFile(filePath: string, integrity: string) {
  if (!fs.existsSync(filePath)) return false;

  let readStream;
  try {
    readStream = fs.createReadStream(filePath);
    // checkStream(内部は pipe)は source の error イベントを引き取らない。
    // 早期 reject 後に遅れて届く open/read エラー(競合で消えた一時ファイル等)が
    // リスナー無しの error イベント = プロセスの uncaught exception になるため、
    // 先に握りつぶすリスナーを付けておく。失敗は戻り値 false で表現される
    readStream.on('error', () => {});
    await checkStream(readStream, integrity);
  } catch {
    return false;
  } finally {
    if (readStream) readStream.destroy();
  }

  return true;
}
