import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig, type PluginOption } from 'vite';
import { devContentSecurityPolicy, monacoAssets } from './vite.plugins.config';

// 窓の名前 → ソースディレクトリ。root を窓ごとに移すことで、出力を
// `.vite/renderer/{name}/index.html` に平坦化する(main プロセスの
// loadFile がこの位置を前提にする)
const SOURCE_DIRS: Record<string, string> = {
  main_window: 'src/renderer/main',
  about_window: 'src/renderer/about',
  splash_window: 'src/renderer/splash',
};

// forgeConfigSelf は plugin-vite が ConfigEnv に足す拡張
// (src/types/forge-vite.d.ts の参照が型を持ち込む)
export default defineConfig(({ root: projectRoot, forgeConfigSelf }) => {
  const name = 'name' in forgeConfigSelf ? forgeConfigSelf.name : undefined;
  const sourceDir = name ? SOURCE_DIRS[name] : undefined;
  if (!name || !sourceDir) {
    throw new Error(`Unknown renderer entry point: ${String(name)}`);
  }

  // nodenext では config が CJS として解決され、plugin-react の CJS 側の
  // シグネチャは options が必須になる
  const plugins: PluginOption[] = [react({}), devContentSecurityPolicy()];
  if (name === 'main_window') plugins.push(monacoAssets(projectRoot));

  return {
    root: path.join(projectRoot, sourceDir),
    build: {
      // root の外へ出力するため、既定では空にしてくれない
      outDir: path.join(projectRoot, '.vite/renderer', name),
      emptyOutDir: true,
    },
    plugins,
    server: {
      fs: {
        // icon/apm1024.png のように root(窓ディレクトリ)の外を import する
        // ため、dev サーバの読み取り許可をリポジトリ全体へ広げる
        allow: [projectRoot],
      },
    },
  };
});
