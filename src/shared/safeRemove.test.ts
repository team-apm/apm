import { mkdtemp, pathExists, remove, writeFile } from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { safeRemove } from './safeRemove';

describe('safeRemove', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => remove(dir)));
  });

  it('removes a file inside the parent folder', async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), 'apm-safe-remove-'));
    tempDirs.push(parent);
    const file = path.join(parent, 'target.txt');
    await writeFile(file, 'delete me');

    await safeRemove(file, parent);

    expect(await pathExists(file)).toBe(false);
  });

  it('throws when the target is outside the parent folder', async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), 'apm-safe-remove-'));
    const outside = await mkdtemp(
      path.join(os.tmpdir(), 'apm-safe-remove-out-'),
    );
    tempDirs.push(parent, outside);
    const file = path.join(outside, 'target.txt');
    await writeFile(file, 'keep me');

    await expect(safeRemove(file, parent)).rejects.toThrow(
      'An invalid delete operation was attempted.',
    );
    expect(await pathExists(file)).toBe(true);
  });
});
