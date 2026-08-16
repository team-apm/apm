import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ipcLink } from 'electron-trpc/renderer';
import React, { type JSX, type ReactNode } from 'react';
import { TRPCReact } from '../../trpc';

// main 窓には React root が複数あるため、client は共有のモジュールレベルで 1 つ持つ
const queryClient = new QueryClient();
const trpcClient = TRPCReact.createClient({
  links: [ipcLink()],
});

/**
 * Provides tRPC and react-query contexts for the settings components.
 * @param {object} props - Props.
 * @param {ReactNode} props.children - Children to render.
 * @returns {JSX.Element} The provider tree.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  return (
    <TRPCReact.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </TRPCReact.Provider>
  );
}
