const path = require('path');
const webpack = require('webpack');
const VirtualModulesPlugin = require('webpack-virtual-modules');
const VirtualDirectoryPlugin = require('../index');

module.exports = {
  mode: 'development',
  entry: {
    index: './test/env/src/index.js'
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'public')
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        options: { presets: ['@babel/env'] }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  resolve: {
    extensions: ['*', '.js', '.jsx']
  },
  plugins: [
    new webpack.ProvidePlugin({
      React: 'react'
    }),
    new VirtualModulesPlugin({
      'test/env/src/assets/number-one.js': 'module.exports = 1'
    }),
    new VirtualDirectoryPlugin({
      'test/env/src/module/product': path.resolve(__dirname, 'env/module/product')
    })
  ]
};
