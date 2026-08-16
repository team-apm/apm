import { initTRPC } from '@trpc/server';
import { app, type IpcMainInvokeEvent } from 'electron';
import type { CreateContextOptions } from 'electron-trpc/main';
import { getConfig } from '../lib/Config';
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

export const router = t.router({
  getAppVersion: procedure.query(async () => {
    return app.getVersion();
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
    getZoomFactor: procedure.query(() => getConfig().getZoomFactor()),
    changeZoomFactor: procedure
      .input(stringInput)
      .mutation(({ input, ctx }) => {
        getConfig().setZoomFactor(input);
        ctx.event.sender.setZoomFactor(parseInt(input) / 100);
      }),
  }),
});

export type AppRouter = typeof router;
