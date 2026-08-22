import { migrationGlobal } from '../services/migration';
import { t, winProcedure } from './trpc';

export const migrationRouter = t.router({
  global: winProcedure.mutation(async ({ ctx }) => {
    await migrationGlobal(ctx);
  }),
});
