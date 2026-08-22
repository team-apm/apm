import {
  isHttpUrl,
  validatePackageInfo,
} from '../../shared/packageInfoValidation';
import {
  installPackageFlow,
  openPackageFolder,
} from '../services/packageInstall';
import {
  convertPackageIds,
  getLedgerInstalledIds,
  getPackages,
  getPackagesDates,
  getPackagesWithStatus,
  refreshPackagesList,
  resolveInstallationStatus,
} from '../services/packageList';
import {
  buildShareString,
  getEditorPackages,
  setEditorPackages,
} from '../services/packageShare';
import { uninstallPackageFiles } from '../services/packageUninstall';
import { getScriptsList, installScriptFlow } from '../services/scriptInstall';
import {
  instProcedure,
  procedure,
  stringInput,
  t,
  winInstProcedure,
  winProcedure,
} from './trpc';

// trpc-electron は falsy なトップレベル入力(false / 0 / '')を undefined に
// 変換してしまうため、boolean はオブジェクトで包んで受け取る
const scriptsListInput = (value: unknown): { update: boolean } => {
  if (typeof value !== 'object' || value === null)
    throw new TypeError('An object is expected.');
  const { update } = value as Record<string, unknown>;
  if (typeof update !== 'boolean')
    throw new TypeError('update is expected to be a boolean.');
  return { update };
};

const packageItemInput = (
  value: unknown,
): { id: string; info: Record<string, unknown> } => {
  if (typeof value !== 'object' || value === null)
    throw new TypeError('An object is expected.');
  const { id, info } = value as Record<string, unknown>;
  if (typeof id !== 'string' || typeof info !== 'object' || info === null)
    throw new TypeError('id is expected to be a string and info an object.');
  // renderer は非信頼。パス・コマンド・URL に到達するフィールドはここで検証する
  return { id, info: validatePackageInfo(info) };
};

const installPackageInput = (
  value: unknown,
): {
  instPath: string;
  packageItem: { id: string; info: Record<string, unknown> };
  direct: boolean;
  archivePath?: string;
} => {
  if (typeof value !== 'object' || value === null)
    throw new TypeError('An object is expected.');
  const { instPath, packageItem, direct, archivePath } = value as Record<
    string,
    unknown
  >;
  if (typeof instPath !== 'string')
    throw new TypeError('instPath is expected to be a string.');
  if (typeof direct !== 'boolean')
    throw new TypeError('direct is expected to be a boolean.');
  if (archivePath !== undefined && typeof archivePath !== 'string')
    throw new TypeError('archivePath is expected to be a string.');
  return {
    instPath,
    packageItem: packageItemInput(packageItem),
    direct,
    archivePath: archivePath as string | undefined,
  };
};

const uninstallPackageInput = (
  value: unknown,
): {
  instPath: string;
  packageItem: { id: string; info: Record<string, unknown> };
} => {
  if (typeof value !== 'object' || value === null)
    throw new TypeError('An object is expected.');
  const { instPath, packageItem } = value as Record<string, unknown>;
  if (typeof instPath !== 'string')
    throw new TypeError('instPath is expected to be a string.');
  return { instPath, packageItem: packageItemInput(packageItem) };
};

const installScriptFlowInput = (
  value: unknown,
): { instPath: string; url: string } => {
  if (typeof value !== 'object' || value === null)
    throw new TypeError('An object is expected.');
  const { instPath, url } = value as Record<string, unknown>;
  if (typeof instPath !== 'string' || typeof url !== 'string')
    throw new TypeError('instPath and url are expected to be strings.');
  // ブラウザ窓で開く URL なので http(s) 以外(file: 等)を通さない
  if (!isHttpUrl(url))
    throw new TypeError('url is expected to be a http(s) URL.');
  return { instPath, url };
};

const convertIdsInput = (
  value: unknown,
): { instPath: string; modTime: number } => {
  if (typeof value !== 'object' || value === null)
    throw new TypeError('An object is expected.');
  const { instPath, modTime } = value as Record<string, unknown>;
  if (typeof instPath !== 'string' || typeof modTime !== 'number')
    throw new TypeError(
      'instPath is expected to be a string and modTime a number.',
    );
  return { instPath, modTime };
};

const installedIdsInput = (
  value: unknown,
): { instPath: string; ids: string[] } => {
  if (typeof value !== 'object' || value === null)
    throw new TypeError('An object is expected.');
  const { instPath, ids } = value as Record<string, unknown>;
  if (typeof instPath !== 'string')
    throw new TypeError('instPath is expected to be a string.');
  if (!(Array.isArray(ids) && ids.every((id) => typeof id === 'string')))
    throw new TypeError('ids is expected to be an array of strings.');
  return { instPath, ids: ids as string[] };
};

const packagesWithStatusInput = (
  value: unknown,
): { instPath: string; adoptManuallyInstalled: boolean } => {
  if (typeof value !== 'object' || value === null)
    throw new TypeError('An object is expected.');
  const { instPath, adoptManuallyInstalled } = value as Record<string, unknown>;
  if (
    typeof instPath !== 'string' ||
    typeof adoptManuallyInstalled !== 'boolean'
  )
    throw new TypeError(
      'instPath is expected to be a string and adoptManuallyInstalled a boolean.',
    );
  return { instPath, adoptManuallyInstalled };
};

const editorPackagesInput = (
  value: unknown,
): { instPath: string; packages: Record<string, unknown>[] } => {
  if (typeof value !== 'object' || value === null)
    throw new TypeError('An object is expected.');
  const { instPath, packages } = value as Record<string, unknown>;
  if (typeof instPath !== 'string')
    throw new TypeError('instPath is expected to be a string.');
  if (!(
    Array.isArray(packages) &&
    packages.every((p) => typeof p === 'object' && p !== null)
  ))
    throw new TypeError('packages is expected to be an array of objects.');
  return { instPath, packages: packages as Record<string, unknown>[] };
};

export const packagesRouter = t.router({
  getPackages: winInstProcedure
    .input(stringInput)
    .query(async ({ ctx }) => await getPackages(ctx, ctx.inst)),
  refreshList: winInstProcedure.input(stringInput).mutation(async ({ ctx }) => {
    await refreshPackagesList(ctx, ctx.inst);
  }),
  resolveInstallationStatus: winInstProcedure
    .input(stringInput)
    .query(async ({ ctx }) => await resolveInstallationStatus(ctx, ctx.inst)),
  getLedgerInstalledIds: instProcedure
    .input(installedIdsInput)
    .query(
      async ({ input, ctx }) =>
        await getLedgerInstalledIds(ctx.inst, input.ids),
    ),
  convertIds: winInstProcedure
    .input(convertIdsInput)
    .mutation(async ({ input, ctx }) => {
      await convertPackageIds(ctx, ctx.inst, input.modTime);
    }),
  getShareString: winInstProcedure
    .input(stringInput)
    .query(async ({ ctx }) => await buildShareString(ctx, ctx.inst)),
  getScriptsList: winProcedure
    .input(scriptsListInput)
    .query(async ({ input, ctx }) => await getScriptsList(ctx, input.update)),
  getPackagesWithStatus: winInstProcedure
    .input(packagesWithStatusInput)
    .query(async ({ input, ctx }) => {
      return await getPackagesWithStatus(
        ctx,
        ctx.inst,
        input.adoptManuallyInstalled,
      );
    }),
  installPackage: winInstProcedure
    .input(installPackageInput)
    .mutation(async ({ input, ctx }) => {
      return await installPackageFlow(
        ctx,
        ctx.inst,
        input.packageItem as Parameters<typeof installPackageFlow>[2],
        { direct: input.direct, archivePath: input.archivePath },
      );
    }),
  uninstallPackage: winInstProcedure
    .input(uninstallPackageInput)
    .mutation(async ({ input, ctx }) => {
      return await uninstallPackageFiles(
        ctx,
        ctx.inst,
        input.packageItem as Parameters<typeof uninstallPackageFiles>[2],
      );
    }),
  installScript: winInstProcedure
    .input(installScriptFlowInput)
    .mutation(async ({ input, ctx }) => {
      return await installScriptFlow(ctx, ctx.inst, input.url);
    }),
  getDates: procedure.query(({ ctx }) => getPackagesDates(ctx.config)),
  openPackageFolder: procedure
    .input(stringInput)
    .mutation(async ({ input }) => await openPackageFolder(input)),
  getEditorPackages: winInstProcedure
    .input(stringInput)
    .query(async ({ ctx }) => await getEditorPackages(ctx, ctx.inst)),
  setEditorPackages: instProcedure
    .input(editorPackagesInput)
    .mutation(async ({ input, ctx }) => {
      await setEditorPackages(
        ctx.inst,
        input.packages as Parameters<typeof setEditorPackages>[1],
      );
    }),
});
