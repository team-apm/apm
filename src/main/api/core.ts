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
import { procedure, stringInput, t, winProcedure } from './trpc';

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
  getCoreInfo: winProcedure.query(
    async ({ ctx }) => await getCoreInfo(ctx.win, ctx.config),
  ),
  hasExeditInPluginsFolder: procedure
    .input(stringInput)
    .query(({ input }) => hasExeditInPluginsFolder(input)),
  ensureInstallationPath: procedure.mutation(({ ctx }) =>
    ensureInstallationPath(ctx.config),
  ),
  getDates: procedure.query(({ ctx }) => getCoreDates(ctx.config)),
  changeInstallationPath: winProcedure
    .input(stringInput)
    .mutation(
      async ({ input, ctx }) =>
        await changeInstallationPath(ctx.win, ctx.config, input),
    ),
  getApmJsonCoreVersions: procedure
    .input(stringInput)
    .query(async ({ input }) => await getApmJsonCoreVersions(input)),
  getInstalledVersionTexts: winProcedure
    .input(stringInput)
    .query(
      async ({ input, ctx }) =>
        await getInstalledVersionTexts(ctx.win, ctx.config, input),
    ),
  checkLatestVersion: winProcedure.mutation(async ({ ctx }) => {
    await checkCoreLatestVersion(ctx.win, ctx.config);
  }),
  installProgram: winProcedure
    .input(installProgramInput)
    .mutation(async ({ input, ctx }) => {
      return await installCoreProgram(
        ctx.win,
        ctx.config,
        input.program,
        input.version,
        input.instPath,
      );
    }),
});
