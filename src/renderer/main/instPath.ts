/**
 * Reads the current installation path from the DOM input.
 * @returns {string} The installation path (empty string if not set).
 */
export function getInstallationPath(): string {
  // DOM は隔離ワールドとメインワールドで共有されるため、contextBridge
  // (旧 coreBridge)を介さずメインワールドから直接読める。値の書き込みは
  // 引き続き preload の初期化フローと SelectInstallationPathButton が行う
  const input = document.getElementById(
    'installation-path',
  ) as HTMLInputElement | null;
  return input?.value ?? '';
}
