import * as os from 'node:os';
import {
  type DataUrlValidationResult,
  validateDataUrls,
} from '../../shared/dataUrl';
import type Config from '../Config';

/**
 * Ensures that the extra data URLs entry exists in the config.
 * 旧 setting.ts の initSettings が行っていた前処理と同一。
 * @param {Config} config - The config instance.
 * @returns {object} Whether the main data URL is set, and the extra data URLs.
 */
export function ensureExtraDataUrl(config: Config): {
  hasMain: boolean;
  extra: string;
} {
  if (!config.dataURL.hasExtra()) config.dataURL.setExtra('');
  return {
    hasMain: config.dataURL.hasMain(),
    extra: config.dataURL.getExtra(),
  };
}

/**
 * Validates the data files URLs and saves them to the config only when valid.
 * 旧 setting.ts の setDataUrl のうち、検証と設定書き込みの部分と同一の挙動。
 * @param {Config} config - The config instance.
 * @param {string} mainUrl - The main data files URL. Empty means the default URL.
 * @param {string} extraDataUrls - Newline-separated extra data files URLs.
 * @returns {DataUrlValidationResult} The validation result.
 */
export function setDataUrls(
  config: Config,
  mainUrl: string,
  extraDataUrls: string,
): DataUrlValidationResult {
  const result = validateDataUrls(mainUrl, extraDataUrls);
  if (result.errors.length === 0) {
    config.dataURL.setMain(result.mainUrl);
    config.dataURL.setExtra(result.extraUrls.join(os.EOL));
  }
  return result;
}
