const path = require('path');

const appBase = process.cwd();

module.exports = {
    entry: './src/index.js',
    output: {
        path: path.resolve(appBase, 'build'),
        filename: 'index.js',
        library: 'reactRestRequest',
        libraryTarget: 'umd',
    },
    mode: 'production',
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                },
            },
        ],
    },
};
