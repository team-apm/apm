let opener: (() => void) | undefined;

/**
 * Registers the function that opens the about window.
 * 生成には mainWindow と tRPC ハンドラへの参照が要るため、
 * windows.ts の launch 時にクロージャとして登録する(api.ts との循環 import 回避)。
 * @param {() => void} fn - The function that opens the about window.
 */
export function setAboutWindowOpener(fn: () => void) {
  opener = fn;
}

/**
 * Opens the about window.
 */
export function openAboutWindow() {
  if (!opener) throw new Error('The about window opener is not ready.');
  opener();
}
