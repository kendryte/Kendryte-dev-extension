# Kendryte Dev Tool for Visual Studio Code

[![License](https://img.shields.io/badge/license-Apache%202-blue)](https://raw.githubusercontent.com/kendryte/Kendryte-dev-extension/master/LICENSE)
![Version](https://img.shields.io/badge/Version-preview-green)

[English](./README_EN.md)

- [使用准备](#使用准备)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [界面功能介绍](#界面功能介绍)
- [常见问题](#常见问题)
  - [Windows](#Windows)
  - [MacOS](#MacOS)
  - [Linux](#Linux)

## 使用准备

首先安装 [VSCode](https://code.visualstudio.com/)。安装完毕后在 VSCode Extension 中搜索 Kendryte， 即可快速安装本插件。本插件目前仅支持 Kendryte 官方开发板 KD233。

### MacOS 环境准备

1.安装 Homebrew

``` bash
/usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
```

2.安装所需依赖

``` bash
brew install libusb mpfr
```

### Linux 环境准备

#### 依赖安装

Linux 用户在使用之前需要安装 libftdi-dev libhidapi-dev libusb 。

``` bash
sudo apt install libftdi-dev libhidapi-dev libusb-dev
```

或者

``` bash
sudo yum install libftdi hidapi libusb
```

#### 配置调试器权限

1.下载 [60-openocd.rules](https://mirrors-kendryte.s3.cn-northwest-1.amazonaws.com.cn/60-openocd.rules) 文件并将文件放入 `/etc/udev/rules.d`

2.重载 udev

  ``` bash
    sudo udevadm control --reload
  ```

3.添加用户到 plugdev 用户组

  ``` bash
    sudo usermod -aG plugdev $USER
  ```

## 快速开始

1.启动插件后，Kendryte 控制台会自动弹出，点击 Examples 切换至示例项目商店。

![image](https://raw.githubusercontent.com/kendryte/Kendryte-dev-extension/master/resources/readme/quick-start/quick-1.jpeg)

2.选择一个项目下载至本地并打开。

![image](https://raw.githubusercontent.com/kendryte/Kendryte-dev-extension/master/resources/readme/quick-start/quick-2.jpeg)

3.点击状态栏中的编译并上传将项目通过串口烧写至开发板。

![image](https://raw.githubusercontent.com/kendryte/Kendryte-dev-extension/master/resources/readme/quick-start/quick-3.jpeg)

4.在开发板上查看效果。

## 项目结构

``` Bash  
.
├── .vscode
├── CMakeLists.txt
├── README.md
├── build
│   ├── CMakeCache.txt
│   ├── CMakeFiles
│   ├── Makefile
│   ├── ai_image
│   ├── camera-standalone-driver
│   ├── cmake_install.cmake
│   ├── compile_commands.json
│   ├── ${Project-name}
│   ├── ${Project-name}.bin
│   ├── lcd-nt35310-standalone-driver
│   ├── standalone-sdk
│   └── w25qxx-standalone-driver
├── config
│   ├── device-manager.json
│   ├── flash-manager.h
│   ├── flash-manager.json
│   ├── fpioa-config.c
│   ├── fpioa-config.h
│   └── ide-hook-main.c
├── detect.kmodel
├── kendryte-package.json
├── kendryte_libraries
│   ├── ai_image
│   ├── camera-standalone-driver
│   ├── lcd-nt35310-standalone-driver
│   ├── standalone-sdk
│   └── w25qxx-standalone-driver
└──  src
     └── main.c
```

- .vscode: 该目录中内容为自动生成，包含了调试选项，编译命令以及一系列插件直接使用的配置文件。
- CMakeLists.txt: 该文件为插件编译时自动生成的 CMakelists 文件
- build: 该目录中内容为编译产物，其中 ${Project-name} 以及 ${Project-name}.bin 为编译出的最终文件。
- config: 该目录中包含开发板中的引脚配置，模型地址分配配置，内容可修改。
- detect.kmodel: Kendryte 专属模型文件。
- kendryte-package.json: 项目配置文件，包含项目名，source 文件等基本信息，可修改。
- kendryte_libraries: 该目录为依赖安装目录，所有的依赖都会安装到该目录下，安装后的依赖库可以直接调用，无需再手动配置 include。正常情况下不应该修改该目录中文件。
- src: 项目源码目录。

## 界面功能介绍

![image](https://raw.githubusercontent.com/kendryte/Kendryte-dev-extension/master/resources/readme/full-screen.png)

![image](https://raw.githubusercontent.com/kendryte/Kendryte-dev-extension/master/resources/readme/status-bar.png)

![image](https://raw.githubusercontent.com/kendryte/Kendryte-dev-extension/master/resources/readme/kendryte-index.png)

![image](https://raw.githubusercontent.com/kendryte/Kendryte-dev-extension/master/resources/readme/kendryte-lib.png)

## 常见问题

### Windows

1. Q: 为什么调试时启动 Openocd 报错 libusb_error_not_supported ？

    A: 请下载 [Zadig](https://zadig.akeo.ie/) 将 JLink 驱动转为 Libusb。

### MacOS

### Linux

1. Q: 为什么调试启动 Openocd 报错 libusb_error_access ？

    A: 请根据上文[配置调试器权限](#配置调试器权限)来获取调试器权限并重新接入调试设备。如果问题仍未解决，请在 [issue](https://github.com/kendryte/Kendryte-dev-extension/issues) 中联系我们。

2. Q: 为什么烧写时需要 sudo 权限密码？

    A: 只有当前用户没有读取串口设备权限时才会出现需要密码，您也可以自行配置串口设备权限组。

## Roadmap

- [ ] 发布 0.1.0 preview 版本。(2019.12.09)
- [ ] 串口参数可配置。
- [ ] 将 serialport 以及 bindings 库移出 node_modules 以保证跨平台可用。
- [ ] 添加开发模式下 Webview panel 直接监听本地 React 开发服务器功能。
- [ ] 增加引脚可视化配置。
- [ ] 添加 CI/CD
- [ ] 发布 0.2.0 版本。(2020.02)
- [ ] 增加支持二代 K510 芯片。(2020 Q2)
