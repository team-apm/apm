import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import { globalIgnores } from "eslint/config";
import globals from "globals";
import * as tseslint from "typescript-eslint";

export default tseslint.config(
  globalIgnores(["node_modules/**/*", "out/**/*", ".webpack/**/*"]),
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    extends: [
      importPlugin.flatConfigs.recommended,
      importPlugin.flatConfigs.electron,
      importPlugin.flatConfigs.typescript,
    ],

    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },

      parserOptions: {
        projectService: {
          allowDefaultProject: [
            "eslint.config.mjs",
            "forge.config.ts",
            "webpack.*.ts",
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },

    settings: {
      "import/resolver": {
        typescript: {},
      },
    },
  },
);
