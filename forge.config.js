module.exports = {
  packagerConfig: {
    executableName: 'apm',
    asar: {
      unpackDir: 'node_modules/7zip-bin',
    },
    ignore: [
      '(?!node_modules)/\\.github',
      '(?!node_modules)/\\.husky',
      '(?!node_modules)/\\.vscode',
      '(?!node_modules)/\\.czrc$',
      '(?!node_modules)/\\.editorconfig$',
      '(?!node_modules)/\\.eslint',
      '(?!node_modules)/\\.gitignore$',
      '(?!node_modules)/\\.prettier',
      '(?!node_modules)/CHANGELOG\\.md$',
      '(?!node_modules)/CODE_OF_CONDUCT\\.md$',
      '(?!node_modules)/README\\.md$',
      '(?!node_modules)/README\\.ja\\.md$',
      '(?!node_modules)/commitlint\\.config\\.js$',
      '(?!node_modules)/forge\\.config\\.js$',
    ],
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'apm',
        exe: 'apm.exe',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32', 'darwin', 'linux'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      platforms: ['darwin', 'linux'],
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
