import { defineConfig } from 'vite';
import { externalDependencies } from './vite.base.config';
import { assertExternals } from './vite.plugins.config';

// main プロセス。plugin-vite の既定が CJS + build.lib なので、
// 出力名だけ main.js に固定する(package.json の main と一致させる)
export default defineConfig({
  build: {
    lib: {
      entry: { main: 'src/main/index.ts' },
      fileName: () => '[name].js',
      formats: ['cjs'],
    },
    rollupOptions: {
      external: externalDependencies,
    },
  },
  plugins: [assertExternals(externalDependencies)],
});
