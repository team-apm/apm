import {
  isHttpUrl,
  isSafeRelativePath,
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

const packageStateInput = (
  value: unknown,
): { id: string; info: Record<string, unknown> } => {
  if (typeof value !== 'object' || value === null)
    throw new TypeError('An object is expected.');
  const { id, info } = value as Record<string, unknown>;
  if (typeof id !== 'string' || typeof info !== 'object' || info === null)
    throw new TypeError('id is expected to be a string and info an object.');
  // id は展開先フォルダ名になるため、files[].filename と同じ関門を通す
  if (!isSafeRelativePath(id))
    throw new TypeError('id is expected to be a safe relative path.');
  // renderer は非信頼。パス・コマンド・URL に到達するフィールドはここで検証する
  return { id, info: validatePackageInfo(info) };
};

const installPackageInput = (
  value: unknown,
): {
  installationPath: string;
  packageState: { id: string; info: Record<string, unknown> };
  direct: boolean;
  archivePath?: string;
} => {
  if (typeof value !== 'object' || value === null)
    throw new TypeError('An object is expected.');
  const { installationPath, packageState, direct, archivePath } =
    value as Record<string, unknown>;
  if (typeof installationPath !== 'string')
    throw new TypeError('installationPath is expected to be a string.');
  if (typeof direct !== 'boolean')
    throw new TypeError('direct is expected to be a boolean.');
  if (archivePath !== undefined && typeof archivePath !== 'string')
    throw new TypeError('archivePath is expected to be a string.');
  return {
    installationPath,
    packageState: packageStateInput(packageState),
    direct,
    archivePath: archivePath as string | undefined,
  };
};

const uninstallPackageInput = (
  value: unknown,
): {
  installationPath: string;
  packageState: { id: string; info: Record<string, unknown> };
} => {
  if (typeof value !== 'object' || value === null)
    throw new TypeError('An object is expected.');
  const { installationPath, packageState } = value as Record<string, unknown>;
  if (typeof installationPath !== 'string')
    throw new TypeError('installationPath is expected to be a string.');
  return { installationPath, packageState: packageStateInput(packageState) };
};

const installScriptFlowInput = (
  value: unknown,
): { installationPath: string; url: string } => {
  if (typeof value !== 'object' || value === null)
    throw new TypeError('An object is expected.');
  const { installationPath, url } = value as Record<string, unknown>;
  if (typeof installationPath !== 'string' || typeof url !== 'string')
    throw new TypeError('installationPath and url are expected to be strings.');
  // ブラウザ窓で開く URL なので http(s) 以外(file: 等)を通さない
  if (!isHttpUrl(url))
    throw new TypeError('url is expected to be a http(s) URL.');
  return { installationPath, url };
};

const convertIdsInput = (
  value: unknown,
): { installationPath: string; modTime: number } => {
  if (typeof value !== 'object' || value === null)
    throw new TypeError('An object is expected.');
  const { installationPath, modTime } = value as Record<string, unknown>;
  if (typeof installationPath !== 'string' || typeof modTime !== 'number')
    throw new TypeError(
      'installationPath is expected to be a string and modTime a number.',
    );
  return { installationPath, modTime };
};

const installedIdsInput = (
  value: unknown,
): { installationPath: string; ids: string[] } => {
  if (typeof value !== 'object' || value === null)
    throw new TypeError('An object is expected.');
  const { installationPath, ids } = value as Record<string, unknown>;
  if (typeof installationPath !== 'string')
    throw new TypeError('installationPath is expected to be a string.');
  if (!(Array.isArray(ids) && ids.every((id) => typeof id === 'string')))
    throw new TypeError('ids is expected to be an array of strings.');
  return { installationPath, ids: ids as string[] };
};

const packagesWithStatusInput = (
  value: unknown,
): { installationPath: string; adoptManuallyInstalled: boolean } => {
  if (typeof value !== 'object' || value === null)
    throw new TypeError('An object is expected.');
  const { installationPath, adoptManuallyInstalled } = value as Record<
    string,
    unknown
  >;
  if (
    typeof installationPath !== 'string' ||
    typeof adoptManuallyInstalled !== 'boolean'
  )
    throw new TypeError(
      'installationPath is expected to be a string and adoptManuallyInstalled a boolean.',
    );
  return { installationPath, adoptManuallyInstalled };
};

const editorPackagesInput = (
  value: unknown,
): { installationPath: string; packages: Record<string, unknown>[] } => {
  if (typeof value !== 'object' || value === null)
    throw new TypeError('An object is expected.');
  const { installationPath, packages } = value as Record<string, unknown>;
  if (typeof installationPath !== 'string')
    throw new TypeError('installationPath is expected to be a string.');
  if (!(
    Array.isArray(packages) &&
    packages.every((p) => typeof p === 'object' && p !== null)
  ))
    throw new TypeError('packages is expected to be an array of objects.');
  return { installationPath, packages: packages as Record<string, unknown>[] };
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
        input.packageState as Parameters<typeof installPackageFlow>[2],
        { direct: input.direct, archivePath: input.archivePath },
      );
    }),
  uninstallPackage: winInstProcedure
    .input(uninstallPackageInput)
    .mutation(async ({ input, ctx }) => {
      return await uninstallPackageFiles(
        ctx,
        ctx.inst,
        input.packageState as Parameters<typeof uninstallPackageFiles>[2],
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
