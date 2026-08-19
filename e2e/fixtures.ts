import { path7za } from '7zip-bin';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';

export const MODIFIED = '2026-01-01T00:00:00+09:00';

/**
 * Creates a zip archive from the given files using the bundled 7za
 * (アプリ側の展開が 7z なので生成にも同梱の 7za を使う).
 * @param {string} zipPath - The destination zip path.
 * @param {string} srcDir - A working directory for the archive contents.
 * @param {Record<string, string>} files - File names and contents to archive.
 */
export function createZip(
  zipPath: string,
  srcDir: string,
  files: Record<string, string>,
) {
  mkdirSync(srcDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(path.join(srcDir, name), content);
  }
  mkdirSync(path.dirname(zipPath), { recursive: true });
  execFileSync(path7za, ['a', zipPath, path.join(srcDir, '*')]);
}

/**
 * Returns the ssri (sha384) of a file, for the release integrity of
 * core.json.
 * @param {string} filePath - The file to hash.
 * @returns {string} The ssri string.
 */
export function ssriOf(filePath: string): string {
  return (
    'sha384-' +
    createHash('sha384').update(readFileSync(filePath)).digest('base64')
  );
}

export type DataSetOptions = {
  /** The contents of packages.json's packages field. */
  packages?: object[];
  /** The releases field of core.json's aviutl program. */
  aviutlReleases?: object[];
};

/**
 * Writes an apm data set (list/core/convert/packages) into the given
 * directory.
 * @param {string} dir - The destination directory.
 * @param {DataSetOptions} options - The variable parts of the data set.
 */
export function writeDataSet(dir: string, options: DataSetOptions = {}) {
  mkdirSync(dir, { recursive: true });
  const write = (name: string, data: unknown) =>
    writeFileSync(path.join(dir, name), JSON.stringify(data));
  write('list.json', {
    core: { path: 'core.json', modified: MODIFIED },
    convert: { path: 'convert.json', modified: MODIFIED },
    packages: [{ path: 'packages.json', modified: MODIFIED }],
    scripts: [],
  });
  write('core.json', {
    version: 3,
    aviutl: {
      latestVersion: '1.10',
      files: [{ filename: 'aviutl.exe' }],
      releases: options.aviutlReleases ?? [],
    },
    exedit: {
      latestVersion: '0.92',
      files: [{ filename: 'exedit.auf' }],
      releases: [],
    },
  });
  write('convert.json', {});
  write('packages.json', { version: 3, packages: options.packages ?? [] });
}

/**
 * Serves the fixtures directory over HTTP on a free port of 127.0.0.1.
 * @param {string} fixturesDir - The directory to serve.
 * @returns {Promise<{baseUrl: string, close: () => void}>} The base URL and a
 * function closing the server.
 */
export async function serveFixtures(
  fixturesDir: string,
): Promise<{ baseUrl: string; close: () => void }> {
  const server = createServer((req, res) => {
    const filePath = path.join(
      fixturesDir,
      (req.url ?? '/').replace(/^\//, ''),
    );
    if (!filePath.startsWith(fixturesDir) || !existsSync(filePath)) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, {
      'content-type': filePath.endsWith('.zip')
        ? 'application/zip'
        : 'application/json',
    });
    res.end(readFileSync(filePath));
  });
  await new Promise<void>((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve()),
  );
  return {
    baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () => server.close(),
  };
}
