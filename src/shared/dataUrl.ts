import { existsSync } from 'fs-extra';
import path from 'node:path';

/** The default data files URL used when the input is empty. */
export const DEFAULT_DATA_URL =
  'https://cdn.jsdelivr.net/gh/team-apm/apm-data@main/v3/';

export type DataUrlCautions = {
  /** Origins that are not approved yet. */
  unknownOrigins: string[];
  /** Plain-http URLs whose traffic can be tampered with. */
  insecureUrls: string[];
};

/** Hostnames that never need a confirmation (developer loopback). */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/**
 * Collects the data URLs that deserve a one-time confirmation.
 * dataURL は自由入力を維持する確定方針のため、ここで拒否はしない。
 * 未知オリジンと平文 http の列挙だけを行い、確認するかは呼び出し側の責務。
 * ローカルパスと loopback を対象外にするのは、自作パッケージ検証という
 * ユースケース(および E2E フィクスチャ)がリモート攻撃面ではないため。
 * @param {string[]} urls - The data URLs to inspect (local paths are skipped).
 * @param {string[]} approvedOrigins - Origins already approved by the user.
 * @returns {DataUrlCautions} The unknown origins and plain-http URLs.
 */
export function collectDataUrlCautions(
  urls: string[],
  approvedOrigins: string[],
): DataUrlCautions {
  const approved = new Set(approvedOrigins);
  const unknownOrigins: string[] = [];
  const insecureUrls: string[] = [];
  for (const url of urls) {
    if (!/^https?:\/\//.test(url)) continue;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }
    if (LOOPBACK_HOSTS.has(parsed.hostname)) continue;
    // 承認済みオリジンは平文 http も含めて再確認しない(承認は
    // 「このオリジンを信頼する」の意味で一度だけ)
    if (approved.has(parsed.origin)) continue;
    if (parsed.protocol === 'http:') insecureUrls.push(url);
    if (!unknownOrigins.includes(parsed.origin))
      unknownOrigins.push(parsed.origin);
  }
  return { unknownOrigins, insecureUrls };
}

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
