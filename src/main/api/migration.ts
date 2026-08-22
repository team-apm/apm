import { migrationByFolder, migrationGlobal } from '../services/migration';
import { stringInput, t, winInstProcedure, winProcedure } from './trpc';

export const migrationRouter = t.router({
  global: winProcedure.mutation(async ({ ctx }) => {
    await migrationGlobal(ctx);
  }),
  byFolder: winInstProcedure.input(stringInput).mutation(async ({ ctx }) => {
    await migrationByFolder(ctx, ctx.inst);
  }),
});
