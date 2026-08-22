import {
  changeInstallationPath,
  checkCoreLatestVersion,
  ensureInstallationPath,
  getApmJsonCoreVersions,
  getCoreDates,
  getCoreInfo,
  getInstalledVersionTexts,
  hasExeditInPluginsFolder,
  installCoreProgram,
} from '../services/core';
import {
  instProcedure,
  procedure,
  stringInput,
  t,
  winInstProcedure,
  winProcedure,
} from './trpc';

const installProgramInput = (
  value: unknown,
): { program: 'aviutl' | 'exedit'; version: string; instPath: string } => {
  if (typeof value !== 'object' || value === null)
    throw new TypeError('An object is expected.');
  const { program, version, instPath } = value as Record<string, unknown>;
  if (program !== 'aviutl' && program !== 'exedit')
    throw new TypeError('program is expected to be aviutl or exedit.');
  if (typeof version !== 'string' || typeof instPath !== 'string')
    throw new TypeError('version and instPath are expected to be strings.');
  return { program, version, instPath };
};

export const coreRouter = t.router({
  getCoreInfo: winProcedure.query(async ({ ctx }) => await getCoreInfo(ctx)),
  hasExeditInPluginsFolder: instProcedure
    .input(stringInput)
    .query(({ ctx }) => hasExeditInPluginsFolder(ctx.inst)),
  ensureInstallationPath: procedure.mutation(({ ctx }) =>
    ensureInstallationPath(ctx.config),
  ),
  getDates: procedure.query(({ ctx }) => getCoreDates(ctx.config)),
  changeInstallationPath: winInstProcedure
    .input(stringInput)
    .mutation(async ({ ctx }) => await changeInstallationPath(ctx, ctx.inst)),
  getApmJsonCoreVersions: instProcedure
    .input(stringInput)
    .query(async ({ ctx }) => await getApmJsonCoreVersions(ctx.inst)),
  getInstalledVersionTexts: winInstProcedure
    .input(stringInput)
    .query(async ({ ctx }) => await getInstalledVersionTexts(ctx, ctx.inst)),
  checkLatestVersion: winProcedure.mutation(async ({ ctx }) => {
    await checkCoreLatestVersion(ctx);
  }),
  installProgram: winInstProcedure
    .input(installProgramInput)
    .mutation(async ({ input, ctx }) => {
      return await installCoreProgram(
        ctx,
        ctx.inst,
        input.program,
        input.version,
      );
    }),
});
