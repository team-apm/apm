import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import { PublisherGithub } from '@electron-forge/publisher-github';
import type { ForgeConfig } from '@electron-forge/shared-types';
import path from 'node:path';
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
      // パッケージ版 main 窓(src/renderer/main/index.html)の CSP と同一に保つ。
      // worker-src blob: と style-src 'unsafe-inline' は Monaco/Bootstrap のため撤去不可
      // (理由は index.html のコメント参照)
      devContentSecurityPolicy:
        "default-src 'self'; script-src-elem 'self'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https://*.nicovideo.jp https://*.nicoseiga.jp https://nicovideo.cdn.nimg.jp",
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: './src/renderer/main/index.html',
            js: './src/renderer/main/renderer.tsx',
            name: 'main_window',
            preload: {
              js: './src/renderer/main/preload.ts',
            },
          },
          {
            html: './src/renderer/about/index.html',
            js: './src/renderer/about/renderer.ts',
            name: 'about_window',
            preload: {
              js: './src/renderer/about/preload.ts',
            },
          },
          {
            html: './src/renderer/splash/index.html',
            js: './src/renderer/splash/renderer.ts',
            name: 'splash_window',
          },
        ],
      },
    }),
    new AutoUnpackNativesPlugin({}),
  ],
};

export default config;
