import { initTRPC } from '@trpc/server';
import { BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import type { CreateContextOptions } from 'trpc-electron/main';
import type Config from '../Config';
import { getConfig } from '../Config';
import { openInstallation } from '../installation';

export type Context = {
  event: IpcMainInvokeEvent;
  config: Config;
};

/**
 * Creates the tRPC context for each request.
 * @param {CreateContextOptions} opts - The options containing the IPC event.
 * @returns {Promise<Context>} The context.
 */
export async function createContext({
  event,
}: CreateContextOptions): Promise<Context> {
  return { event, config: getConfig() };
}

export const t = initTRPC.context<Context>().create({ isServer: true });

export const procedure = t.procedure;

// 呼び出し元ウィンドウをダイアログ・進捗表示の親として使う procedure。
// 窓が閉じられた直後などで解決できない場合はエラーにする(定型 19 箇所の集約)
export const winProcedure = procedure.use(({ ctx, next }) => {
  const win = BrowserWindow.fromWebContents(ctx.event.sender);
  if (!win) throw new Error('The calling window was not found.');
  return next({ ctx: { win } });
});

// 入力(installationPath 文字列そのもの、または installationPath フィールドを持つ
// オブジェクト)から Installation を解決して ctx に載せる。installationPath の
// 文字列貫通を tRPC 境界で止め、procedure には Installation を渡す
const installationMiddleware = t.middleware(async ({ getRawInput, next }) => {
  const raw = await getRawInput();
  const installationPath =
    typeof raw === 'string'
      ? raw
      : typeof (raw as { installationPath?: unknown } | null | undefined)
            ?.installationPath === 'string'
        ? (raw as { installationPath: string }).installationPath
        : null;
  if (installationPath === null)
    throw new TypeError('installationPath is expected to be a string.');
  return next({ ctx: { inst: openInstallation(installationPath) } });
});

export const instProcedure = procedure.use(installationMiddleware);

export const winInstProcedure = winProcedure.use(installationMiddleware);

export const stringInput = (value: unknown): string => {
  if (typeof value !== 'string') throw new TypeError('A string is expected.');
  return value;
};
