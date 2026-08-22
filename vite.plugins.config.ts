import { createReadStream } from 'node:fs';
import { cp, stat } from 'node:fs/promises';
import { builtinModules } from 'node:module';
import path from 'node:path';
import type { Plugin } from 'vite';

const MONACO_VS = 'node_modules/monaco-editor/min/vs';

const BUILTINS = new Set([
  'electron',
  'electron/main',
  'electron/common',
  'electron/renderer',
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
]);

/**
 * Fails the build when the bundle keeps an unexpected bare dependency.
 *
 * バンドルから外れた依存は node_modules から実行時 require される。同梱の
 * 一覧(forge.config.ts の packagedPaths)に無いとパッケージ版だけが
 * MODULE_NOT_FOUND で落ち、しかも Electron が main のロード例外をダイアログに
 * 出すため stderr には何も出ず「窓が開かない」としか見えない。webpack の
 * asset relocator が自動でやっていた解決を人手の一覧で代替する以上、
 * 食い違いはビルド時に落とす。
 * @param {string[]} allowed - Dependencies that are intentionally external.
 * @returns {Plugin} The Vite plugin.
 */
export function assertExternals(allowed: string[]): Plugin {
  return {
    name: 'apm:assert-externals',
    generateBundle(_options, bundle) {
      const unexpected = new Set<string>();
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        for (const id of [...output.imports, ...output.dynamicImports]) {
          // 内部チャンクは出力ファイル名で現れる
          if (id in bundle) continue;
          if (BUILTINS.has(id)) continue;
          if (allowed.some((name) => id === name || id.startsWith(`${name}/`)))
            continue;
          unexpected.add(id);
        }
      }
      if (unexpected.size > 0) {
        throw new Error(
          `バンドルされなかった依存があります: ${[...unexpected].sort().join(', ')}\n` +
            'バンドルできるよう静的 import に直すか、vite.base.config.ts の ' +
            'assetBearingDependencies に足してパッケージへ同梱すること。',
        );
      }
    },
  };
}

// JSON エディタに不要な言語サービス・UI 翻訳は同梱しない(-8MB 超)。
// JSON のハイライトは basic-languages ではなく language/json が持つ
const MONACO_EXCLUDED = [
  'language/css',
  'language/html',
  'language/typescript',
  'basic-languages',
];

/**
 * Returns whether the given path under `vs` should be bundled.
 * @param {string} relative - Path relative to the `vs` directory.
 * @returns {boolean} True when the file should be copied.
 */
function isMonacoAssetIncluded(relative: string): boolean {
  const normalized = relative.split(path.sep).join('/');
  if (/(^|\/)nls\.messages\..*\.js$/.test(normalized)) return false;
  return !MONACO_EXCLUDED.some(
    (dir) => normalized === dir || normalized.startsWith(`${dir}/`),
  );
}

/**
 * Bundles the Monaco AMD build as a static asset under `vs/`.
 *
 * 値インポートするとビルドにヒープ拡大が必要になるため、Monaco は Vite の
 * 依存解決に載せず AMD ビルドを丸ごと同梱し、@monaco-editor/loader の
 * 読み込み先をそこへ向ける(CDN 許可を CSP から外すため)。
 * vite-plugin-static-copy を使わないのは、コピー元の相対ディレクトリ構造を
 * 出力先にも保つ仕様で、node_modules/... の階層ごと出力されてしまうため。
 * @param {string} projectRoot - The repository root.
 * @returns {Plugin} The Vite plugin.
 */
export function monacoAssets(projectRoot: string): Plugin {
  const source = path.join(projectRoot, MONACO_VS);
  let outDir = '';

  return {
    name: 'apm:monaco-assets',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    configureServer(server) {
      // 製品版では index.html と同じ階層の vs/ を読むため、dev サーバでも
      // 同じ URL(/vs)で引けるようにする
      server.middlewares.use('/vs', (req, res, next) => {
        const relative = decodeURIComponent((req.url ?? '/').split('?')[0]);
        const filePath = path.join(source, relative);
        if (!filePath.startsWith(source + path.sep)) return next();
        void stat(filePath).then(
          (stats) => {
            if (!stats.isFile()) return next();
            if (filePath.endsWith('.js'))
              res.setHeader('Content-Type', 'text/javascript');
            if (filePath.endsWith('.css'))
              res.setHeader('Content-Type', 'text/css');
            createReadStream(filePath).pipe(res);
          },
          () => next(),
        );
      });
    },
    async writeBundle() {
      await cp(source, path.join(outDir, 'vs'), {
        recursive: true,
        filter: (src) => {
          const relative = path.relative(source, src);
          return relative === '' || isMonacoAssetIncluded(relative);
        },
      });
    },
  };
}

/**
 * Relaxes the index.html CSP for the dev server only.
 *
 * 製品版の CSP は index.html の meta が単一ソースで、`script-src-elem 'self'`
 * を保つ。一方 dev では Vite client と React Fast Refresh のプリアンブルが
 * インライン module script として注入されるため、serve のときだけ meta を
 * 書き換えて通す(webpack 構成の devContentSecurityPolicy と同じ役回り。
 * 出力ファイルには一切影響しない)。
 * @returns {Plugin} The Vite plugin.
 */
export function devContentSecurityPolicy(): Plugin {
  return {
    name: 'apm:dev-csp',
    apply: 'serve',
    transformIndexHtml(html) {
      return html.replace(
        /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")([^"]*)(")/,
        (_match, before: string, policy: string, after: string) =>
          before +
          policy
            .replace(
              "script-src-elem 'self'",
              "script-src-elem 'self' 'unsafe-inline'",
            )
            .replace(
              "default-src 'self'",
              "default-src 'self' ws: http://localhost:*",
            ) +
          after,
      );
    },
  };
}
