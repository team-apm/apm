import { createTRPCProxyClient } from '@trpc/client';
import { ipcRenderer } from 'electron';
import { ELECTRON_TRPC_CHANNEL } from 'electron-trpc/main';
import { ipcLink } from 'electron-trpc/renderer';
import type { AppRouter } from '../main/api';

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
export const trpc = createTRPCProxyClient<AppRouter>({ links: [ipcLink()] });
