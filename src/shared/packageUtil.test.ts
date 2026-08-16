import { mkdtemp, remove, writeFile } from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PackageItem } from '../types/packageItem';
import {
  computePackagesStatus,
  detectPackageTypes,
  getInstalledVersionOfPackage,
  getManuallyInstalledFiles,
  parsePackageType,
  states,
} from './packageUtil';

// 旧 src/renderer/main/packageUtil.ts の計算部分の特性化テスト

/**
 * Creates a package item for testing.
 * @param {string} id - The package ID.
 * @param {object} [overrides] - Overrides of the package info and status.
 * @param {object[]} [overrides.files] - Files of the package.
 * @param {string[]} [overrides.dependencies] - Dependencies of the package.
 * @param {string[]} [overrides.conflicts] - Conflicts of the package.
 * @param {string} [overrides.installationStatus] - An installation status.
 * @param {string} [overrides.version] - An installed version.
 * @returns {PackageItem} The created package item.
 */
function makePackage(
  id: string,
  overrides: {
    files?: object[];
    dependencies?: string[];
    conflicts?: string[];
    installationStatus?: string;
    version?: string;
  } = {},
): PackageItem {
  return {
    id,
    info: {
      id,
      files: overrides.files ?? [
        { filename: `plugins/${id.split('/')[1] ?? id}.auf` },
      ],
      dependencies: overrides.dependencies,
      conflicts: overrides.conflicts,
    },
    installationStatus: overrides.installationStatus ?? states.installed,
    version: overrides.version,
  } as unknown as PackageItem;
}

describe('parsePackageType', () => {
  it('plugin は 5 種の表示名に展開される', () => {
    expect(parsePackageType(['plugin'])).toEqual([
      '入力',
      '出力',
      'フィルター',
      '色変換',
      '言語',
    ]);
  });

  it('script は 6 種の表示名に展開される', () => {
    expect(parsePackageType(['script'])).toHaveLength(6);
  });

  it('個別タイプはそれぞれの表示名になり、未知のタイプは不明になる', () => {
    expect(parsePackageType(['filter', 'animation', 'unknown-type'])).toEqual([
      'フィルター',
      'アニメーション効果',
      '不明',
    ]);
  });
});

describe('detectPackageTypes', () => {
  it('拡張子からタイプを判定し重複を除く', () => {
    expect(
      detectPackageTypes([
        { filename: 'plugins/a.auf' },
        { filename: 'plugins/b.auf' },
        { filename: 'script/c.anm' },
      ] as Parameters<typeof detectPackageTypes>[0]),
    ).toEqual(['filter', 'animation']);
  });

  it('対象外の拡張子は無視される', () => {
    expect(
      detectPackageTypes([{ filename: 'readme.txt' }] as Parameters<
        typeof detectPackageTypes
      >[0]),
    ).toEqual([]);
  });
});

describe('getManuallyInstalledFiles', () => {
  it('apm.json 管理下のパッケージのファイルを除外する', () => {
    const packages = [
      makePackage('author/pkg', {
        files: [{ filename: 'plugins/pkg.auf' }],
      }),
    ];
    expect(
      getManuallyInstalledFiles(
        ['plugins/pkg.auf', 'plugins/manual.auf'],
        { 'author/pkg': { id: 'author/pkg', version: '1.0' } },
        packages,
      ),
    ).toEqual(['plugins/manual.auf']);
  });

  it('isDirectory のファイルは前方一致で除外する', () => {
    const packages = [
      makePackage('author/pkg', {
        files: [{ filename: 'script/pkgdir', isDirectory: true }],
      }),
    ];
    expect(
      getManuallyInstalledFiles(
        ['script/pkgdir/a.anm', 'script/other.anm'],
        { 'author/pkg': { id: 'author/pkg', version: '1.0' } },
        packages,
      ),
    ).toEqual(['script/other.anm']);
  });

  it('apm.json に無いパッケージのファイルは除外しない', () => {
    const packages = [
      makePackage('author/pkg', {
        files: [{ filename: 'plugins/pkg.auf' }],
      }),
    ];
    expect(
      getManuallyInstalledFiles(['plugins/pkg.auf'], {}, packages),
    ).toEqual(['plugins/pkg.auf']);
  });
});

describe('getInstalledVersionOfPackage', () => {
  const tempDirs: string[] = [];

  /**
   * Creates a temporary directory removed after each test.
   * @param {string} prefix - A prefix of the directory name.
   * @returns {Promise<string>} The created directory.
   */
  async function makeTempDir(prefix: string) {
    const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => remove(dir)));
  });

  it('apm.json に無くファイルも無ければ未インストール', async () => {
    const inst = await makeTempDir('apm-pkgstatus-');
    const p = makePackage('author/pkg', {
      files: [{ filename: 'pkg.auf' }],
    });
    expect(getInstalledVersionOfPackage(p, [], [], {}, inst)).toEqual([
      states.notInstalled,
      undefined,
    ]);
  });

  it('ファイルが手動インストール扱いなら手動インストール済み', async () => {
    const inst = await makeTempDir('apm-pkgstatus-');
    const p = makePackage('author/pkg', {
      files: [{ filename: 'pkg.auf' }],
    });
    expect(
      getInstalledVersionOfPackage(p, ['pkg.auf'], ['pkg.auf'], {}, inst),
    ).toEqual([states.manuallyInstalled, undefined]);
  });

  it('ファイルはあるが apm.json に無ければ他バージョンがインストール済み', async () => {
    const inst = await makeTempDir('apm-pkgstatus-');
    const p = makePackage('author/pkg', {
      files: [{ filename: 'pkg.auf' }],
    });
    expect(getInstalledVersionOfPackage(p, ['pkg.auf'], [], {}, inst)).toEqual([
      states.otherInstalled,
      undefined,
    ]);
  });

  it('apm.json にあり実ファイルの検証が通ればインストール済み + バージョン', async () => {
    const inst = await makeTempDir('apm-pkgstatus-');
    await writeFile(path.join(inst, 'pkg.auf'), '');
    const p = makePackage('author/pkg', {
      files: [{ filename: 'pkg.auf' }],
    });
    expect(
      getInstalledVersionOfPackage(
        p,
        ['pkg.auf'],
        [],
        { 'author/pkg': { id: 'author/pkg', version: '1.2' } },
        inst,
      ),
    ).toEqual([states.installed, '1.2']);
  });

  it('apm.json にあるが実ファイルが欠けていれば未導入ファイルあり', async () => {
    const inst = await makeTempDir('apm-pkgstatus-');
    const p = makePackage('author/pkg', {
      files: [{ filename: 'pkg.auf' }],
    });
    expect(
      getInstalledVersionOfPackage(
        p,
        [],
        [],
        { 'author/pkg': { id: 'author/pkg', version: '1.2' } },
        inst,
      ),
    ).toEqual([states.installedButBroken, undefined]);
  });

  it('isObsolete を含むパッケージは検証せずインストール済みになる', async () => {
    const inst = await makeTempDir('apm-pkgstatus-');
    const p = makePackage('author/pkg', {
      files: [
        { filename: 'pkg.auf' },
        { filename: 'old.auf', isObsolete: true },
      ],
    });
    expect(
      getInstalledVersionOfPackage(
        p,
        [],
        [],
        { 'author/pkg': { id: 'author/pkg', version: '1.2' } },
        inst,
      ),
    ).toEqual([states.installed, '1.2']);
  });

  it('isInstallOnly のファイルは判定に使わない', async () => {
    const inst = await makeTempDir('apm-pkgstatus-');
    const p = makePackage('author/pkg', {
      files: [
        { filename: 'shared.dll', isInstallOnly: true },
        { filename: 'pkg.auf' },
      ],
    });
    // shared.dll が存在しても otherInstalled にはならない
    expect(
      getInstalledVersionOfPackage(p, ['shared.dll'], [], {}, inst),
    ).toEqual([states.notInstalled, undefined]);
  });
});

describe('computePackagesStatus', () => {
  it('依存の無いパッケージはインストール可能', () => {
    const result = computePackagesStatus(
      [makePackage('author/a', { installationStatus: states.notInstalled })],
      '1.10',
      '0.92',
    );
    expect(result[0].doNotInstall).toBe(false);
    expect(result[0].detached).toEqual([]);
  });

  it('aviutl 疑似 ID はインストール中のバージョンと一致すれば満たされる', () => {
    const result = computePackagesStatus(
      [
        makePackage('author/a', {
          installationStatus: states.notInstalled,
          dependencies: ['aviutl1.10'],
        }),
        makePackage('author/b', {
          installationStatus: states.notInstalled,
          dependencies: ['aviutl1.00'],
        }),
      ],
      '1.10',
      '0.92',
    );
    expect(result[0].doNotInstall).toBe(false);
    expect(result[1].doNotInstall).toBe(true);
  });

  it('依存の or 指定(|)はどれか 1 つ満たせばよい', () => {
    const result = computePackagesStatus(
      [
        makePackage('author/a', {
          installationStatus: states.notInstalled,
          dependencies: ['aviutl9.99|exedit0.92'],
        }),
      ],
      '1.10',
      '0.92',
    );
    expect(result[0].doNotInstall).toBe(false);
  });

  it('他バージョンがインストール済みのパッケージはインストール不可', () => {
    const result = computePackagesStatus(
      [makePackage('author/a', { installationStatus: states.otherInstalled })],
      '1.10',
      '0.92',
    );
    expect(result[0].doNotInstall).toBe(true);
  });

  it('conflicts に指定した相手がインストール済みならインストール不可', () => {
    const result = computePackagesStatus(
      [
        makePackage('author/a', {
          installationStatus: states.notInstalled,
          conflicts: ['author/b'],
        }),
        makePackage('author/b', {
          installationStatus: states.installed,
          version: '1.0',
        }),
      ],
      '1.10',
      '0.92',
    );
    expect(result[0].doNotInstall).toBe(true);
  });

  it('インストール済みで依存が未導入なら detached に依存候補が入る', () => {
    const result = computePackagesStatus(
      [
        makePackage('author/a', {
          installationStatus: states.installed,
          version: '1.0',
          dependencies: ['author/dep'],
        }),
        makePackage('author/dep', {
          installationStatus: states.notInstalled,
        }),
      ],
      '1.10',
      '0.92',
    );
    expect(result[0].detached.map((p) => p.id)).toEqual(['author/dep']);
  });

  it('依存のバージョン指定(>=)は compareVersionOp で判定される', () => {
    // 注: isInstallable はバージョン指定付き ID をパッケージに解決しないため、
    // detached の候補になるのは or 指定のうちバージョン指定の無い ID だけ
    const base = (depVersion: string) => [
      makePackage('author/a', {
        installationStatus: states.installed,
        version: '1.0',
        dependencies: ['author/dep>=2.0|author/alt'],
      }),
      makePackage('author/dep', {
        installationStatus: states.installed,
        version: depVersion,
      }),
      makePackage('author/alt', {
        installationStatus: states.notInstalled,
      }),
    ];
    // 1.5 < 2.0 なので未充足 → or 内でインストール可能な author/alt が候補になる
    const withOld = computePackagesStatus(base('1.5'), '1.10', '0.92');
    expect(withOld[0].detached.map((p) => p.id)).toEqual(['author/alt']);

    // 2.1 >= 2.0 で充足 → detached なし
    const withNew = computePackagesStatus(base('2.1'), '1.10', '0.92');
    expect(withNew[0].detached).toEqual([]);
  });
});
