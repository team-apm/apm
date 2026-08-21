import { migrationByFolder, migrationGlobal } from '../services/migration';
import { stringInput, t, winProcedure } from './trpc';

export const migrationRouter = t.router({
  global: winProcedure.mutation(async ({ ctx }) => {
    // 戻り値 false は起動中止(キャンセル)。trpc-electron の falsy 変換は
    // 入力側のみで出力側は安全なため boolean をそのまま返す
    return await migrationGlobal(ctx.win, ctx.config);
  }),
  byFolder: winProcedure.input(stringInput).mutation(async ({ input, ctx }) => {
    await migrationByFolder(ctx.win, ctx.config, input);
  }),
});
