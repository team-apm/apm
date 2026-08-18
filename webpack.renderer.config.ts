import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import { BannerPlugin, type Configuration } from 'webpack';
import { plugins } from './webpack.plugins';
import { rules } from './webpack.rules';

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

// sandbox: true の preload には __dirname が無く、forge の webpack plugin が
// 全バンドル先頭に注入する asset relocator patch(`__dirname + "/native_modules/"`)
// が ReferenceError で preload 全体を殺すため、空文字のシムを先頭に足す
plugins.push(
  new BannerPlugin({
    banner: 'var __dirname = "";',
    raw: true,
    entryOnly: false,
  }),
);

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
