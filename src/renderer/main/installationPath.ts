// インストール先のモジュールストア。旧実装は #installation-path(readonly
// input)の value を単一ソースにし DOM 経由で共有していたが、preload の
// 初期化フロー移設に伴い DOM から独立させた。React からは
// useSyncExternalStore(subscribeInstallationPath, getInstallationPath) で購読する。

let installationPath = '';
const listeners = new Set<() => void>();

/**
 * Returns the current installation path.
 * @returns {string} The installation path (empty string if not set).
 */
export function getInstallationPath(): string {
  return installationPath;
}

/**
 * Sets the installation path and notifies the subscribers.
 * @param {string} next - The new installation path.
 */
export function setInstallationPath(next: string): void {
  installationPath = next;
  listeners.forEach((listener) => listener());
}

/**
 * Subscribes to the installation path changes (for useSyncExternalStore).
 * @param {() => void} listener - Called on every change.
 * @returns {() => void} The unsubscribe function.
 */
export function subscribeInstallationPath(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
