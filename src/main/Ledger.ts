import {
  deleteProperty,
  getProperty,
  hasProperty,
  setProperty,
} from 'dot-prop';
import log from 'electron-log';
import { readJson, remove, rename, writeJson } from 'fs-extra';
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
  // プロセス間の競合は index.ts の requestSingleInstanceLock で防ぐ(2 個目は
  // 起動しない)。ただしロックは userData 単位なので、_Dev の開発起動と製品版が
  // 同じインストール先を指す構成だけは防げない
  private static instances = new Map<string, Promise<Ledger>>();

  // 生成は必ず静的ファクトリ(load)経由で、new した直後に load() を呼ぶ。
  // load() は成功・失敗のどちらの経路でもこの 2 つを設定するが、
  // コンストラクタからは追えないため明示する
  private path!: string;
  private object!: LedgerObject;
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
      const value: unknown = await readJson(path);
      // typeof null === 'object' なので null と配列も通ってしまう。通すと
      // dot-prop の setProperty が無言で何もせず(null)、あるいは
      // JSON.stringify が付加プロパティを落として(配列)、以後の書き込みが
      // 永久に捨てられる。壊れたファイルとして既定値へ倒す
      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        this.object = value as LedgerObject;
      } else {
        throw new Error('Invalid apm.json.');
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') log.error(e);
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
    // 一時ファイルへ書いてから rename する。実ファイルへ直接 writeJson
    // すると、書き込み中の電断・強制終了・ディスクフルで apm.json が
    // 途中まで書かれた不正 JSON として残り、次回 load() が既定値へ
    // フォールバックして導入記録が読めなくなる。同一ディレクトリなら
    // rename は同じファイルシステム上の操作なので原子的に置き換わる
    // (config.json 側は electron-store が同じことをしている)。
    // 一時ファイル名を固定にできるのは saveQueue で直列化しているため
    const queued = this.saveQueue.then(async () => {
      const tempPath = this.path + '.tmp';
      try {
        await writeJson(tempPath, this.object, { spaces: 2 });
        await rename(tempPath, this.path);
      } catch (e) {
        // 書き損じた一時ファイルを残さない(次回の rename が
        // 中途半端な内容を本体へ持ち込まないようにする)
        await remove(tempPath).catch(() => undefined);
        throw e;
      }
    });
    // 失敗は呼び出し元へは queued で伝播させ、後続の書き込みは止めない
    this.saveQueue = queued.catch(() => {});
    return queued;
  }

  /**
   * Starts a transaction. Subsequent set / delete calls are kept in memory
   * (still visible via get / has) until commit() is called.
   */
  private begin() {
    this.inTransaction = true;
  }

  /**
   * Saves the changes accumulated since begin() to `apm.json` at once and
   * ends the transaction. Does not write when nothing has changed.
   * @returns {Promise<void>} A promise that resolves when the object is saved.
   */
  private async commit() {
    this.inTransaction = false;
    if (this.dirty) {
      this.dirty = false;
      await this.save();
    }
  }

  /**
   * Runs the given operation, writing everything it changed to `apm.json` in
   * one go.
   * begin / commit を公開せず必ずこの経路を通すのは、例外で commit を飛ばすと
   * inTransaction が立ったままになり、以降の set / delete が「書き込みを遅延
   * する」側へ落ちて二度とディスクに書かれないため(インストール記録が黙って
   * 消える)。
   * 失敗時に変更を破棄して復元しないのは、インスタンスがプロセス内で共有され
   * ておりスナップショットへ戻すと、同じ間に別経路が行った即時書き込み
   * (インストールの addPackage 等)まで巻き戻してしまうため。途中まで書かれても
   * 次回の実行でやり直せる(冪等な)処理だけをここへ渡す。
   * @param {() => Promise<T>} operation - The operation to run in the transaction.
   * @returns {Promise<T>} The value returned by the operation.
   */
  public async transaction<T>(operation: () => Promise<T>): Promise<T> {
    this.begin();
    try {
      return await operation();
    } finally {
      await this.commit();
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
   * Returns the packages record, creating it when the loaded `apm.json`
   * does not have one.
   * dot-prop の setProperty は途中の階層を作るので、パス経由だったころは
   * 暗黙に作られていた。キーを直接触るならここで面倒を見る。
   * @returns {LedgerObject['packages']} The packages record.
   */
  private packagesRecord(): LedgerObject['packages'] {
    this.object.packages ??= {};
    return this.object.packages;
  }

  /**
   * Records the change: defers the write inside a transaction, writes
   * immediately otherwise.
   * @param {boolean} changed - Whether the object actually changed.
   */
  private async recordChange(changed: boolean) {
    if (this.inTransaction) {
      if (changed) this.dirty = true;
    } else {
      await this.save();
    }
  }

  /**
   * Checks whether the package is recorded in `apm.json`.
   * @param {string} id - The ID of the package
   * @returns {Promise<boolean>} Whether the package is recorded.
   */
  public async hasPackage(id: string): Promise<boolean> {
    return Object.hasOwn(this.packagesRecord(), id);
  }

  /**
   * Adds the information of the package to `apm.json`.
   * パッケージ ID を dot-prop のパスとして渡さないのは、ID に '.' が
   * 含まれると packages['a/b'].c のようにネストして書かれるため。
   * 読み出し側(resolveInstallationStatus)は packages をフラットな
   * Record として引くので、記録したのに未インストール判定になる。
   * apm-schema の id は '.' を許さないが、dataURL は自由入力(確定方針)
   * なので schema 非準拠の ID は到達しうる。
   * @param {string} id - The ID of the package
   * @param {string} version - The version of the package
   */
  public async addPackage(id: string, version: string) {
    this.packagesRecord()[id] = { id, version };
    await this.recordChange(true);
  }

  /**
   * Removes the information of the package from `apm.json`.
   * @param {string} id - The ID of the package
   */
  public async removePackage(id: string) {
    const packages = this.packagesRecord();
    const existed = Object.hasOwn(packages, id);
    if (existed) delete packages[id];
    await this.recordChange(existed);
  }
}

export default Ledger;
