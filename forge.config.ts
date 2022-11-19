import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { PublisherGithub } from '@electron-forge/publisher-github';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';

import path from 'path';

import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';

const config: ForgeConfig = {
  packagerConfig: {
    executableName: 'apm',
    icon: 'icon/apm',
    asar: {
      unpack: '**/.webpack/**/native_modules/**/*',
    },
    extraResource: 'ThirdPartyNotices.txt',
  },
  makers: [
    new MakerSquirrel({
      name: 'apm',
      exe: 'apm.exe',
      iconUrl: path.join(__dirname, 'icon/apm.ico'),
    }),
    new MakerZIP({}, ['win32', 'darwin', 'linux']),
    new MakerRpm({
      options: {
        homepage: 'https://team-apm.github.io/apm/',
        icon: path.join(__dirname, 'icon/apm1024.png'),
      },
    }),
    new MakerDeb({
      options: {
        maintainer: 'ato lash',
        homepage: 'https://team-apm.github.io/apm/',
        icon: path.join(__dirname, 'icon/apm1024.png'),
      },
    }),
  ],
  publishers: [
    new PublisherGithub({
      repository: {
        owner: 'team-apm',
        name: 'apm',
      },
      draft: true,
    }),
  ],
  plugins: [
    new WebpackPlugin({
      mainConfig: mainConfig,
      devServer: { liveReload: false },
      devContentSecurityPolicy:
        "default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data: https://twemoji.maxcdn.com/ https://*.nicovideo.jp https://*.nicoseiga.jp https://nicovideo.cdn.nimg.jp",
      renderer: {
        config: rendererConfig,
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
    }),
    new AutoUnpackNativesPlugin({}),
  ],
};

export default config;
