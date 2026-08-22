import { migrationByFolder, migrationGlobal } from '../services/migration';
import { stringInput, t, winInstProcedure, winProcedure } from './trpc';

export const migrationRouter = t.router({
  global: winProcedure.mutation(async ({ ctx }) => {
    // 戻り値 false は起動中止(キャンセル)。trpc-electron の falsy 変換は
    // 入力側のみで出力側は安全なため boolean をそのまま返す
    return await migrationGlobal(ctx);
  }),
  byFolder: winInstProcedure.input(stringInput).mutation(async ({ ctx }) => {
    await migrationByFolder(ctx, ctx.inst);
  }),
});
