const fs = require('fs-extra');
const path = require('path');
const ssri = require('ssri');

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
    const targetPath = path.join(instPath, integrity.target);
    if (!fs.existsSync(targetPath)) {
      match = false;
      break;
    }

    let readStream;
    try {
      readStream = fs.createReadStream(targetPath);
      await ssri.checkStream(readStream, integrity.targetIntegrity);
    } catch {
      match = false;
      break;
    } finally {
      if (readStream) readStream.destroy();
    }
  }

  return match;
}

module.exports = { checkIntegrity };
