const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const rules = require('./webpack.rules');
const plugins = require('./webpack.plugins');

rules.push({
  test: /\.html$/i,
  loader: 'html-loader',
});

rules.push({
  test: /\.css$/,
  use: [MiniCssExtractPlugin.loader, 'css-loader'],
});

plugins.push(new MiniCssExtractPlugin());

module.exports = {
  devtool: 'inline-source-map',
  module: {
    rules,
  },
  plugins: plugins,
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
  },
};
