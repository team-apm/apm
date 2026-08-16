import { initTRPC } from '@trpc/server';
import { app, BrowserWindow, dialog, type IpcMainInvokeEvent } from 'electron';
import type { CreateContextOptions } from 'electron-trpc/main';
import { getConfig } from '../lib/Config';
import { openAboutWindow } from './aboutWindow';
import { isExeVersion } from './services/appUpdate';
import {
  checkCoreLatestVersion,
  getCoreInfo,
  getInstalledVersionTexts,
  installCoreProgram,
} from './services/core';
import { updateInfo } from './services/modList';
import { downloadRepository, getPackages } from './services/packages';
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
    downloadRepository: procedure
      .input(stringInput)
      .mutation(async ({ input, ctx }) => {
        const win = BrowserWindow.fromWebContents(ctx.event.sender);
        if (!win) throw new Error('The calling window was not found.');
        await downloadRepository(win, getConfig(), input);
      }),
  }),
  core: t.router({
    getCoreInfo: procedure.query(async ({ ctx }) => {
      const win = BrowserWindow.fromWebContents(ctx.event.sender);
      if (!win) throw new Error('The calling window was not found.');
      return await getCoreInfo(win, getConfig());
    }),
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
