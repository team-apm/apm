import { dialog } from 'electron';
import { ensureExtraDataUrl, setDataUrls } from '../services/settings';
import { procedure, stringInput, t, winProcedure } from './trpc';

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

export const settingsRouter = t.router({
  ensureExtraDataUrl: procedure.mutation(({ ctx }) =>
    ensureExtraDataUrl(ctx.config),
  ),
  setDataUrls: winProcedure
    .input(dataUrlsInput)
    .mutation(async ({ input, ctx }) => {
      return await setDataUrls(
        ctx.config,
        input.mainUrl,
        input.extraDataUrls,
        async (message) =>
          (
            await dialog.showMessageBox(ctx.win, {
              title: '確認',
              message,
              type: 'warning',
              buttons: ['続行', 'キャンセル'],
              cancelId: 1,
            })
          ).response === 0,
      );
    }),
  getDataUrls: procedure.query(({ ctx }) => {
    return {
      main: ctx.config.dataURL.getMain(),
      extra: ctx.config.dataURL.getExtra(),
    };
  }),
  getAutoUpdate: procedure.query(({ ctx }) => ctx.config.getAutoUpdate()),
  setAutoUpdate: procedure
    .input(autoUpdateInput)
    .mutation(({ input, ctx }) => ctx.config.setAutoUpdate(input)),
  getZoomFactor: procedure.query(({ ctx }) => ctx.config.getZoomFactor()),
  changeZoomFactor: procedure.input(stringInput).mutation(({ input, ctx }) => {
    ctx.config.setZoomFactor(input);
    ctx.event.sender.setZoomFactor(parseInt(input) / 100);
  }),
});
