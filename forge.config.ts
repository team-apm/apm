import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { PublisherGithub } from '@electron-forge/publisher-github';

import path from 'node:path';

import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';

const config: ForgeConfig = {
  packagerConfig: {
    executableName: 'apm',
    icon: './icon/apm',
    asar: true,
    extraResource: 'ThirdPartyNotices.txt',
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: 'apm',
      exe: 'apm.exe',
      authors: 'Team apm',
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
        maintainer: 'Team apm',
        homepage: 'https://team-apm.github.io/apm/',
        icon: path.join(__dirname, 'icon/apm1024.png'),
      },
    }),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: './src/renderer/windows/main/index.html',
            js: './src/renderer/windows/main/renderer.ts',
            name: 'main_window',
            preload: {
              js: './src/renderer/windows/main/preload.ts',
            },
          },
        ],
      },
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
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
};

export default config;
