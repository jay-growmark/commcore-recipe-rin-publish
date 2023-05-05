const path = require('path');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = {
  mode: "production",
  externals: ["aws-sdk"], //avoid un-needed modules since aws-sdk exists in aws lambdas already
  entry: {
    "logic": path.join(__dirname, "./src/logic.ts"),
    //... additional files could go here
  },
  module: {
    rules: [
      { test: /\.tsx?$/, loader: 'ts-loader', exclude: /node_modules/ },
      { test: /\.sql$/, use: 'raw-loader', exclude: /node_modules/ },
      { test: /\.hbs$/, use: 'raw-loader', exclude: /node_modules/ }
    ]
  },
  resolve: {
    extensions: [ '.ts', '.js' ],
    alias: { "@": path.resolve(__dirname, "src") }
  },
  target: 'node',
  output: {
      path: path.join(__dirname, "./out/"),
      filename: "[name].js",
      libraryTarget: 'umd'
  },
  plugins: [ new BundleAnalyzerPlugin({ analyzerMode: 'static', openAnalyzer: false }) ]
};