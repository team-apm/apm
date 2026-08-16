import type { Configuration } from 'webpack';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';

import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins';

rules.push({
  test: /\.html$/i,
  loader: 'html-loader',
});

rules.push({
  test: /\.css$/,
  use: [MiniCssExtractPlugin.loader, 'css-loader'],
});

rules.push({
  test: /\.(svg|png|jpg|gif)$/,
  type: 'asset/inline',
});

plugins.push(new MiniCssExtractPlugin());

export const rendererConfig: Configuration = {
  // 本番ビルドに inline source map を含めない(バンドル肥大 + ソース露出防止)。
  // 別ファイルの .map は electron-log / source-map-support のスタックトレース解決に使われる
  devtool:
    process.env.NODE_ENV === 'development' ? 'inline-source-map' : 'source-map',
  module: {
    rules,
  },
  plugins,
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
  },
};
