import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ipcLink } from 'electron-trpc/renderer';
import React, { type JSX, type ReactNode } from 'react';
import {
  trpcIdNamespaceLink,
  trpcIdParities,
} from '../../shared/trpcIdNamespace';
import { TRPCReact } from '../trpc';

// main 窓には React root が複数あるため、client は共有のモジュールレベルで 1 つ持つ
const queryClient = new QueryClient();
const trpcClient = TRPCReact.createClient({
  // 隔離ワールドのレガシークライアントとのリクエスト ID 衝突を防ぐ
  // (詳細は shared/trpcIdNamespace.ts のコメント参照)
  links: [trpcIdNamespaceLink(trpcIdParities.react), ipcLink()],
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
