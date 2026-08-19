import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { type JSX } from 'react';
import { ipcLink } from 'trpc-electron/renderer';
import { TRPCReact } from '../trpc';
import About from './About';

const queryClient = new QueryClient();
const trpcClient = TRPCReact.createClient({
  links: [ipcLink()],
});

/**
 * Main application component.
 * @returns {JSX.Element} The rendered component.
 */
function App() {
  return (
    <TRPCReact.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <About />
      </QueryClientProvider>
    </TRPCReact.Provider>
  );
}

export default App;
