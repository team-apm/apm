import { initTRPC } from '@trpc/server';
import { app } from 'electron';

const t = initTRPC.create({ isServer: true });
const procedure = t.procedure;

export const router = t.router({
  getAppVersion: procedure.query(async () => {
    return app.getVersion();
  }),
});

export type AppRouter = typeof router;
