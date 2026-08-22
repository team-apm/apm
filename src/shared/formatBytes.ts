const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/**
 * Formats a byte count for display.
 * 表示用なので厳密さより読みやすさを優先し、1024 で桁を繰り上げる。
 * @param {number} bytes - The number of bytes.
 * @returns {string} The formatted size, e.g. "1.5 GB".
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';

  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }

  // B は整数、それ以外は小数第 1 位まで(1.0 MB のような末尾 0 は落とす)
  const text =
    unit === 0
      ? String(Math.round(value))
      : String(Math.round(value * 10) / 10);
  return `${text} ${UNITS[unit]}`;
}
