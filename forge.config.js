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
          owner: 'team-apm',
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
          "default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data: https://twemoji.maxcdn.com/ https://*.nicovideo.jp https://*.nicoseiga.jp https://nicovideo.cdn.nimg.jp",
        renderer: {
          config: './webpack.renderer.config.js',
          entryPoints: [
            {
              html: './src/renderer/main/index.html',
              js: './src/renderer/main/renderer.ts',
              name: 'main_window',
              preload: {
                js: './src/renderer/main/preload.ts',
              },
            },
            {
              html: './src/renderer/about/about.html',
              js: './src/renderer/about/about_renderer.ts',
              name: 'about_window',
              preload: {
                js: './src/renderer/about/about_preload.ts',
              },
            },
            {
              html: './src/renderer/splash/splash.html',
              js: './src/renderer/splash/splash_renderer.ts',
              name: 'splash_window',
            },
          ],
        },
      },
    ],
    ['@electron-forge/plugin-auto-unpack-natives'],
  ],
};
