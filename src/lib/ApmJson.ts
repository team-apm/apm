import {
  deleteProperty,
  getProperty,
  hasProperty,
  setProperty,
} from 'dot-prop';
import log from 'electron-log';
import { readJson, writeJson } from 'fs-extra';
import path from 'node:path';
import { type ApmJsonObject } from '../types/apmJson';

class ApmJson {
  private path: string;
  private object: ApmJsonObject;

  /**
   * Gets the path to `apm.json`.
   * @param {string} [instPath] - The path to the installation directory.
   * @returns {string} The path to `apm.json`.
   */
  public static getPath(instPath: string): string {
    return path.join(instPath, 'apm.json');
  }

  /**
   * Creates an instance of ApmJson.
   * @param {string} [instPath] - The path to the installation directory.
   * @returns {Promise<ApmJson>} A promise that resolves with the instance of ApmJson.
   */
  public static async load(instPath: string): Promise<ApmJson> {
    const apmJson = new ApmJson();
    const jsonPath = this.getPath(instPath);
    await apmJson.load(jsonPath);
    return apmJson;
  }

  /**
   * Loads the object parsed from `apm.json`.
   * @param {string} path - The path to the `apm.json` file.
   * @returns {Promise<ApmJson>} A promise that resolves with the instance of ApmJson.
   */
  private async load(path: string): Promise<ApmJson> {
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
    return writeJson(this.path, this.object, { spaces: 2 });
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
    await this.save();
  }

  /**
   * Deletes the value from `apm.json`.
   * @param {string} path - Key to delete value
   * @returns {Promise<boolean>} Whether the property was deleted.
   */
  public async delete(path: string) {
    const existed = deleteProperty(this.object, path);
    await this.save();
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

export default ApmJson;
