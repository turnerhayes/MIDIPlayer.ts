const path = require("path");
const webpack = require("webpack");

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "development";
}

module.exports = {
  entry: "./index.ts",
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  mode: process.env.NODE_ENV === "development" ?
    "development" :
    "production",
  module: {
    rules: [
      {
        test: /\.ts?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
  ]
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      "fs": "browserfs/dist/shims/fs.js",
      "buffer": "browserfs/dist/shims/buffer.js",
      "path": "browserfs/dist/shims/path.js",
      "processGlobal": "browserfs/dist/shims/process.js",
      "bufferGlobal": "browserfs/dist/shims/bufferGlobal.js",
      "bfsGlobal": require.resolve("browserfs"),
    },
  },
  plugins: [
    new webpack.ProvidePlugin({
      BrowserFS: 'bfsGlobal',
      process: 'processGlobal',
      Buffer: 'bufferGlobal'
    }),
  ]
};
