const path = require('path');

module.exports = {
  packagerConfig: {
    executableName: 'apm',
    icon: 'icon/apm',
    asar: {
      unpack: '**/.webpack/**/native_modules/**/*',
    },
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
  plugins: [
    [
      '@electron-forge/plugin-webpack',
      {
        mainConfig: './webpack.main.config.js',
        devServer: { liveReload: false },
        devContentSecurityPolicy:
          "default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data: https://twemoji.maxcdn.com/",
        renderer: {
          config: './webpack.renderer.config.js',
          entryPoints: [
            {
              html: './src/index.html',
              js: './src/renderer.js',
              name: 'main_window',
              preload: {
                js: './src/preload.js',
              },
            },
            {
              html: './src/about.html',
              js: './src/about_renderer.js',
              name: 'about_window',
              preload: {
                js: './src/about_preload.js',
              },
            },
            {
              html: './src/splash.html',
              js: './src/splash_renderer.js',
              name: 'splash_window',
            },
            {
              html: './src/package_maker.html',
              js: './src/package_maker_renderer.js',
              name: 'package_maker_window',
              preload: {
                js: './src/package_maker_preload.js',
              },
            },
          ],
        },
      },
    ],
    ['@electron-forge/plugin-auto-unpack-natives'],
  ],
};
