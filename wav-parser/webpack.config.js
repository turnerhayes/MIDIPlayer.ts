const path = require("path");
const webpack = require("webpack");

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "development";
}

module.exports = {
  entry: "./wav-parser.ts",
  output: {
    filename: "wav-parser.js",
    path: path.resolve(__dirname, "dist"),
    library: "WAVParser",
    libraryTarget: "umd",
  },
  mode: process.env.NODE_ENV === "development" ?
    "development" :
    "production",
  module: {
    rules: [
      {
        test: /\.ts?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  plugins: [
    new webpack.EnvironmentPlugin([ "NODE_ENV" ]),
  ],

  devtool: "source-map",
};
