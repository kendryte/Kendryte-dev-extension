/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check

const path = require('path')

/**@type {import('webpack').Configuration}*/
const config = {
    target: 'node', // vscode插件运行在Node.js环境中 📖 -> https://webpack.js.org/configuration/node/

    entry: {
        extension: path.resolve(__dirname, 'src/extension.ts'), // 插件的入口文件 📖 -> https://webpack.js.org/configuration/entry-context/
        debugadapter: path.resolve(__dirname, 'src/debugadapter.ts')
    },
    output: {
        // 打包好的文件储存在'dist'文件夹中 (请参考package.json), 📖 -> https://webpack.js.org/configuration/output/
        path: path.resolve(__dirname, 'build'),
        filename: '[name].js',
        libraryTarget: 'commonjs2',
        devtoolModuleFilenameTemplate: '../[resource-path]'
    },
    node: {
        __dirname: true,
        __filename: true
    },
    devtool: 'source-map',
    externals: {
        "vscode": 'commonjs vscode', // vscode-module是热更新的临时目录，所以要排除掉。 在这里添加其他不应该被webpack打包的文件, 📖 -> https://webpack.js.org/configuration/externals/
        "serialport": true,
        "bindings": true,
        "debug": true,
        "ms": true,
        "file-uri-to-path": true,
        "7zip-bin": true,
        "7zip-bin-wrapper": true,
        "source-map-support": true,
        "split2": true,
        "iconv-lite": true,
        "buffer-from": true,
        "safer-buffer": true,
        "inherits": true,
        "util-deprecate": true
    },
    resolve: {
        // 支持读取TypeScript和JavaScript文件, 📖 -> https://github.com/TypeStrong/ts-loader
        extensions: ['.ts', '.js'],
        alias: {
            '@command': path.resolve(__dirname, 'src/command/'),
            '@common': path.resolve(__dirname, 'src/common'),
            '@utils': path.resolve(__dirname, 'src/utils/'),
            '@debug': path.resolve(__dirname, 'src/debug'),
            '@service': path.resolve(__dirname, 'src/service'),
            'typings': path.resolve(__dirname, 'node_modules/@types'),
        }
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'ts-loader'
                    }
                ]
            }
        ]
    }
};
module.exports = config;
