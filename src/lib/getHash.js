const crypto = require('crypto');
const fs = require('fs');

/**
 *  Returns the hash value of the text.
 *
 * @param {string} text - Text to hash
 * @param {number} limit - The length of the string to return.
 * @returns {string} Hashed text
 */
function getHash(text, limit = 7) {
  const shasum = crypto.createHash('sha1');
  shasum.update(text);
  return shasum.digest('hex').substr(0, limit);
}

/**
 *  Returns the hash value of the file.
 *
 * @param {string} path - Text to hash
 * @returns {string} Hash of the file
 */
function getHashOfFile(path) {
  const buffer = fs.readFileSync(path);
  const shasum = crypto.createHash('sha256');
  shasum.update(buffer);
  return shasum.digest('hex');
}

module.exports = { getHash, getHashOfFile };
