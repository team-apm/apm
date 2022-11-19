import type {
  Compilation,
  Configuration,
  WebpackPluginInstance,
} from 'webpack';
import type IForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import ESLintPlugin from 'eslint-webpack-plugin';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ForkTsCheckerWebpackPlugin: typeof IForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const relocateLoader: {
  initAssetCache: (compilation: Compilation, outputAssetBase: string) => void;
} = require('@vercel/webpack-asset-relocator-loader');

const AssetRelocatorPlugin: WebpackPluginInstance = {
  apply(compiler) {
    compiler.hooks.compilation.tap(
      'webpack-asset-relocator-loader',
      (compilation) => {
        relocateLoader.initAssetCache(compilation, 'native_modules');
      }
    );
  },
};

export const plugins: Required<Configuration>['plugins'] = [
  new ForkTsCheckerWebpackPlugin({
    logger: 'webpack-infrastructure',
  }),
  AssetRelocatorPlugin,
  new ESLintPlugin(),
];
