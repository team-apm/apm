import { updateInfo } from '../services/modList';
import { t, winProcedure } from './trpc';

export const modListRouter = t.router({
  updateInfo: winProcedure.mutation(async ({ ctx }) => {
    await updateInfo(ctx.win, ctx.config);
  }),
});
