const path = require("path");

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "development";
}

module.exports = {
  entry: "./src/index.ts",
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
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
  ]
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
};
