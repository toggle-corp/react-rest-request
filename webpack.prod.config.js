const path = require('path');

const CircularDependencyPlugin = require('circular-dependency-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');
// const UglifyJsPlugin = require('uglifyjs-webpack-plugin');

const appBase = process.cwd();
const appSrc = path.resolve(appBase, 'src/');
const appDist = path.resolve(appBase, 'build/');
const appIndexJs = path.resolve(appSrc, 'index.ts');

module.exports = {
    entry: appIndexJs,
    output: {
        path: appDist,
        publicPath: '/',
        filename: 'index.js',
        library: 'react-rest-request',
        libraryTarget: 'umd',
    },
    mode: 'production',
    performance: {
        hints: 'warning',
    },
    stats: {
        assets: true,
        colors: true,
        errors: true,
        errorDetails: true,
        hash: true,
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },

    devtool: 'source-map',

    /*
    optimization: {
        minimizer: [
            new UglifyJsPlugin({
                sourceMap: true,
                parallel: true,
                uglifyOptions: {
                    mangle: true,
                    compress: { typeofs: false },
                },
            }),
        ],
        splitChunks: {
            cacheGroups: {
                vendors: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'vendors',
                    chunks: 'all',
                },
            },
        },
        runtimeChunk: true,
    },
    */

    module: {
        rules: [
            {
                test: /\.tsx?$/,
                include: appSrc,
                use: [
                    'ts-loader',
                ],
            },
        ],
    },
    plugins: [
        new CircularDependencyPlugin({
            exclude: /node_modules/,
            failOnError: false,
            allowAsyncCycles: false,
            cwd: appBase,
        }),
        new CleanWebpackPlugin([appDist], { root: appBase }),
    ],
};
