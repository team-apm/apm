import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from './api';

export const TRPCReact = createTRPCReact<AppRouter>();
