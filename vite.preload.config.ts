import path from 'node:path';
import { defineConfig } from 'vite';
import { assertExternals } from './vite.plugins.config';

/**
 * Derives a unique output name from the preload entry path.
 * main 窓と about 窓の preload はどちらも `preload.ts` で、plugin-vite の既定
 * (`entryFileNames: '[name].js'`)だと同じ `.vite/build/preload.js` に出力されて
 * 後勝ちで上書きされる(outDir は build 対象で共有され emptyOutDir も false)。
 * 親ディレクトリ名を冠して `main_preload.js` / `about_preload.js` に分ける。
 * @param {string} entry - The preload entry path.
 * @returns {string} The output name without extension.
 */
function outputName(entry: string): string {
  return `${path.basename(path.dirname(entry))}_preload`;
}

// forgeConfigSelf は plugin-vite が ConfigEnv に足す拡張
// (src/types/forge-vite.d.ts の参照が型を持ち込む)
export default defineConfig(({ forgeConfigSelf }) => {
  const entry = 'entry' in forgeConfigSelf ? forgeConfigSelf.entry : undefined;
  if (typeof entry !== 'string') {
    throw new Error('forgeConfigSelf.entry must be a path for preload builds');
  }

  return {
    build: {
      rollupOptions: {
        input: { [outputName(entry)]: entry },
      },
    },
    // sandbox: true の preload に require は無いため、外部参照が残ると
    // preload 全体が動かない(main 以上に静かに壊れる)
    plugins: [assertExternals([])],
  };
});
