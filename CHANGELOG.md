# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.3.2](https://github.com/hal-shu-sato/apm/compare/v0.3.1...v0.3.2) (2021-07-10)

### Features

- add support for changing the URL to get the data files ([0ef18e4](https://github.com/hal-shu-sato/apm/commit/0ef18e48eaf7b3a4478305b9c2a6fb39882d62c5)), closes [#19](https://github.com/hal-shu-sato/apm/issues/19)

### [0.3.1](https://github.com/hal-shu-sato/apm/compare/v0.3.0...v0.3.1) (2021-07-04)

### Bug Fixes

- change not to destory the browser window when it does not exist ([0b4e30a](https://github.com/hal-shu-sato/apm/commit/0b4e30adb273109e4bdc5d24d959dda3efe2fad5))

## [0.3.0](https://github.com/hal-shu-sato/apm/compare/v0.2.0...v0.3.0) (2021-07-04)

### Features

- add a feature to manage scripts ([c0d9e12](https://github.com/hal-shu-sato/apm/commit/c0d9e124166bc7b9ca47f9e8f4b0be603c6ee227)), closes [#3](https://github.com/hal-shu-sato/apm/issues/3)

### Bug Fixes

- change to destory the browser window when the main window is closed ([84e34f9](https://github.com/hal-shu-sato/apm/commit/84e34f99f3a31fc4006da0f2b9ee390bcc1688ea))

## [0.2.0](https://github.com/hal-shu-sato/apm/compare/v0.1.2...v0.2.0) (2021-07-04)

### Features

- add a browser system to download plugins ([0d1033c](https://github.com/hal-shu-sato/apm/commit/0d1033c93513679ae95657df253cc0204904c548)), closes [#16](https://github.com/hal-shu-sato/apm/issues/16)
- add a feature to uninstall a plugin ([1e47bff](https://github.com/hal-shu-sato/apm/commit/1e47bffbf0ee750cd28a7b0df8945b16f08b9b03)), closes [#2](https://github.com/hal-shu-sato/apm/issues/2)
- add automatic search for files in an archive ([fff1907](https://github.com/hal-shu-sato/apm/commit/fff19079208633f15d6d2b94a3cd977804925418)), closes [#2](https://github.com/hal-shu-sato/apm/issues/2)
- add borders on the plugin panel ([45bb128](https://github.com/hal-shu-sato/apm/commit/45bb128aaacffc7d5a976a15f1ce4a5078717af2))
- add showing a list of plugins ([31a7eb7](https://github.com/hal-shu-sato/apm/commit/31a7eb78383667ee343a3dd73b389e59c3bf1e0f)), closes [#2](https://github.com/hal-shu-sato/apm/issues/2)
- add showing installed plugin versions ([a44e26b](https://github.com/hal-shu-sato/apm/commit/a44e26bf071063a6f9d1864009f45e2c93a5d8c6)), closes [#2](https://github.com/hal-shu-sato/apm/issues/2)
- add showing installed version after installing ([83b2d86](https://github.com/hal-shu-sato/apm/commit/83b2d8690d1e36dbe064013f0be181b59dba3b60)), closes [#2](https://github.com/hal-shu-sato/apm/issues/2)
- add splash screen in launching ([c85d0c8](https://github.com/hal-shu-sato/apm/commit/c85d0c8eea20a8e2fa729afdd388a0cd0e8279c9)), closes [#4](https://github.com/hal-shu-sato/apm/issues/4)
- add the feature to display the details of plugins ([9e23817](https://github.com/hal-shu-sato/apm/commit/9e2381754b21326c83b7d794dddcd6459f5792ca)), closes [#2](https://github.com/hal-shu-sato/apm/issues/2)
- add the feature to install a plugin ([0cc8757](https://github.com/hal-shu-sato/apm/commit/0cc875731985ac5ff1140fa5ca0e7e04ccddbdf1)), closes [#2](https://github.com/hal-shu-sato/apm/issues/2)
- check whether a program is installed on launching and on changing installation path ([9ea80a6](https://github.com/hal-shu-sato/apm/commit/9ea80a634e1598027dfe77ec5b0a3c2d6db635b1)), closes [#12](https://github.com/hal-shu-sato/apm/issues/12)
- separate plugin types with a comma ([cb95701](https://github.com/hal-shu-sato/apm/commit/cb957015f9607d3a65ff7873ee45419ae7f7972e)), closes [#2](https://github.com/hal-shu-sato/apm/issues/2)
- support installation using an installer ([f2b9e7c](https://github.com/hal-shu-sato/apm/commit/f2b9e7c8b48d04571d7835fbb8e80f4923c1a102)), closes [#2](https://github.com/hal-shu-sato/apm/issues/2)

### Bug Fixes

- fix a bug that cause an error when checking for the latest version after downloading a file ([5f391e8](https://github.com/hal-shu-sato/apm/commit/5f391e8c96a77f46a69219835a6cf25db0ad064d))
- fix a bug that prevented the uninstallation of optional files ([46861a5](https://github.com/hal-shu-sato/apm/commit/46861a52860fcefa5d9176b1474cca0c2226c8f0))
- fix installing core ([a212860](https://github.com/hal-shu-sato/apm/commit/a2128600914063ca56092c3a0e273b0068ebb317))
- fix the bug that the process stops when unzip fails ([3b73f1d](https://github.com/hal-shu-sato/apm/commit/3b73f1d941290f62678d71254f264f60675c95c2))

### [0.1.2](https://github.com/hal-shu-sato/apm/compare/v0.1.1...v0.1.2) (2021-06-21)

### Features

- add auto updating ([de14c86](https://github.com/hal-shu-sato/apm/commit/de14c86520fd0fb5e62b129355acf27733b2f00c)), closes [#6](https://github.com/hal-shu-sato/apm/issues/6)

### [0.1.1](https://github.com/hal-shu-sato/apm/compare/v0.1.0...v0.1.1) (2021-06-21)

## 0.1.0 (2021-06-21)

### Features

- add a feature to get stored core version ([e8c1d31](https://github.com/hal-shu-sato/apm/commit/e8c1d317c4229a02487414fef8a821174b02b093))
- add adding version options in select on loaded ([650bf99](https://github.com/hal-shu-sato/apm/commit/650bf990c36bb597aefdb94ef5ce39b9d30e99bc)), closes [#1](https://github.com/hal-shu-sato/apm/issues/1)
- Add displaying an error message when a successful installation fails ([a30bf28](https://github.com/hal-shu-sato/apm/commit/a30bf28b1e697137933053803a52dd4c678c9746)), closes [#1](https://github.com/hal-shu-sato/apm/issues/1)
- add installation feature for AviUtl & Exedit ([ff531f9](https://github.com/hal-shu-sato/apm/commit/ff531f9d7015f79fe14f038ea16cdfd9caff063d)), closes [#1](https://github.com/hal-shu-sato/apm/issues/1)
- add latest-version checking ([6946af5](https://github.com/hal-shu-sato/apm/commit/6946af5da718f50221cc6e576526b023e5df3e61)), closes [#1](https://github.com/hal-shu-sato/apm/issues/1)
- add main window & about window ([79712a5](https://github.com/hal-shu-sato/apm/commit/79712a52bd65bb6419277ad764d6ddf8e7ad7ae0))
- add selecting installation path & store it ([e636ae1](https://github.com/hal-shu-sato/apm/commit/e636ae19bf8f599e756683502286b33ba49673e1)), closes [#1](https://github.com/hal-shu-sato/apm/issues/1)
- add showing 'Not acquired' when a version file doesn't exist ([785229d](https://github.com/hal-shu-sato/apm/commit/785229d6f28dd3ce26d8e8a3f5bfe35e675a3f13)), closes [#1](https://github.com/hal-shu-sato/apm/issues/1)
- add showing an error dialog on not selecting installation path ([7c72548](https://github.com/hal-shu-sato/apm/commit/7c72548d771af200ff01430f6e1b3346e4d26a4e))
- add showing spinner when updating latest core version ([f1d3878](https://github.com/hal-shu-sato/apm/commit/f1d3878bdb345f61667ba8b8185d85e7a0111e38)), closes [#1](https://github.com/hal-shu-sato/apm/issues/1)
- add showing stored latest version on loading ([f74990e](https://github.com/hal-shu-sato/apm/commit/f74990e65feca26a9fa8c608edee23b91152a0e8)), closes [#1](https://github.com/hal-shu-sato/apm/issues/1)
- make a dialog selecting directory a modal window ([09b16a2](https://github.com/hal-shu-sato/apm/commit/09b16a265c74899215e29ab9418aa0e5a868f881))
- **index.html:** add tab to change pane ([23a852c](https://github.com/hal-shu-sato/apm/commit/23a852cbef6adbf4470aeb19a1290420218ffb8d))
- create initial files for electron ([88c6997](https://github.com/hal-shu-sato/apm/commit/88c699777b00f7358b6e8bc803c33dbac4ac87dd))

### Bug Fixes

- fix installing without specifying path or version ([a81886e](https://github.com/hal-shu-sato/apm/commit/a81886e02d95c8896a1d9bb51fd64dcfd2c3ed3a))
- fix not showing installed version on loading ([1643b1f](https://github.com/hal-shu-sato/apm/commit/1643b1f475a68cbe0fc79d40bf4fcabe1908f653))
- fix not updating installed version on installing ([f341878](https://github.com/hal-shu-sato/apm/commit/f341878d84b02c30ff3a5332bac84c260879a1ae))
