import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../main/api';

export const TRPCReact = createTRPCReact<AppRouter>();
