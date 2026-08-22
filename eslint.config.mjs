import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import jsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';
import { config, configs as tseslintConfigs } from 'typescript-eslint';

// monaco-editor を値インポートするとバンドラが Monaco 全体を取り込み、
// ビルドにヒープ拡大が必要になる。実行時は vite.plugins.config.ts の
// monacoAssets が同梱する AMD ビルドを @monaco-editor/loader が読み込む
// (CSP が CDN を許可しないため)
const monacoTypeOnlyImport = {
  name: 'monaco-editor',
  allowTypeImports: true,
  message:
    'monaco-editor は型のみインポート可(実行時は同梱 AMD ビルドを loader が読み込む)。enum 値は onMount で渡される monaco インスタンスから取る。',
};

export default config(
  // .claude/worktrees は Claude Code の並行セッション用 worktree(git 管理外)
  {
    ignores: ['node_modules/**', 'out/**', '.vite/**', '.claude/worktrees/**'],
  },
  eslint.configs.recommended,
  jsdoc.configs['flat/recommended'],
  tseslintConfigs.recommended,
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.electron,
  importPlugin.flatConfigs.typescript,
  prettier,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'prefer-arrow-callback': 'error',
      // 旧 no-var-requires off の引き継ぎ(typescript-eslint 8 でルール名変更)
      '@typescript-eslint/no-require-imports': 'off',
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: 'node_modules',
        },
      },
    },
  },
  {
    // type-aware ルールは tsconfig に含まれる TS ファイルだけに適用する
    // (この設定ファイル自身などが parserOptions.project のエラーになるため)
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: 'tsconfig.json',
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { paths: [monacoTypeOnlyImport] },
      ],
    },
  },
  {
    // renderer のビルドには Node ポリフィルが無く、fs が混入すると
    // ビルドが落ちる。直接 import はここで検出する(shared モジュール経由の
    // 推移的依存までは検出できない — その場合はビルド失敗が検出線)
    files: ['src/renderer/**/*.ts', 'src/renderer/**/*.tsx', 'src/lib/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            monacoTypeOnlyImport,
            ...['fs', 'node:fs', 'fs-extra', 'original-fs'].map((name) => ({
              name,
              message:
                'renderer のビルドには Node ポリフィルが無いため fs は import 不可。表示用の定数・純関数は src/shared/packageDisplay.ts のように fs 非依存モジュールへ分離する。',
            })),
          ],
          patterns: [
            {
              group: ['fs/*', 'node:fs/*'],
              message:
                'renderer のビルドには Node ポリフィルが無いため fs は import 不可。',
            },
          ],
        },
      ],
    },
  },
);
