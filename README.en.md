# ![Logo](./icon/apm32.png) AviUtl Package Manager

[![Build](https://github.com/hal-shu-sato/apm/actions/workflows/build.yml/badge.svg)](https://github.com/hal-shu-sato/apm/actions/workflows/build.yml)
[![GitHub issues](https://img.shields.io/github/issues/hal-shu-sato/apm)](https://github.com/hal-shu-sato/apm/issues)
[![GitHub license](https://img.shields.io/github/license/hal-shu-sato/apm)](https://github.com/hal-shu-sato/apm/blob/main/LICENSE)
![GitHub package.json version](https://img.shields.io/github/package-json/v/hal-shu-sato/apm)
![GitHub all releases](https://img.shields.io/github/downloads/hal-shu-sato/apm/total)

apm is software that assists in the installation of AviUtl itself and its plugins and scripts.

Read this in [日本語](./README.md)

- Download and update AviUtl itself and Exedit
- Download, update and delete plugins and scripts
- Support for over 50 plugins and scripts by default
- Search for plugins or scripts and view their introduction pages

## Installation

Run the `AviUtl.Package.Manager-{version}.Setup.exe` downloaded from Assets on [apm/releases](https://github.com/hal-shu-sato/apm/releases) to install.

If you want to use the zipped version that does not require installation, download `AviUtl.Package.Manager-{os}-{version}.zip` and extract it to a location of your choice.

## How to use

### If you are already using Aviutl

1. Launch AviUtl Package Manager
2. Select the folder where Aviutl is installed from "インストール先フォルダを選択"
3. Confirm that "手動インストール" is displayed in the "インストール済みのバージョン" section
4. If you have already installed plugins, open the "Plugins&Scripts" tab and scroll down to the bottom to see the list of added files

### If you are newly installing

1. Launch the AviUtl Package Manager
2. Select the new folder where you want to install Aviutl from "インストール先フォルダを選択"
3. Select the version of Aviutl and Exedit and click the "インストール" button
4. Confirm that the installed version is displayed in "インストール済みのバージョン"

### Install Plugins & Scripts

1. Open the "Plugins&Scripts" tab and select the plugins you want to install
2. The plugin information will be displayed
   - Open the URL in your browser and carefully read the terms of use and precautions
   - Check the settings that are required after installation
3. Click the "インストール" button
4. Download the same version of the file as shown in the "最新バージョン" on the list
5. The installation will be done automatically

### Add plugin/script to the list

Requests for additions, updates, deletions, etc. to the list of plugins and scripts can be sent to [apm-data](https://github.com/hal-shu-sato/apm-data/issues).

## Contribution

### Prerequisites

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) LTS Version (Current: 14.x.x)
- [Yarn 1](https://classic.yarnpkg.com/)

### Clone

Run the following command at a location of your choice

```bash
git clone https://github.com/hal-shu-sato/apm.git
```

Or, after forking the repository, run the following command

```bash
git clone https://github.com/${username}/apm.git
```

### Build

After navigating to your cloned directory, install the package

```bash
cd apm
yarn
```

### Run

Start the application.

```bash
yarn start
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

Also, I'm Japanese, so any pull requests related to English or i18n are most welcome!

## Languages & Framework

- Electron (Node.js)
  - HTML
  - CSS
  - JavaScript

## License

Source Code: [MIT license](./LICENSE)

## Developer

**ato lash**

- [GitHub](https://github.com/hal-shu-sato)
- [Homepage](http://halshusato.starfree.jp/)
- [Twitter](https://twitter.com/hal_shu_sato)

## Thanks

Many English documents have been translated with www.DeepL.com/Translator (free version)
