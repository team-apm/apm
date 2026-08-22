import path from 'node:path';
import Ledger from './Ledger';

/**
 * インストール先フォルダの集約(ユビキタス言語の Installation)。
 * services を貫通していた instPath 文字列を置き換える plain object。
 * クラスにしないのは、全面的に関数スタイルの現行コードと vi.mock による
 * モジュール差し替えのテスト戦略を保つため。存在チェック等の不変条件も
 * 強制しない(現行挙動の維持を優先し、賢さは後から足せる)。
 */
export type Installation = {
  /** The path to the installation directory. */
  readonly path: string;
  /** Loads the ledger (apm.json) of this installation. */
  ledger(): Promise<Ledger>;
  /** The path to the local repository (packages.json). */
  readonly localRepoPath: string;
};

/**
 * Creates the Installation of the given installation directory.
 * @param {string} instPath - The path to the installation directory.
 * @returns {Installation} The installation.
 */
export function openInstallation(instPath: string): Installation {
  return {
    path: instPath,
    ledger: () => Ledger.load(instPath),
    localRepoPath: path.join(instPath, 'packages.json'),
  };
}
