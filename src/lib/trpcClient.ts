import { createTRPCClient } from '@trpc/client';
import { ipcRenderer } from 'electron';
import { ELECTRON_TRPC_CHANNEL } from 'trpc-electron/main';
import { ipcLink } from 'trpc-electron/renderer';
import type { AppRouter } from '../main/api';
import { trpcIdNamespaceLink, trpcIdParities } from '../shared/trpcIdNamespace';

type ElectronTRPC = {
  sendMessage: (message: unknown) => void;
  onMessage: (callback: (message: unknown) => void) => void;
};

// exposeElectronTRPC は contextBridge でメインワールドにだけ bridge を生やすため、
// preload(隔離ワールド)で動くレガシーコードからは見えない。ipcLink が参照する
// globalThis.electronTRPC を、このワールドに同じ形で直接用意する。
(globalThis as { electronTRPC?: ElectronTRPC }).electronTRPC ??= {
  sendMessage: (message) => ipcRenderer.send(ELECTRON_TRPC_CHANNEL, message),
  onMessage: (callback) =>
    ipcRenderer.on(ELECTRON_TRPC_CHANNEL, (_event, message) =>
      callback(message),
    ),
};

/** レガシー(非 React)コードから main プロセスの tRPC procedure を呼ぶためのクライアント。 */
export const trpc = createTRPCClient<AppRouter>({
  // メインワールドの React クライアントとのリクエスト ID 衝突を防ぐ
  // (詳細は shared/trpcIdNamespace.ts のコメント参照)
  links: [trpcIdNamespaceLink(trpcIdParities.legacy), ipcLink()],
});
