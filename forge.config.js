const path = require('path');

module.exports = {
  packagerConfig: {
    executableName: 'apm',
    icon: 'icon/apm',
    asar: {
      unpackDir: '{node_modules/7zip-bin,node_modules/win-7zip}',
    },
    ignore: [
      /^(?!.*node_modules).*\/\.github$/,
      /^(?!.*node_modules).*\/\.husky$/,
      /^(?!.*node_modules).*\/\.vscode$/,
      /^(?!.*node_modules).*\/docs$/,
      /^(?!.*node_modules).*\/\.czrc$/,
      /^(?!.*node_modules).*\/\.editorconfig$/,
      /^(?!.*node_modules).*\/\.eslint/,
      /^(?!.*node_modules).*\/\.gitignore$/,
      /^(?!.*node_modules).*\/\.prettier/,
      /^(?!.*node_modules).*\/CHANGELOG\.md$/,
      /^(?!.*node_modules).*\/CODE_OF_CONDUCT\.md$/,
      /^(?!.*node_modules).*\/CONTRIBUTING(?!.*\/).*\.md$/,
      /^(?!.*node_modules).*\/README(?!.*\/).*\.md$/,
      /^(?!.*node_modules).*\/SECURITY\.md$/,
      /^(?!.*node_modules).*\/ThirdPartyNotices\.txt$/,
      /^(?!.*node_modules).*\/(?!.*\/).*config\.js$/,
    ],
    extraResource: 'ThirdPartyNotices.txt',
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'apm',
        exe: 'apm.exe',
        iconUrl: path.join(__dirname, 'icon/apm.ico'),
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32', 'darwin', 'linux'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          maintainer: 'ato lash',
          homepage: 'http://halshusato.starfree.jp/ato_lash/apm/',
          icon: path.join(__dirname, 'icon/apm1024.png'),
        },
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          maintainer: 'ato lash',
          homepage: 'http://halshusato.starfree.jp/ato_lash/apm/',
          icon: path.join(__dirname, 'icon/apm1024.png'),
        },
      },
    },
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'hal-shu-sato',
          name: 'apm',
        },
        draft: true,
      },
    },
  ],
};
