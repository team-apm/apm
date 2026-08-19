import { existsSync } from 'fs-extra';
import path from 'node:path';

/** The default data files URL used when the input is empty. */
export const DEFAULT_DATA_URL =
  'https://cdn.jsdelivr.net/gh/team-apm/apm-data@main/v3/';

export type DataUrlValidationResult = {
  /** The normalized main data files URL (the default URL when the input is empty). */
  mainUrl: string;
  /** The extra data files URLs (one per line in the input, trimmed, empty lines removed). */
  extraUrls: string[];
  /** Error messages in the order the current UI shows them. Empty when valid. */
  errors: string[];
};

/**
 * Validates the data files URLs entered in the settings tab.
 * 挙動は旧 setting.ts の setDataUrl の検証部分と同一(特性化テストで固定):
 * メインはフォルダの URL(.json 不可)、追加はファイルの URL(.json 必須)。
 * http(s) で始まらない場合はローカルパスとして存在確認する。
 * @param {string} mainUrl - The main data files URL. Empty means the default URL.
 * @param {string} extraDataUrls - Newline-separated extra data files URLs.
 * @param {(p: string) => boolean} [fileExists] - Injectable existence check for local paths.
 * @returns {DataUrlValidationResult} The normalized URLs and error messages.
 */
export function validateDataUrls(
  mainUrl: string,
  extraDataUrls: string,
  fileExists: (p: string) => boolean = existsSync,
): DataUrlValidationResult {
  const value = mainUrl || DEFAULT_DATA_URL;

  const errors: string[] = [];
  if (!value.startsWith('http') && !fileExists(value)) {
    errors.push('有効なURLまたは場所を入力してください。');
  }
  if (path.extname(value) === '.json') {
    errors.push('フォルダのURLを入力してください。');
  }

  const extraUrls = extraDataUrls
    .split(/\r?\n/)
    .map((url) => url.trim())
    .filter((url) => url !== '');

  for (const extraUrl of extraUrls) {
    if (!extraUrl.startsWith('http') && !fileExists(extraUrl)) {
      errors.push(`有効なURLまたは場所を入力してください。(${extraUrl})`);
    }
    if (path.extname(extraUrl) !== '.json') {
      errors.push(
        `有効なJsonファイルのURLまたは場所を入力してください。(${extraUrl})`,
      );
    }
  }

  return { mainUrl: value, extraUrls, errors };
}
