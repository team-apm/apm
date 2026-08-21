import { initTRPC } from '@trpc/server';
import { BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import type { CreateContextOptions } from 'trpc-electron/main';
import type Config from '../Config';
import { getConfig } from '../Config';

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

export const stringInput = (value: unknown): string => {
  if (typeof value !== 'string') throw new TypeError('A string is expected.');
  return value;
};
