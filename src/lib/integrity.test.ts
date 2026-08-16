import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { fromData } from 'ssri';
import { afterEach, describe, expect, it } from 'vitest';
import { checkIntegrity, verifyFile } from './integrity';

const tempDirs: string[] = [];

/**
 * Create a temporary file and compute its integrity hash.
 * @param {string} name - File name.
 * @param {string} content - File content.
 * @returns {Promise<object>} The temp dir, the file path and its hash.
 */
async function makeFile(name: string, content: string) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'apm-integrity-'));
  tempDirs.push(dir);
  const filePath = path.join(dir, name);
  await fs.writeFile(filePath, content);
  return { dir, filePath, hash: fromData(content).toString() };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.remove(dir)));
});

describe('verifyFile', () => {
  it('returns true when the hash matches', async () => {
    const { filePath, hash } = await makeFile('a.txt', 'hello');
    expect(await verifyFile(filePath, hash)).toBe(true);
  });

  it('returns false when the hash does not match', async () => {
    const { filePath } = await makeFile('a.txt', 'hello');
    const otherHash = fromData('tampered').toString();
    expect(await verifyFile(filePath, otherHash)).toBe(false);
  });

  it('returns false when the file does not exist', async () => {
    const { dir, hash } = await makeFile('a.txt', 'hello');
    expect(await verifyFile(path.join(dir, 'missing.txt'), hash)).toBe(false);
  });

  it('returns false for an invalid integrity string', async () => {
    const { filePath } = await makeFile('a.txt', 'hello');
    expect(await verifyFile(filePath, 'not-an-integrity-string')).toBe(false);
  });
});

describe('checkIntegrity', () => {
  it('returns false for an empty integrity list', async () => {
    const { dir } = await makeFile('a.txt', 'hello');
    expect(await checkIntegrity(dir, [])).toBe(false);
  });

  it('returns true when all files match', async () => {
    const { dir, hash } = await makeFile('a.txt', 'hello');
    expect(await checkIntegrity(dir, [{ target: 'a.txt', hash }])).toBe(true);
  });

  it('returns false when any file does not match', async () => {
    const { dir, hash } = await makeFile('a.txt', 'hello');
    const otherHash = fromData('tampered').toString();
    expect(
      await checkIntegrity(dir, [
        { target: 'a.txt', hash },
        { target: 'a.txt', hash: otherHash },
      ]),
    ).toBe(false);
  });
});
