import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { type JSX, type ReactNode } from 'react';
import { ipcLink } from 'trpc-electron/renderer';
import { TRPCReact } from '../trpc';

// client はモジュールレベルで 1 つだけ持つ。1 窓に tRPC クライアントを
// 複数作るとリクエスト ID が衝突する(AGENTS.md 落とし穴)
const queryClient = new QueryClient();
const trpcClient = TRPCReact.createClient({
  links: [ipcLink()],
});

/**
 * Provides tRPC and react-query contexts for the components in the main window.
 * @param {object} props - Props.
 * @param {ReactNode} props.children - Children to render.
 * @returns {JSX.Element} The provider tree.
 */
export function TrpcProvider({ children }: { children: ReactNode }) {
  return (
    <TRPCReact.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </TRPCReact.Provider>
  );
}
