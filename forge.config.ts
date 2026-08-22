import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { PublisherGithub } from '@electron-forge/publisher-github';
import type { ForgeConfig } from '@electron-forge/shared-types';
import path from 'node:path';
import { packagedDependencies } from './vite.base.config';

// パッケージに入れるトップレベルのパス。plugin-vite の既定は `.vite` 以外を
// すべて捨てるが、バンドルしない依存(理由は vite.base.config.ts)は
// node_modules のまま同梱しないと実行時に解決できない
const packagedPaths = [
  '/.vite',
  ...packagedDependencies.map((name) => `/node_modules/${name}`),
];

const config: ForgeConfig = {
  packagerConfig: {
    executableName: 'apm',
    icon: 'icon/apm',
    asar: {
      // 7za は spawn する実行ファイルなので asar の外に出す
      // (src/shared/unzip.ts が app.asar → app.asar.unpacked に読み替える)
      unpack: '**/node_modules/{7zip-bin,win-7zip}/**/*',
    },
    extraResource: 'ThirdPartyNotices.txt',
    ignore: (file) => {
      if (!file) return false;
      return !packagedPaths.some(
        (kept) =>
          file === kept ||
          file.startsWith(`${kept}/`) ||
          // 親ディレクトリを捨てると packager が中へ降りない
          kept.startsWith(`${file}/`),
      );
    },
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
    new VitePlugin({
      build: [
        {
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/renderer/main/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
        {
          entry: 'src/renderer/about/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        { name: 'main_window', config: 'vite.renderer.config.ts' },
        { name: 'about_window', config: 'vite.renderer.config.ts' },
        { name: 'splash_window', config: 'vite.renderer.config.ts' },
      ],
    }),
    new AutoUnpackNativesPlugin({}),
  ],
};

export default config;
