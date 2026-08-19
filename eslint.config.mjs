import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import jsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';
import { config, configs as tseslintConfigs } from 'typescript-eslint';

export default config(
  { ignores: ['node_modules/**', 'out/**', '.webpack/**'] },
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
    },
  },
);
