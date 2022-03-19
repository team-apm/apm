# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [2.1.1](https://github.com/hal-shu-sato/apm/compare/v2.1.0...v2.1.1) (2022-03-19)

### Bug Fixes

- **package.js:** fixed installation of dependent libraries ([c89a12b](https://github.com/hal-shu-sato/apm/commit/c89a12b1fdd008add8010fbfa1a9877aa773c285))

## [2.1.0](https://github.com/hal-shu-sato/apm/compare/v2.0.0...v2.1.0) (2022-03-17)

### Features

- add error handling ([46d8fe4](https://github.com/hal-shu-sato/apm/commit/46d8fe48e78ffa7070cf5588513174452cad629c))
- add the history of the browser to the return value ([37c7617](https://github.com/hal-shu-sato/apm/commit/37c761711d92d2c66bf54cfc3f66d2336c095790))
- **core:** verify the integrity of the downloaded files ([3af0a28](https://github.com/hal-shu-sato/apm/commit/3af0a285e96efc78c129a5587fccc3974a591429))
- indicating updatable packages ([7e0e086](https://github.com/hal-shu-sato/apm/commit/7e0e0864c4aa3812b1b6e33828ac61b414897898))
- **package.js:** detection of falsified files ([4caa182](https://github.com/hal-shu-sato/apm/commit/4caa182926e5cf7710fd2bc2a67ea6bc58648646))
- **package.js:** mark installed packages in the batch installation list ([8fe9df4](https://github.com/hal-shu-sato/apm/commit/8fe9df47eab0304bfb1b43bdc6d7e0f7707acda3))
- **packages.js:** support for non-archived packages ([c841bef](https://github.com/hal-shu-sato/apm/commit/c841bef5b8967994032129fa72880161d3b531d9))
- **parseXML:** implement the output of sri ([6af289d](https://github.com/hal-shu-sato/apm/commit/6af289d7ddeb9de6a49b8762cbcea482cf4b3341))
- **parseXML:** parsing the archiveIntegrity ([e7f6071](https://github.com/hal-shu-sato/apm/commit/e7f6071e5adeadd8006c80b8837bfc9f657e885f))
- precise automatic installation of the scripts ([09115d6](https://github.com/hal-shu-sato/apm/commit/09115d663d905cad74da9ecce62df48cd6131964))
- show a dialog that suggests re-downloading ([28eb8c8](https://github.com/hal-shu-sato/apm/commit/28eb8c85f7a5eca5579d3dd8d7e2db28ea7ea226))
- support 7z and rar ([5e4c367](https://github.com/hal-shu-sato/apm/commit/5e4c3673fd6f55db261b1e66767057d602081712))
- support for installation-only attributes ([7fe8664](https://github.com/hal-shu-sato/apm/commit/7fe8664ac06912b197c61351c36c5dced73678cd))
- support obsolete flag of files ([19ada0d](https://github.com/hal-shu-sato/apm/commit/19ada0d56ac982748a52afa554299d8edffe5571))

### Bug Fixes

- **core.js:** prevent package overwriting ([58c7c8a](https://github.com/hal-shu-sato/apm/commit/58c7c8a6f757a096d227f918cadb4097213f54f8))
- **core.js:** support for old mod.xml ([7121935](https://github.com/hal-shu-sato/apm/commit/7121935bbcde358ec16797836566de7030201565))
- fix for cache reuse conditions ([29e4b73](https://github.com/hal-shu-sato/apm/commit/29e4b731be7ac9f58d9d6f039eaea56d02495174))
- **index.html:** fixed affected layouts ([4000f24](https://github.com/hal-shu-sato/apm/commit/4000f241555310ba2f1be46e477d6e3e8cd68d79))
- **list.js:** patch for update function in list.js ([0975e25](https://github.com/hal-shu-sato/apm/commit/0975e254001a92f8b1033af8f3cf057cfe16085d))
- make an installation directory just before installing ([1098baa](https://github.com/hal-shu-sato/apm/commit/1098baa7f27e4eaedc85818922a67592a2354ea6)), closes [#388](https://github.com/hal-shu-sato/apm/issues/388)
- **package.js:** clarify the role of installPackage() ([834c5fa](https://github.com/hal-shu-sato/apm/commit/834c5fa93cac0b55db2304a298b44d1fa024bd86))
- **package.js:** simplify the redraw method ([77f09ca](https://github.com/hal-shu-sato/apm/commit/77f09ca8b7230f0274c5b7f7423667e1239123e2))
- **parseXML:** change the options for XMLbuilder ([529546d](https://github.com/hal-shu-sato/apm/commit/529546dfa227348169b7814c7bc7400bcf77204a))
- remove temporary patches for parser bugs ([260bd15](https://github.com/hal-shu-sato/apm/commit/260bd153c5fbeb42c43817413f54007c62940e3f))
- support for fast-xml-parser v4 ([32d944b](https://github.com/hal-shu-sato/apm/commit/32d944b150ba9bff42f5986154494a2d414ae35b))

## [2.0.0](https://github.com/hal-shu-sato/apm/compare/v1.3.0...v2.0.0) (2022-01-03)

### ⚠ BREAKING CHANGES

- No longer supports data v1

### Features

- add a menu to open Google Form ([d8e6006](https://github.com/hal-shu-sato/apm/commit/d8e60061cca689323d7fec01524871cbde1312a5))
- add backups and logs to the migration ([085257e](https://github.com/hal-shu-sato/apm/commit/085257ec93e0b598548645ff807f2acf0a5b0bcc))
- add compatibility to package list ([04b0db3](https://github.com/hal-shu-sato/apm/commit/04b0db37dfbb5a9bacdccfb9d8af08feb187aabe))
- add id conversion ([ecd863a](https://github.com/hal-shu-sato/apm/commit/ecd863a56c60adfd5bfc621e6ac27095a2b2a632))
- add the dialogs for custom dataURL users ([b27d5e3](https://github.com/hal-shu-sato/apm/commit/b27d5e3cb12f9ced590fece3631a6299fa9ac16c))
- **convertId:** add a feature to convert IDs ([8a82edc](https://github.com/hal-shu-sato/apm/commit/8a82edc20e70c4b3b4e0cb44e7de14ad47dbad44)), closes [#245](https://github.com/hal-shu-sato/apm/issues/245)
- detecting the package version ([9e37a39](https://github.com/hal-shu-sato/apm/commit/9e37a3900a6bd97e7681bf3150eb3c5dae8945b5)), closes [#235](https://github.com/hal-shu-sato/apm/issues/235) [#245](https://github.com/hal-shu-sato/apm/issues/245)
- estimate the version from the hash ([63152cf](https://github.com/hal-shu-sato/apm/commit/63152cfd253e9ff7cbf61086459d8b426930bcb9))
- perform id conversion during xml parsing ([bf308ef](https://github.com/hal-shu-sato/apm/commit/bf308efea92d859e77851f95d0314fc418dc0c26))
- support for data v2 ([0dfddee](https://github.com/hal-shu-sato/apm/commit/0dfddeebd30d478638f0f265507049a8c3a67b3f)), closes [#245](https://github.com/hal-shu-sato/apm/issues/245)
- support for data v2 core ([b4649d1](https://github.com/hal-shu-sato/apm/commit/b4649d1a4e81c98926b3cf9c297ce16b889e38a3)), closes [#235](https://github.com/hal-shu-sato/apm/issues/235)
- support for data v2 mod ([db8aeca](https://github.com/hal-shu-sato/apm/commit/db8aeca1edddc16c973e2294fd66e81fb19567e0)), closes [#235](https://github.com/hal-shu-sato/apm/issues/235)
- support for data v2 package.xml ([a652aa8](https://github.com/hal-shu-sato/apm/commit/a652aa8cf0100dbb7ebbb93b3f41e1ace220b88a))
- update Package Maker ([9931a5e](https://github.com/hal-shu-sato/apm/commit/9931a5e684bf4bbca746433f53cb4222f238172c))

### Bug Fixes

- **core.js:** handling the stream correctly ([7635a6f](https://github.com/hal-shu-sato/apm/commit/7635a6fddcd742591c7e507376b8c28fcae22d0e))
- fix a bug that caused interruptions when parsing file elements failed ([6c2b5f7](https://github.com/hal-shu-sato/apm/commit/6c2b5f77ea78e37ee8a539f0dafd83a757f26a1f))
- fix for dependency resolution ([107648f](https://github.com/hal-shu-sato/apm/commit/107648f77edec5320f4c04a92d17984c755dce8b))
- fix for unexpected download of convert.json ([be8d034](https://github.com/hal-shu-sato/apm/commit/be8d0349a22233989a6e979019162b503c6e1e2c))
- **migration1to2.js:** avoid the error in renaming ([8d83bba](https://github.com/hal-shu-sato/apm/commit/8d83bba995e54b7805d168cb4e280717db7b3385))
- **migration1to2.js:** change the text ([3284415](https://github.com/hal-shu-sato/apm/commit/32844159a22bb09afa035b5fa5e68309fc73f4e1))
- **migration1to2.js:** logging errors ([c46ba6d](https://github.com/hal-shu-sato/apm/commit/c46ba6d6feddec712b91caf73ffffb2aab25695d))
- **package.js:** fix for plugin filtering ([8e662db](https://github.com/hal-shu-sato/apm/commit/8e662db43463d9162e3b251458224d4f8fbc8a23))
- **package.js:** use the correct version name ([60b4aff](https://github.com/hal-shu-sato/apm/commit/60b4aff8343a5c9ed615457c30a3dbde4ea0b2a3))
- **parseXML:** use object instead of list ([801ce12](https://github.com/hal-shu-sato/apm/commit/801ce12e012154dd00ecbbe44b9e97fd1f291544))
- **setting.js:** fix for initialization failure ([3eb3bf9](https://github.com/hal-shu-sato/apm/commit/3eb3bf96e86cc8e74288fdcb743261a51d7b4279))
- use SRI ([85cd59b](https://github.com/hal-shu-sato/apm/commit/85cd59b05332e33cb392084a35d317f5f43a49b9))

## [1.3.0](https://github.com/hal-shu-sato/apm/compare/v1.2.0...v1.3.0) (2021-11-14)

### Features

- add the option to make the version a date ([45a55ab](https://github.com/hal-shu-sato/apm/commit/45a55ab608eee2085147e3563ce5076a31f8bced))
- change the UI colors to improve readability ([72a7213](https://github.com/hal-shu-sato/apm/commit/72a72130cf29284128a6c4c4370e47a5efbf894f))
- **package.js:** support dependency specification by logical OR ([d2aa49b](https://github.com/hal-shu-sato/apm/commit/d2aa49bcfedf5ba5c8d189c79d7eb19455ddb083))
- show original developers ([cf94656](https://github.com/hal-shu-sato/apm/commit/cf94656ec79cc3e3010d785279f29880dcb7de72)), closes [#174](https://github.com/hal-shu-sato/apm/issues/174)

### Bug Fixes

- **\_config.yml:** fix theme name ([faad90c](https://github.com/hal-shu-sato/apm/commit/faad90c4f9b4350f97732f7851d41fbf7dccf977))
- fix theme ([07b3fe3](https://github.com/hal-shu-sato/apm/commit/07b3fe3c02c2c26206f8d4430492fe74bce09721))

## [1.2.0](https://github.com/hal-shu-sato/apm/compare/v1.1.1...v1.2.0) (2021-11-07)

### Features

- add AviUtl shortcut to the Start menu ([a1b0169](https://github.com/hal-shu-sato/apm/commit/a1b01691adb4b67682236b162fda04aa79e729f5))
- adding the default installation path ([072c2b0](https://github.com/hal-shu-sato/apm/commit/072c2b0ba17d21d9f3cce2a9fcf286ae832618fc))
- automatically download repository data ([807a8c7](https://github.com/hal-shu-sato/apm/commit/807a8c7f2ec568213aad4f69f93fc7beefa04c3f)), closes [#188](https://github.com/hal-shu-sato/apm/issues/188)
- change button colors ([681cf0f](https://github.com/hal-shu-sato/apm/commit/681cf0f81646e2a24a558d9e454a13bdc76771df))
- change design of showing mod or check date ([14606c3](https://github.com/hal-shu-sato/apm/commit/14606c3b9cd1d3af4ab77e37b7d238fef4f0d2b9))
- display the versions using a table ([754ab3d](https://github.com/hal-shu-sato/apm/commit/754ab3d0f821dc6ab3cfcce3b491e34a05e8f114))
- fix button layout ([b4396c7](https://github.com/hal-shu-sato/apm/commit/b4396c77ad9831ea5978d656adb9129a869decc3))
- limit the minimum window size ([60224ed](https://github.com/hal-shu-sato/apm/commit/60224eda71a3dac65c2493b488088ae729000860))
- makes package detail easier to understand ([9c6805c](https://github.com/hal-shu-sato/apm/commit/9c6805cfa03af108da75a578983e322a10c6dd35))
- supports dark theme ([fe74a02](https://github.com/hal-shu-sato/apm/commit/fe74a023c0655ed64307f6723058dbf82a603465)), closes [#194](https://github.com/hal-shu-sato/apm/issues/194)
- use dropdowns instead of selects ([2cc2acb](https://github.com/hal-shu-sato/apm/commit/2cc2acb1cdaf6c11d0052e5493a95c16393f7bb7))
- use ul instead of table ([c43094e](https://github.com/hal-shu-sato/apm/commit/c43094e67926905e296e35ad7916da850b1e0b49))

### Bug Fixes

- **core.js:** delete unnecessary lines ([32ee303](https://github.com/hal-shu-sato/apm/commit/32ee303b98a921b2cdf5e05f7750fa20a391570d))
- fix an download error on startup ([950340c](https://github.com/hal-shu-sato/apm/commit/950340cbede7283eff02ac7d8ec4c05837288cb7)), closes [#173](https://github.com/hal-shu-sato/apm/issues/173)
- fix for missing argument ([f4afaf9](https://github.com/hal-shu-sato/apm/commit/f4afaf9629484383b2aed90fd394dbbfe1ed768f))
- fix sort button design ([0e292c1](https://github.com/hal-shu-sato/apm/commit/0e292c1b2349283789d81b1fe116600d142b04db))
- fix to folder creation ([59a677f](https://github.com/hal-shu-sato/apm/commit/59a677fabe183ef61d26551043c85a4beb4f33e6))
- fixing the design ([ee9023b](https://github.com/hal-shu-sato/apm/commit/ee9023b21e5d46e5883b6fb186db1c83d75b415f))
- make the install buttons clickable ([38f08dc](https://github.com/hal-shu-sato/apm/commit/38f08dccdaacc9194d3eb4ab1c7baf211df9fdfb))

### [1.1.1](https://github.com/hal-shu-sato/apm/compare/v1.1.0...v1.1.1) (2021-10-17)

## [1.1.0](https://github.com/hal-shu-sato/apm/compare/v1.0.0...v1.1.0) (2021-10-17)

### Features

- add a button to open the download folder ([61c535f](https://github.com/hal-shu-sato/apm/commit/61c535f751b17639e070d753aea08efce351e544)), closes [#138](https://github.com/hal-shu-sato/apm/issues/138)
- add batch install function ([a3b2d85](https://github.com/hal-shu-sato/apm/commit/a3b2d8537b076ff1b5fc31199b30664c0c55f976)), closes [#167](https://github.com/hal-shu-sato/apm/issues/167)
- add checking mod dates of the lists on startup ([3699c1a](https://github.com/hal-shu-sato/apm/commit/3699c1a5728b4460878ec07c0a9419441ece5408)), closes [#169](https://github.com/hal-shu-sato/apm/issues/169)
- add filtering of packages ([551026a](https://github.com/hal-shu-sato/apm/commit/551026a5d0226936854e2df3f1cf9b95cf9c80e8)), closes [#113](https://github.com/hal-shu-sato/apm/issues/113)
- add links to the documentation ([777caac](https://github.com/hal-shu-sato/apm/commit/777caacaa9062a3a5debe5adc68084d0a50a2058)), closes [#31](https://github.com/hal-shu-sato/apm/issues/31)
- call the install function on any package ([4b8e006](https://github.com/hal-shu-sato/apm/commit/4b8e006d5a42fafd2fe30cdd7d6b4fbd3bddfa5e))
- enable installation without UI ([55ff85c](https://github.com/hal-shu-sato/apm/commit/55ff85cb113bc02446c5e0fc34b4e2ce18697648))
- **html:** update CSP ([dc5589f](https://github.com/hal-shu-sato/apm/commit/dc5589f106365ef2a9d3d39a4083ead574dae3ec))
- install scripts without a database ([ea4dc13](https://github.com/hal-shu-sato/apm/commit/ea4dc131c71db047d4d408edf76882478f9a79e3)), closes [#141](https://github.com/hal-shu-sato/apm/issues/141)
- **log:** add the feature to log uncaught exceptions and exit ([086c8dd](https://github.com/hal-shu-sato/apm/commit/086c8dd55496ad94be0fafcc2edfccf48a8c4bab))
- **log:** add the feature to log uncaught exceptions in renderer processes ([e336451](https://github.com/hal-shu-sato/apm/commit/e336451e35f76981b7000344c68ba8024d4780d2))
- **package.js:** add links to install dependencies ([c512fbe](https://github.com/hal-shu-sato/apm/commit/c512fbef498ae2d8a11118409efaf9ac95036bed))
- **package:** support for dependency features ([2b509ab](https://github.com/hal-shu-sato/apm/commit/2b509ab0114e6ec0a709400b8ad154d1f25cb492))
- show package names to install ([7490310](https://github.com/hal-shu-sato/apm/commit/749031017034e50aaf4e467b0260654cb9b6b6fc))
- support for local repositories ([43f4e95](https://github.com/hal-shu-sato/apm/commit/43f4e95e2d47216837af9bc63122083c964314f5))
- use twemoji ([058695b](https://github.com/hal-shu-sato/apm/commit/058695bbe6fb902d3d5ead00e7be80208b2d7e29))

### Bug Fixes

- fixes problems with error messages not appearing ([a1abbe3](https://github.com/hal-shu-sato/apm/commit/a1abbe39e3df6942885b4f4c9ed4e89571ec0a60))
- **index.html:** align the menu to the right ([fcdd4df](https://github.com/hal-shu-sato/apm/commit/fcdd4df5a0848a8836a1bc6c720cea54249b05c3))
- reduce buttons ([b70cc34](https://github.com/hal-shu-sato/apm/commit/b70cc347562ab7d4eceb538c8f9d9652993d96d3))
- replace url and refactoring ([ccdb32d](https://github.com/hal-shu-sato/apm/commit/ccdb32d3612e5dd1f40d05284a5aab66db95ca62))

## [1.0.0](https://github.com/hal-shu-sato/apm/compare/v0.3.2...v1.0.0) (2021-09-12)

### ⚠ BREAKING CHANGES

- **App Name:** All settings will be lost.
- changing the file name and tag name of the xml file
- Data about the scripts is deleted.
- All installation information will be reset.
- **plugin.js&script.js:** This commit changes the data structure for 'installedVersion.plugin' and
  'installedVersion.script'.
- This commit changes the data structure for 'dataURL'.

### Features

- add a feature to display update date and time ([299c31d](https://github.com/hal-shu-sato/apm/commit/299c31d3ff0f80481d887a35a371ab140b66df83)), closes [#104](https://github.com/hal-shu-sato/apm/issues/104)
- add a menu to send a feedback ([3e5fe81](https://github.com/hal-shu-sato/apm/commit/3e5fe816cf9417091fff179605a5979dbf127516)), closes [#117](https://github.com/hal-shu-sato/apm/issues/117)
- add a tool for generating packages ([e7ef296](https://github.com/hal-shu-sato/apm/commit/e7ef296afdef70ba2b656afa824c8a1d6ad557ae))
- add contributors' credits ([39724ef](https://github.com/hal-shu-sato/apm/commit/39724effbddcda2982a5f9bbdf4a0cb8040f2951)), closes [#59](https://github.com/hal-shu-sato/apm/issues/59)
- add copyright and information about third-party notices ([f0f78fe](https://github.com/hal-shu-sato/apm/commit/f0f78fee83e3c00991e590cc60088a9021be71df)), closes [#63](https://github.com/hal-shu-sato/apm/issues/63)
- add descriptions to the UI ([4a7cbbe](https://github.com/hal-shu-sato/apm/commit/4a7cbbec792307023b6c9aeb4a6d2722a5774f15))
- add the feature to adjust the zoom of the display ([1cea281](https://github.com/hal-shu-sato/apm/commit/1cea281f7cd1b3b3a58a06cc0865b7a1916430a7)), closes [#46](https://github.com/hal-shu-sato/apm/issues/46)
- bundle a file that notices the license in the package ([9f17a78](https://github.com/hal-shu-sato/apm/commit/9f17a789505a5d26fd1992987b96250f8472d2bc)), closes [#63](https://github.com/hal-shu-sato/apm/issues/63)
- change to manage versions by JSON file in installation directory ([c7606ec](https://github.com/hal-shu-sato/apm/commit/c7606ec9b35a588b2209b9d9e917fe18039d5c2c)), closes [#45](https://github.com/hal-shu-sato/apm/issues/45)
- change to use the path of the file specified in the archive in the data file ([5431fcf](https://github.com/hal-shu-sato/apm/commit/5431fcfed317ee3680921b7e37c639a9ba106a56)), closes [#52](https://github.com/hal-shu-sato/apm/issues/52)
- enables DevTools in the development environment ([71b58a3](https://github.com/hal-shu-sato/apm/commit/71b58a3cd51e01c229e565103402a8ccf16f7e30))
- improve appearance of the table ([8f1c862](https://github.com/hal-shu-sato/apm/commit/8f1c862762ca8d60d92208ecf4af0e882892a1f1))
- insert the default repository when nothing is entered in the input ([446a13e](https://github.com/hal-shu-sato/apm/commit/446a13e9dc15326cd2e41eba399c3113afd480e6)), closes [#122](https://github.com/hal-shu-sato/apm/issues/122)
- integrating plugins and scripts ([b55c7f9](https://github.com/hal-shu-sato/apm/commit/b55c7f9e1c1525aea90a275a5364eeb47aed0732)), closes [#70](https://github.com/hal-shu-sato/apm/issues/70)
- **Logo:** add a logo ([20e1977](https://github.com/hal-shu-sato/apm/commit/20e1977cb826ed69b8f124446e9f556160d55760)), closes [#11](https://github.com/hal-shu-sato/apm/issues/11)
- **main.js:** allow the download function to handle local files ([3952e2f](https://github.com/hal-shu-sato/apm/commit/3952e2f79613c99575795f38eddd6be1835c43d7))
- **main.js:** multiple repositories support for download function ([d8a10d5](https://github.com/hal-shu-sato/apm/commit/d8a10d5c92570eec9ec386ce8f06a677753f42de))
- **package maker:** support for installers ([d2aab43](https://github.com/hal-shu-sato/apm/commit/d2aab43f12d1a25f30bc7bd8b292f9546dd4da6b))
- **parseXML:** automatically generate type ([47deb3c](https://github.com/hal-shu-sato/apm/commit/47deb3c74b0d8b4e99fc396cee60d3334894d35c))
- **plugin.js&script.js:** avoid plugin or script id conflicts ([9e95363](https://github.com/hal-shu-sato/apm/commit/9e953637319c941c8c2d69b866688e5a772e39ad)), closes [#48](https://github.com/hal-shu-sato/apm/issues/48)
- **plugin&script:** show manually added plug-ins ([1a84bb4](https://github.com/hal-shu-sato/apm/commit/1a84bb4c6b78bc08f4a68115c0afad4463d5ec19)), closes [#47](https://github.com/hal-shu-sato/apm/issues/47)
- **plugin&script:** work with manually added plugins ([d09cfae](https://github.com/hal-shu-sato/apm/commit/d09cfaecd1e47367baee95ad37e4b625af463665))
- **preload:** load repository data at first startup ([aac327f](https://github.com/hal-shu-sato/apm/commit/aac327f2792aa6de49d3f2097fd9f8e0e871b464))
- rename plugin to package ([e8c50fe](https://github.com/hal-shu-sato/apm/commit/e8c50fec4eee1f99ba1c4a81428a505eb988b055))
- save window position & size and restore it on starting ([4921b16](https://github.com/hal-shu-sato/apm/commit/4921b16bf32f67e56e35e1efc5bb672d6d06a41d)), closes [#96](https://github.com/hal-shu-sato/apm/issues/96)
- sortable and filterable tables ([efc95fc](https://github.com/hal-shu-sato/apm/commit/efc95fcb941e403bdc3d0a325e694f16fadd276b)), closes [#40](https://github.com/hal-shu-sato/apm/issues/40) [#41](https://github.com/hal-shu-sato/apm/issues/41)
- support for multiple repositories ([ce191b6](https://github.com/hal-shu-sato/apm/commit/ce191b67fcf1b716eaa809227a56ba080ddfc731))
- **unzip:** support for lzh files ([80ca546](https://github.com/hal-shu-sato/apm/commit/80ca546b92965429d3900bf8c09a707227ba76c3))
- **userData&Store:** separate data for production and development versions ([d52c62e](https://github.com/hal-shu-sato/apm/commit/d52c62ef8577e254840f8e804e156245cf60704c))

### Bug Fixes

- add await to avoid bugs ([3209019](https://github.com/hal-shu-sato/apm/commit/32090195821d705b86400849f50065862d15b443))
- add missing await ([03800a9](https://github.com/hal-shu-sato/apm/commit/03800a90e4e2f321514a8d9004c0adbcff530074))
- **apmJson:** fix an issue with the installed version ([927f14b](https://github.com/hal-shu-sato/apm/commit/927f14bb382035e46392a7a9e6fb282550263d3b)), closes [#45](https://github.com/hal-shu-sato/apm/issues/45)
- **apmJson:** write json synchronously ([4604be1](https://github.com/hal-shu-sato/apm/commit/4604be1e059bd4c02f8c0e9c758808748b6d5850))
- change to be able to cancel the installation ([07e454a](https://github.com/hal-shu-sato/apm/commit/07e454ac8337e904b099e5e904d32fab235d2fe7)), closes [#81](https://github.com/hal-shu-sato/apm/issues/81)
- change to freeze the selected package while installing or uninstalling ([eca1aae](https://github.com/hal-shu-sato/apm/commit/eca1aae2bdf8d8814e57c954edf3818267b1e94a)), closes [#111](https://github.com/hal-shu-sato/apm/issues/111)
- **core.js:** fix the condition for status display ([5ba053e](https://github.com/hal-shu-sato/apm/commit/5ba053efc9fcab9087b73a618545a6e0827d7308))
- correct folder name ([c228716](https://github.com/hal-shu-sato/apm/commit/c2287164ebd14593464e2684e40cb3880b4dd279))
- dataURL is not loaded on first launch ([3b1a655](https://github.com/hal-shu-sato/apm/commit/3b1a65511ca7f164937646b1976a22635965cccc))
- debug -> dev ([7e2387c](https://github.com/hal-shu-sato/apm/commit/7e2387ca9bb4f2ca5b2692b721a3d3cb69f33397))
- delete unnecessary lines ([1bd13de](https://github.com/hal-shu-sato/apm/commit/1bd13de18aebe3d32b87a56fb523bf4f23ad2e9b))
- display the certificate confirmation dialog ([dca9893](https://github.com/hal-shu-sato/apm/commit/dca9893394c659485e3ad4014517d8c8e7450bc3)), closes [#80](https://github.com/hal-shu-sato/apm/issues/80)
- fix a bug in which errors are not displayed while processing is in progress ([1aa3c6c](https://github.com/hal-shu-sato/apm/commit/1aa3c6c8e4dc23694e9fdc6c9049a8ac2868a3ea)), closes [#97](https://github.com/hal-shu-sato/apm/issues/97)
- fix a problem of checking the latest core version ([e2eddd1](https://github.com/hal-shu-sato/apm/commit/e2eddd17da0a8ecec2a6c83f80eeccc129322885)), closes [#97](https://github.com/hal-shu-sato/apm/issues/97)
- fix an error in displaying the latest version and improve wording ([a3682d1](https://github.com/hal-shu-sato/apm/commit/a3682d128082f4e52acb4e5da39646ac00725281)), closes [#97](https://github.com/hal-shu-sato/apm/issues/97)
- fix an error when destroying the browser window ([9e08c58](https://github.com/hal-shu-sato/apm/commit/9e08c58627a6b57d5d6433bbd4966214a6d6562a))
- fix for sorting after refresh ([698538e](https://github.com/hal-shu-sato/apm/commit/698538e8bc562d3239636db8324417bfb6479c33))
- fix for sorting and filtering ([e3f6b61](https://github.com/hal-shu-sato/apm/commit/e3f6b619b911916ababddca3f3d66799b5a135a5))
- fix scrolling the detail panel ([c80e4ca](https://github.com/hal-shu-sato/apm/commit/c80e4caee3e564af23ec137b1137e30157571591)), closes [#61](https://github.com/hal-shu-sato/apm/issues/61)
- fix scrolling the detail panel for a script ([244f370](https://github.com/hal-shu-sato/apm/commit/244f370c742e41199f05898b4d6e05998d970f5c)), closes [#61](https://github.com/hal-shu-sato/apm/issues/61)
- fix the name of type of track bar ([843a9fb](https://github.com/hal-shu-sato/apm/commit/843a9fbb3f340174adfcbf0f7861e010a77bc435)), closes [#42](https://github.com/hal-shu-sato/apm/issues/42)
- fix to not continue processing when an error occurs on searching a file ([d80d3e8](https://github.com/hal-shu-sato/apm/commit/d80d3e887762d930d809d0711a9280cfb4ba13b6))
- give the class name in HTML ([aac5dc7](https://github.com/hal-shu-sato/apm/commit/aac5dc7b323dc17ed888a8a5639933e4e685c43f))
- **index.html:** fixed description of settings ([ef307d9](https://github.com/hal-shu-sato/apm/commit/ef307d90b221778eab47f97842f9bf9424f54b9d))
- **main.js:** change the timing of hiding the splash screen ([6e4c508](https://github.com/hal-shu-sato/apm/commit/6e4c508f96ac0c7f9c37bf04b429af4b6c92a753))
- **main.js:** make the file name readable ([79583a1](https://github.com/hal-shu-sato/apm/commit/79583a1b36af62c0a359d91f6dba3e8b617e6180))
- **main.js:** remove the menu entry ([8f64eb7](https://github.com/hal-shu-sato/apm/commit/8f64eb7c04b97906bf2f409e0b5d316fbda0d3f8))
- **main.js:** remove the unnecessary condition ([9ef4244](https://github.com/hal-shu-sato/apm/commit/9ef42447e33759d10e9d646254fc46eb81ffba9e))
- make variable names understandable ([572170a](https://github.com/hal-shu-sato/apm/commit/572170a46df0a7edae812a318293e8401bb779d0))
- modify the table design ([0741b10](https://github.com/hal-shu-sato/apm/commit/0741b104e896e72ae8eccd8da402cbd70de953b7))
- **parseXML:** fix an error in parsing files written in XML ([0c5e655](https://github.com/hal-shu-sato/apm/commit/0c5e6550c5a1860911b3503dcf071d621a479f88)), closes [#52](https://github.com/hal-shu-sato/apm/issues/52)
- **plugin.js&script.js:** treat a single file as an array ([2ea328f](https://github.com/hal-shu-sato/apm/commit/2ea328f39a3341cb44c7fd89c735b6f8594003bc))
- **plugin.js:** fix the path passed to the shell ([7396441](https://github.com/hal-shu-sato/apm/commit/73964412a5eac7c27acee727c8b42f921c7f8305))
- **plugin&script:** fixed a bug introduced by [#56](https://github.com/hal-shu-sato/apm/issues/56) ([0ee66f6](https://github.com/hal-shu-sato/apm/commit/0ee66f6d1ad34505685899d50e130464c166b950))
- **readme:** improving the text ([79f2463](https://github.com/hal-shu-sato/apm/commit/79f24637ddbdc5a209900a4b6ef574c266c73779))
- **setting:** fixed dataURL initialization process ([ba15bbf](https://github.com/hal-shu-sato/apm/commit/ba15bbf11a4eae5f4a68a474e410f6f574408121))
- use dataset attribute ([45f561e](https://github.com/hal-shu-sato/apm/commit/45f561e613cb13823b2fb4f35639e62fa95fec63))

- **App Name:** change the name of the app ([4ca986b](https://github.com/hal-shu-sato/apm/commit/4ca986bf48db044516773392005d06a917f0dae6)), closes [#93](https://github.com/hal-shu-sato/apm/issues/93)

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
