import {
  deleteProperty,
  getProperty,
  hasProperty,
  setProperty,
} from 'dot-prop';
import log from 'electron-log';
import { readJson, writeJson } from 'fs-extra';
import path from 'node:path';
import { type LedgerObject } from '../types/ledger';

// 導入記録(ユビキタス言語の Ledger)。ディスク上の実体はインストール
// フォルダ直下の apm.json で、ファイル名は互換のため変えない
class Ledger {
  // 同一 apm.json のインスタンスをプロセス内で共有する。load ごとに別の
  // メモリコピーを作ると、並行する read-modify-write(インストールの
  // addPackage と、一覧再取得 query 内の整合性採認など)が互いの書き込みを
  // 全体書き戻しで消し合う(lost update)。操作単位のミューテックスで直列化
  // する案は全サービスの呼び出し境界の再定義が必要で差分が大きく、単一
  // プロセスなら共有オブジェクト化で同じ効果が得られるため採らない。
  // apm の多重起動(プロセス間の競合)はこの方式では防げない(別課題)
  private static instances = new Map<string, Promise<Ledger>>();

  private path: string;
  private object: LedgerObject;
  private inTransaction = false;
  private dirty = false;
  // 同じファイルへの writeJson が並行すると内容が交錯しうるため直列化する
  private saveQueue: Promise<void> = Promise.resolve();

  /**
   * Gets the path to `apm.json`.
   * @param {string} [installationPath] - The path to the installation directory.
   * @returns {string} The path to `apm.json`.
   */
  public static getPath(installationPath: string): string {
    return path.join(installationPath, 'apm.json');
  }

  /**
   * Creates an instance of Ledger. Instances are shared per installation
   * so that concurrent operations see and modify the same object.
   * @param {string} [installationPath] - The path to the installation directory.
   * @returns {Promise<Ledger>} A promise that resolves with the instance of Ledger.
   */
  public static async load(installationPath: string): Promise<Ledger> {
    const jsonPath = path.resolve(this.getPath(installationPath));
    let instance = this.instances.get(jsonPath);
    if (!instance) {
      instance = new Ledger().load(jsonPath);
      this.instances.set(jsonPath, instance);
    }
    return await instance;
  }

  /**
   * Loads the object parsed from `apm.json`.
   * @param {string} path - The path to the `apm.json` file.
   * @returns {Promise<Ledger>} A promise that resolves with the instance of Ledger.
   */
  private async load(path: string): Promise<Ledger> {
    this.path = path;

    try {
      const value = await readJson(path);
      if (typeof value === 'object') {
        this.object = value;
      } else {
        throw new Error('Invalid apm.json.');
      }
    } catch (e) {
      if (e.code !== 'ENOENT') log.error(e);
      this.object = {
        dataVersion: '3',
        core: {},
        packages: {},
      };
    }

    return this;
  }

  /**
   * Save the object to `apm.json`.
   * @returns {Promise<void>} A promise that resolves when the object is saved.
   */
  private save(): Promise<void> {
    const queued = this.saveQueue.then(() =>
      writeJson(this.path, this.object, { spaces: 2 }),
    );
    // 失敗は呼び出し元へは queued で伝播させ、後続の書き込みは止めない
    this.saveQueue = queued.catch(() => {});
    return queued;
  }

  /**
   * Starts a transaction. Subsequent set / delete calls are kept in memory
   * (still visible via get / has) until commit() is called.
   */
  public begin() {
    this.inTransaction = true;
  }

  /**
   * Saves the changes accumulated since begin() to `apm.json` at once and
   * ends the transaction. Does not write when nothing has changed.
   * @returns {Promise<void>} A promise that resolves when the object is saved.
   */
  public async commit() {
    this.inTransaction = false;
    if (this.dirty) {
      this.dirty = false;
      await this.save();
    }
  }

  /**
   * Checks whether `apm.json` has the property.
   * @param {string} path - Key to check existing
   * @returns {Promise<boolean>} Whether `apm.json` has the property.
   */
  public async has(path: string): Promise<boolean> {
    return hasProperty(this.object, path);
  }

  /**
   * Gets the value from `apm.json`.
   * @param {string} path - Key to get value
   * @param {unknown} [defaultValue] - A value replaced when the property don't exists.
   * @returns {Promise<unknown>} The property selected by key.
   */
  public async get(
    path: string = '',
    defaultValue?: unknown,
  ): Promise<unknown> {
    return getProperty(this.object, path, defaultValue);
  }

  /**
   * Sets the value to `apm.json`.
   * @param {string} path - Key to set value
   * @param {unknown} [value] - A value to set
   */
  public async set(path: string, value: unknown) {
    setProperty(this.object, path, value);
    if (this.inTransaction) {
      this.dirty = true;
    } else {
      await this.save();
    }
  }

  /**
   * Deletes the value from `apm.json`.
   * @param {string} path - Key to delete value
   * @returns {Promise<boolean>} Whether the property was deleted.
   */
  public async delete(path: string) {
    const existed = deleteProperty(this.object, path);
    if (this.inTransaction) {
      if (existed) this.dirty = true;
    } else {
      await this.save();
    }
    return existed;
  }

  /**
   * Sets the core version to `apm.json`.
   * @param {string} program - A name of the program
   * @param {string} version - A version of the program
   */
  public async setCore(program: string, version: string) {
    await this.set(`core.${program}`, version);
  }

  /**
   * Adds the information of the package to `apm.json`.
   * @param {string} id - The ID of the package
   * @param {string} version - The version of the package
   */
  public async addPackage(id: string, version: string) {
    await this.set(`packages.${id}`, { id, version });
  }

  /**
   * Removes the information of the package from `apm.json`.
   * @param {string} id - The ID of the package
   */
  public async removePackage(id: string) {
    await this.delete(`packages.${id}`);
  }
}

export default Ledger;
