import { initTRPC } from '@trpc/server';
import { app, BrowserWindow, dialog, type IpcMainInvokeEvent } from 'electron';
import type { CreateContextOptions } from 'electron-trpc/main';
import { getConfig } from '../lib/Config';
import { openAboutWindow } from './aboutWindow';
import { isExeVersion } from './services/appUpdate';
import {
  changeInstallationPath,
  checkCoreLatestVersion,
  getApmJsonCoreVersions,
  getCoreInfo,
  getInstalledVersionTexts,
  hasExeditInPluginsFolder,
  installCoreProgram,
} from './services/core';
import { migrationByFolder, migrationGlobal } from './services/migration';
import { updateInfo } from './services/modList';
import { getNicommonsData } from './services/nicommons';
import {
  buildShareString,
  convertPackageIds,
  getApmJsonInstalledIds,
  getEditorPackages,
  getPackages,
  getPackagesExtra,
  getPackagesWithStatus,
  getScriptsList,
  installPackageFlow,
  installScriptFlow,
  refreshPackagesList,
  setEditorPackages,
  uninstallPackageFiles,
} from './services/packages';
import { ensureExtraDataUrl, setDataUrls } from './services/settings';

export type Context = {
  event: IpcMainInvokeEvent;
};

/**
 * Creates the tRPC context for each request.
 * @param {CreateContextOptions} opts - The options containing the IPC event.
 * @returns {Promise<Context>} The context.
 */
export async function createContext({
  event,
}: CreateContextOptions): Promise<Context> {
  return { event };
}

const t = initTRPC.context<Context>().create({ isServer: true });
const procedure = t.procedure;

const stringInput = (value: unknown): string => {
  if (typeof value !== 'string') throw new TypeError('A string is expected.');
  return value;
};

// electron-trpc は falsy なトップレベル入力(false / 0 / '')を undefined に
// 変換してしまうため、boolean はオブジェクトで包んで受け取る
const scriptsListInput = (value: unknown): { update: boolean } => {
  if (typeof value !== 'object' || value === null)
    throw new TypeError('An object is expected.');
  const { update } = value as Record<string, unknown>;
  if (typeof update !== 'boolean')
    throw new TypeError('update is expected to be a boolean.');
  return { update };
};

const dataUrlsInput = (
  value: unknown,
): { mainUrl: string; extraDataUrls: string } => {
  if (typeof value !== 'object' || value === null)
    throw new TypeError('An object is expected.');
  const { mainUrl, extraDataUrls } = value as Record<string, unknown>;
  if (typeof mainUrl !== 'string' || typeof extraDataUrls !== 'string')
    throw new TypeError(
      'mainUrl and extraDataUrls are expected to be strings.',
    );
  return { mainUrl, extraDataUrls };
};

const AUTO_UPDATE_VALUES = ['download', 'notify', 'disable'] as const;
const autoUpdateInput = (value: unknown): 'download' | 'notify' | 'disable' => {
  if (
    typeof value !== 'string' ||
    !(AUTO_UPDATE_VALUES as readonly string[]).includes(value)
  )
    throw new TypeError('One of download, notify, or disable is expected.');
  return value as 'download' | 'notify' | 'disable';
};

const packageItemInput = (
  value: unknown,
): { id: string; info: Record<string, unknown> } => {
  if (typeof value !== 'object' || value === null)
    throw new TypeError('An object is expected.');
  const { id, info } = value as Record<string, unknown>;
  if (typeof id !== 'string' || typeof info !== 'object' || info === null)
    throw new TypeError('id is expected to be a string and info an object.');
  return { id, info: info as Record<string, unknown> };
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
): { instPath: string; fixIntegrity: boolean } => {
  if (typeof value !== 'object' || value === null)
    throw new TypeError('An object is expected.');
  const { instPath, fixIntegrity } = value as Record<string, unknown>;
  if (typeof instPath !== 'string' || typeof fixIntegrity !== 'boolean')
    throw new TypeError(
      'instPath is expected to be a string and fixIntegrity a boolean.',
    );
  return { instPath, fixIntegrity };
};

const editorPackagesInput = (
  value: unknown,
): { instPath: string; packages: Record<string, unknown>[] } => {
  if (typeof value !== 'object' || value === null)
    throw new TypeError('An object is expected.');
  const { instPath, packages } = value as Record<string, unknown>;
  if (typeof instPath !== 'string')
    throw new TypeError('instPath is expected to be a string.');
  if (
    !(
      Array.isArray(packages) &&
      packages.every((p) => typeof p === 'object' && p !== null)
    )
  )
    throw new TypeError('packages is expected to be an array of objects.');
  return { instPath, packages: packages as Record<string, unknown>[] };
};

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

const DIALOG_TYPES = ['none', 'info', 'error', 'question', 'warning'] as const;
const dialogInput = (
  value: unknown,
): { title: string; message: string; type: (typeof DIALOG_TYPES)[number] } => {
  if (typeof value !== 'object' || value === null)
    throw new TypeError('An object is expected.');
  const { title, message, type } = value as Record<string, unknown>;
  if (
    typeof title !== 'string' ||
    typeof message !== 'string' ||
    typeof type !== 'string' ||
    !(DIALOG_TYPES as readonly string[]).includes(type)
  )
    throw new TypeError('title, message, and a valid type are expected.');
  return { title, message, type: type as (typeof DIALOG_TYPES)[number] };
};

export const router = t.router({
  getAppVersion: procedure.query(async () => {
    return app.getVersion();
  }),
  isExeVersion: procedure.query(() => isExeVersion()),
  getAppName: procedure.query(() => app.getName()),
  quitApp: procedure.mutation(() => {
    app.quit();
  }),
  openAboutWindow: procedure.mutation(() => {
    openAboutWindow();
  }),
  openDialog: procedure.input(dialogInput).mutation(async ({ input }) => {
    await dialog.showMessageBox({
      title: input.title,
      message: input.message,
      type: input.type,
    });
  }),
  settings: t.router({
    ensureExtraDataUrl: procedure.mutation(() =>
      ensureExtraDataUrl(getConfig()),
    ),
    setDataUrls: procedure
      .input(dataUrlsInput)
      .mutation(({ input }) =>
        setDataUrls(getConfig(), input.mainUrl, input.extraDataUrls),
      ),
    getDataUrls: procedure.query(() => {
      const config = getConfig();
      return {
        main: config.dataURL.getMain(),
        extra: config.dataURL.getExtra(),
      };
    }),
    getAutoUpdate: procedure.query(() => getConfig().getAutoUpdate()),
    setAutoUpdate: procedure
      .input(autoUpdateInput)
      .mutation(({ input }) => getConfig().setAutoUpdate(input)),
    getZoomFactor: procedure.query(() => getConfig().getZoomFactor()),
    changeZoomFactor: procedure
      .input(stringInput)
      .mutation(({ input, ctx }) => {
        getConfig().setZoomFactor(input);
        ctx.event.sender.setZoomFactor(parseInt(input) / 100);
      }),
  }),
  modList: t.router({
    updateInfo: procedure.mutation(async ({ ctx }) => {
      const win = BrowserWindow.fromWebContents(ctx.event.sender);
      if (!win) throw new Error('The calling window was not found.');
      await updateInfo(win, getConfig());
    }),
  }),
  packages: t.router({
    getPackages: procedure.input(stringInput).query(async ({ input, ctx }) => {
      const win = BrowserWindow.fromWebContents(ctx.event.sender);
      if (!win) throw new Error('The calling window was not found.');
      return await getPackages(win, getConfig(), input);
    }),
    refreshList: procedure
      .input(stringInput)
      .mutation(async ({ input, ctx }) => {
        const win = BrowserWindow.fromWebContents(ctx.event.sender);
        if (!win) throw new Error('The calling window was not found.');
        await refreshPackagesList(win, getConfig(), input);
      }),
    getPackagesExtra: procedure
      .input(stringInput)
      .query(async ({ input, ctx }) => {
        const win = BrowserWindow.fromWebContents(ctx.event.sender);
        if (!win) throw new Error('The calling window was not found.');
        return await getPackagesExtra(win, getConfig(), input);
      }),
    getApmJsonInstalledIds: procedure
      .input(installedIdsInput)
      .query(
        async ({ input }) =>
          await getApmJsonInstalledIds(input.instPath, input.ids),
      ),
    convertIds: procedure
      .input(convertIdsInput)
      .mutation(async ({ input, ctx }) => {
        const win = BrowserWindow.fromWebContents(ctx.event.sender);
        if (!win) throw new Error('The calling window was not found.');
        await convertPackageIds(
          win,
          getConfig(),
          input.instPath,
          input.modTime,
        );
      }),
    getShareString: procedure
      .input(stringInput)
      .query(async ({ input, ctx }) => {
        const win = BrowserWindow.fromWebContents(ctx.event.sender);
        if (!win) throw new Error('The calling window was not found.');
        return await buildShareString(win, getConfig(), input);
      }),
    getScriptsList: procedure
      .input(scriptsListInput)
      .query(async ({ input, ctx }) => {
        const win = BrowserWindow.fromWebContents(ctx.event.sender);
        if (!win) throw new Error('The calling window was not found.');
        return await getScriptsList(win, getConfig(), input.update);
      }),
    getPackagesWithStatus: procedure
      .input(packagesWithStatusInput)
      .query(async ({ input, ctx }) => {
        const win = BrowserWindow.fromWebContents(ctx.event.sender);
        if (!win) throw new Error('The calling window was not found.');
        return await getPackagesWithStatus(
          win,
          getConfig(),
          input.instPath,
          input.fixIntegrity,
        );
      }),
    installPackage: procedure
      .input(installPackageInput)
      .mutation(async ({ input, ctx }) => {
        const win = BrowserWindow.fromWebContents(ctx.event.sender);
        if (!win) throw new Error('The calling window was not found.');
        return await installPackageFlow(
          win,
          getConfig(),
          input.instPath,
          input.packageItem as Parameters<typeof installPackageFlow>[3],
          { direct: input.direct, archivePath: input.archivePath },
        );
      }),
    uninstallPackage: procedure
      .input(uninstallPackageInput)
      .mutation(async ({ input, ctx }) => {
        const win = BrowserWindow.fromWebContents(ctx.event.sender);
        if (!win) throw new Error('The calling window was not found.');
        return await uninstallPackageFiles(
          win,
          getConfig(),
          input.instPath,
          input.packageItem as Parameters<typeof uninstallPackageFiles>[3],
        );
      }),
    installScript: procedure
      .input(installScriptFlowInput)
      .mutation(async ({ input, ctx }) => {
        const win = BrowserWindow.fromWebContents(ctx.event.sender);
        if (!win) throw new Error('The calling window was not found.');
        return await installScriptFlow(
          win,
          getConfig(),
          input.instPath,
          input.url,
        );
      }),
    getEditorPackages: procedure
      .input(stringInput)
      .query(async ({ input, ctx }) => {
        const win = BrowserWindow.fromWebContents(ctx.event.sender);
        if (!win) throw new Error('The calling window was not found.');
        return await getEditorPackages(win, getConfig(), input);
      }),
    setEditorPackages: procedure
      .input(editorPackagesInput)
      .mutation(async ({ input }) => {
        await setEditorPackages(
          input.instPath,
          input.packages as Parameters<typeof setEditorPackages>[1],
        );
      }),
  }),
  nicommons: t.router({
    getData: procedure
      .input(stringInput)
      .query(async ({ input }) => await getNicommonsData(input)),
  }),
  migration: t.router({
    global: procedure.mutation(async ({ ctx }) => {
      const win = BrowserWindow.fromWebContents(ctx.event.sender);
      if (!win) throw new Error('The calling window was not found.');
      // 戻り値 false は起動中止(キャンセル)。electron-trpc の falsy 変換は
      // 入力側のみで出力側は安全なため boolean をそのまま返す
      return await migrationGlobal(win, getConfig());
    }),
    byFolder: procedure.input(stringInput).mutation(async ({ input, ctx }) => {
      const win = BrowserWindow.fromWebContents(ctx.event.sender);
      if (!win) throw new Error('The calling window was not found.');
      await migrationByFolder(win, getConfig(), input);
    }),
  }),
  core: t.router({
    getCoreInfo: procedure.query(async ({ ctx }) => {
      const win = BrowserWindow.fromWebContents(ctx.event.sender);
      if (!win) throw new Error('The calling window was not found.');
      return await getCoreInfo(win, getConfig());
    }),
    hasExeditInPluginsFolder: procedure
      .input(stringInput)
      .query(({ input }) => hasExeditInPluginsFolder(input)),
    changeInstallationPath: procedure
      .input(stringInput)
      .mutation(async ({ input, ctx }) => {
        const win = BrowserWindow.fromWebContents(ctx.event.sender);
        if (!win) throw new Error('The calling window was not found.');
        return await changeInstallationPath(win, getConfig(), input);
      }),
    getApmJsonCoreVersions: procedure
      .input(stringInput)
      .query(async ({ input }) => await getApmJsonCoreVersions(input)),
    getInstalledVersionTexts: procedure
      .input(stringInput)
      .query(async ({ input, ctx }) => {
        const win = BrowserWindow.fromWebContents(ctx.event.sender);
        if (!win) throw new Error('The calling window was not found.');
        return await getInstalledVersionTexts(win, getConfig(), input);
      }),
    checkLatestVersion: procedure.mutation(async ({ ctx }) => {
      const win = BrowserWindow.fromWebContents(ctx.event.sender);
      if (!win) throw new Error('The calling window was not found.');
      await checkCoreLatestVersion(win, getConfig());
    }),
    installProgram: procedure
      .input(installProgramInput)
      .mutation(async ({ input, ctx }) => {
        const win = BrowserWindow.fromWebContents(ctx.event.sender);
        if (!win) throw new Error('The calling window was not found.');
        return await installCoreProgram(
          win,
          getConfig(),
          input.program,
          input.version,
          input.instPath,
        );
      }),
  }),
});

export type AppRouter = typeof router;
