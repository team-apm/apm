import * as os from 'node:os';
import {
  collectDataUrlCautions,
  type DataUrlValidationResult,
  DEFAULT_DATA_URL,
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
 * Builds the Japanese confirmation message for unapproved data URLs.
 * @param {ReturnType<typeof collectDataUrlCautions>} cautions - The cautions.
 * @returns {string} The dialog message.
 */
function buildCautionMessage(
  cautions: ReturnType<typeof collectDataUrlCautions>,
) {
  const lines = [
    '初めて使うデータ取得先が含まれています。信頼できる配布元か確認してください。',
    '',
    ...cautions.unknownOrigins.map((origin) => `・${origin}`),
  ];
  if (cautions.insecureUrls.length > 0) {
    lines.push(
      '',
      '次の取得先は暗号化されない http のため、通信内容が改ざんされる恐れがあります。',
      ...cautions.insecureUrls.map((url) => `・${url}`),
    );
  }
  lines.push('', '続行しますか？');
  return lines.join('\n');
}

/**
 * Validates the data files URLs and saves them to the config only when valid.
 * 旧 setting.ts の setDataUrl のうち、検証と設定書き込みの部分と同一の挙動に
 * 加え、未承認オリジン・平文 http を含むときは保存前に一度だけ確認する
 * (#2377。dataURL 自由入力の確定方針のため拒否はしない)。
 * ダイアログ表示を confirm として注入するのは、このモジュールを
 * electron 非依存に保ちユニットテスト可能にするため。
 * @param {Config} config - The config instance.
 * @param {string} mainUrl - The main data files URL. Empty means the default URL.
 * @param {string} extraDataUrls - Newline-separated extra data files URLs.
 * @param {(message: string) => Promise<boolean>} confirm - Shows a confirmation dialog.
 * @returns {Promise<DataUrlValidationResult & { canceled: boolean }>} The validation result.
 */
export async function setDataUrls(
  config: Config,
  mainUrl: string,
  extraDataUrls: string,
  confirm: (message: string) => Promise<boolean>,
): Promise<DataUrlValidationResult & { canceled: boolean }> {
  const result = validateDataUrls(mainUrl, extraDataUrls);
  if (result.errors.length > 0) return { ...result, canceled: false };

  const approvedOrigins = [
    new URL(DEFAULT_DATA_URL).origin,
    ...config.dataURL.getApprovedOrigins(),
  ];
  const cautions = collectDataUrlCautions(
    [result.mainUrl, ...result.extraUrls],
    approvedOrigins,
  );
  if (cautions.unknownOrigins.length > 0 || cautions.insecureUrls.length > 0) {
    if (!(await confirm(buildCautionMessage(cautions))))
      return { ...result, canceled: true };
    config.dataURL.setApprovedOrigins([
      ...new Set([
        ...config.dataURL.getApprovedOrigins(),
        ...cautions.unknownOrigins,
      ]),
    ]);
  }

  config.dataURL.setMain(result.mainUrl);
  config.dataURL.setExtra(result.extraUrls.join(os.EOL));
  return { ...result, canceled: false };
}
