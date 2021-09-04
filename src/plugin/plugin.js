const { ipcRenderer } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const List = require('list.js');
const replaceText = require('../lib/replaceText');
const unzip = require('../lib/unzip');
const setting = require('../setting/setting');
const buttonTransition = require('../lib/buttonTransition');
const parseXML = require('../lib/parseXML');
const apmJson = require('../lib/apmJson');

let selectedPlugin;
let listJS;

/**
 * @param {string} pluginType - A list of plugin types.
 * @returns {string} Parsed plugin types.
 */
function parsePluginType(pluginType) {
  const result = [];
  for (const type of pluginType) {
    switch (type) {
      // plugin
      case 'input':
        result.push('入力');
        break;
      case 'output':
        result.push('出力');
        break;
      case 'filter':
        result.push('フィルター');
        break;
      case 'color':
        result.push('色変換');
        break;
      case 'language':
        result.push('言語');
        break;
      // script
      case 'animation':
        result.push('アニメーション効果');
        break;
      case 'object':
        result.push('カスタムオブジェクト');
        break;
      case 'scene':
        result.push('シーンチェンジ');
        break;
      case 'camera':
        result.push('カメラ制御');
        break;
      case 'track':
        result.push('トラックバー');
        break;
      default:
        result.push('不明');
        break;
    }
  }
  return result.toString();
}

/**
 * Show plugin's details.
 *
 * @param {object} pluginData - An object of plugin's details.
 */
function showPluginDetail(pluginData) {
  for (const detail of ['name', 'overview', 'description', 'developer']) {
    replaceText('plugin-' + detail, pluginData.info[detail]);
  }
  replaceText('plugin-type', parsePluginType(pluginData.info.type));
  replaceText('plugin-latest-version', pluginData.info.latestVersion);

  const a = document.createElement('a');
  a.innerText = pluginData.info.pageURL;
  a.href = pluginData.info.pageURL;
  const pageSpan = document.getElementById('plugin-page');
  while (pageSpan.firstChild) {
    pageSpan.removeChild(pageSpan.firstChild);
  }
  pageSpan.appendChild(a);
}

module.exports = {
  /**
   * Initializes plugin
   *
   * @param {string} instPath - An installation path
   */
  initPlugin: function (instPath) {
    if (!apmJson.has(instPath, 'plugins')) apmJson.set(instPath, 'plugins', {});
  },

  /**
   * Returns an object parsed from plugins_list.xml.
   *
   * @returns {Promise<object>} - A list of object parsed from plugins_list.xml.
   */
  getPluginsInfo: async function () {
    const xmlList = {};

    for (const pluginRepo of setting.getPluginsDataUrl()) {
      const pluginsListFile = await ipcRenderer.invoke(
        'exists-temp-file',
        'plugin/plugins_list.xml',
        pluginRepo
      );
      if (pluginsListFile.exists) {
        xmlList[pluginRepo] = parseXML.plugin(pluginsListFile.path);
      }
    }
    return xmlList;
  },

  /**
   * Sets rows of each plugin in the table.
   *
   * @param {string} instPath - An installation path.
   */
  setPluginsList: async function (instPath) {
    const pluginsTable = document.getElementById('plugins-table');
    const thead = pluginsTable.getElementsByTagName('thead')[0];
    const tbody = pluginsTable.getElementsByTagName('tbody')[0];
    tbody.innerHTML = null;
    const bottomTbody = pluginsTable.getElementsByTagName('tbody')[1];
    bottomTbody.innerHTML = null;

    const columns = [
      'name',
      'overview',
      'developer',
      'type',
      'latestVersion',
      'installedVersion',
    ];
    const columnsDisp = [
      '名前',
      '概要',
      '開発者',
      'タイプ',
      '最新バージョン',
      '現在バージョン',
    ];

    // table header
    if (!thead.hasChildNodes()) {
      const headerTr = document.createElement('tr');
      for (const [i, columnName] of columns.entries()) {
        const th = document.createElement('th');
        th.classList.add('sort');
        th.setAttribute('data-sort', columnName);
        th.setAttribute('scope', 'col');
        th.innerText = columnsDisp[i];
        headerTr.appendChild(th);
      }
      thead.appendChild(headerTr);
    }

    // table body
    const plugins = [];
    for (const [pluginsRepo, pluginsInfo] of Object.entries(
      await this.getPluginsInfo()
    )) {
      for (const [id, pluginInfo] of Object.entries(pluginsInfo)) {
        plugins.push({ repo: pluginsRepo, id: id, info: pluginInfo });
      }
    }

    const installedPlugins = apmJson.get(instPath, 'plugins');

    const getExistingFiles = () => {
      const regex = /^(?!exedit).*\.(auf|aui|auo|auc|aul|anm|obj|cam|tra|scn)$/;
      const safeReaddirSync = (path, option) => {
        try {
          return fs.readdirSync(path, option);
        } catch (e) {
          if (e.code === 'ENOENT') return [];
          else throw e;
        }
      };
      const readdir = (dir) =>
        safeReaddirSync(dir, { withFileTypes: true })
          .filter((i) => i.isFile() && regex.test(i.name))
          .map((i) => i.name);
      return readdir(instPath).concat(
        readdir(path.join(instPath, 'plugins')).map((i) => 'plugins/' + i),
        readdir(path.join(instPath, 'script')).map((i) => 'script/' + i),
        safeReaddirSync(path.join(instPath, 'script'), { withFileTypes: true })
          .filter((i) => i.isDirectory())
          .map((i) => 'script/' + i.name)
          .flatMap((i) =>
            readdir(path.join(instPath, i)).map((j) => i + '/' + j)
          )
      );
    };
    const existingFiles = getExistingFiles();

    let manualFiles = [...existingFiles];
    for (const plugin of plugins) {
      for (const [installedId, installedPlugin] of Object.entries(
        installedPlugins
      )) {
        if (
          installedId === plugin.id &&
          installedPlugin.repository === plugin.repo
        ) {
          for (const file of plugin.info.files) {
            if (!file.isOptional) {
              if (manualFiles.includes(file.filename)) {
                manualFiles = manualFiles.filter((ef) => ef !== file.filename);
              }
            }
            if (!file.isOptional && file.isDirectory) {
              manualFiles = manualFiles.filter(
                (ef) => !ef.startsWith(file.filename)
              );
            }
          }
        }
      }
    }

    const makeTrFromArray = (tdList) => {
      const tr = document.createElement('tr');
      const tds = tdList.map((tdName) => {
        const td = document.createElement('td');
        td.classList.add(tdName);
        tr.appendChild(td);
        return td;
      });
      return [tr].concat(tds);
    };

    for (const plugin of plugins) {
      const [
        tr,
        name,
        overview,
        developer,
        type,
        latestVersion,
        installedVersion,
      ] = makeTrFromArray(columns);
      tr.classList.add('plugin-tr');
      tr.addEventListener('click', (event) => {
        showPluginDetail(plugin);
        selectedPlugin = plugin;
        for (const tmptr of tbody.getElementsByTagName('tr')) {
          tmptr.classList.remove('table-secondary');
        }
        tr.classList.add('table-secondary');
      });
      name.innerHTML = plugin.info.name;
      overview.innerHTML = plugin.info.overview;
      developer.innerHTML = plugin.info.developer;
      type.innerHTML = parsePluginType(plugin.info.type);
      latestVersion.innerHTML = plugin.info.latestVersion;

      let otherVersion = false;
      let otherManualVersion = false;
      for (const file of plugin.info.files) {
        if (!file.isOptional) {
          if (existingFiles.includes(file.filename)) otherVersion = true;
          if (manualFiles.includes(file.filename)) otherManualVersion = true;
        }
      }
      installedVersion.innerHTML = otherManualVersion
        ? '手動インストール済み'
        : otherVersion
        ? '他バージョンがインストール済み'
        : '未インストール';

      for (const [installedId, installedPlugin] of Object.entries(
        installedPlugins
      )) {
        if (
          installedId === plugin.id &&
          installedPlugin.repository === plugin.repo
        ) {
          let filesCount = 0;
          let existCount = 0;
          for (const file of plugin.info.files) {
            if (!file.isOptional) {
              filesCount++;
              if (fs.existsSync(path.join(instPath, file.filename))) {
                existCount++;
              }
            }
          }

          if (filesCount === existCount) {
            installedVersion.innerHTML = installedPlugin.version;
          } else {
            installedVersion.innerHTML =
              '未インストール（ファイルの存在が確認できませんでした。）';
          }
        }
      }

      tbody.appendChild(tr);
    }

    // list manually added plugins
    for (const ef of manualFiles) {
      const [
        tr,
        name,
        overview,
        developer,
        type,
        latestVersion,
        installedVersion,
      ] = makeTrFromArray(columns);
      tr.classList.add('plugin-tr');
      name.innerHTML = ef;
      overview.innerHTML = '手動で追加されたプラグイン';
      developer.innerHTML = '';
      type.innerHTML = '';
      latestVersion.innerHTML = '';
      installedVersion.innerHTML = '';
      bottomTbody.appendChild(tr);
    }

    // sorting and filtering
    if (typeof listJS === 'undefined') {
      listJS = new List('plugins', { valueNames: columns });
    } else {
      listJS.reIndex();
    }
  },

  /**
   * Checks the plugins list.
   *
   * @param {HTMLButtonElement} btn - A HTMLElement of button element.
   * @param {HTMLDivElement} overlay - A overlay of plugins list.
   * @param {string} instPath - An installation path.
   */
  checkPluginsList: async function (btn, overlay, instPath) {
    const enableButton = buttonTransition.loading(btn);

    overlay.style.zIndex = 1000;
    overlay.classList.add('show');

    for (const pluginRepo of setting.getPluginsDataUrl()) {
      await ipcRenderer.invoke(
        'download',
        pluginRepo,
        true,
        'plugin',
        pluginRepo
      );
    }
    await this.setPluginsList(instPath);

    overlay.classList.remove('show');
    overlay.style.zIndex = -1;

    enableButton();
  },

  /**
   * Installs a plugin to installation path.
   *
   * @param {HTMLButtonElement} btn - A HTMLElement of clicked button.
   * @param {string} instPath - An installation path.
   */
  installPlugin: async function (btn, instPath) {
    const enableButton = buttonTransition.loading(btn);

    if (!instPath) {
      buttonTransition.message(
        btn,
        'インストール先フォルダを指定してください。',
        'danger'
      );
      setTimeout(() => {
        enableButton();
      }, 3000);
      throw new Error('An installation path is not selected.');
    }

    if (!selectedPlugin) {
      buttonTransition.message(btn, 'プラグインを選択してください。', 'danger');
      setTimeout(() => {
        enableButton();
      }, 3000);
      throw new Error('A plugin to install is not selected.');
    }

    const url = selectedPlugin.info.downloadURL;
    const archivePath = await ipcRenderer.invoke('open-browser', url, 'plugin');
    if (archivePath === 'close') {
      buttonTransition.message(
        btn,
        'インストールがキャンセルされました。',
        'info'
      );
      setTimeout(() => {
        enableButton();
      }, 3000);
      return;
    }

    const searchFiles = (dirName) => {
      let result = [];
      const dirents = fs.readdirSync(dirName, {
        withFileTypes: true,
      });
      for (const dirent of dirents) {
        if (dirent.isDirectory()) {
          for (const file of selectedPlugin.info.files) {
            if (!file.isOptional && file.isDirectory) {
              if (dirent.name === path.basename(file.filename)) {
                result.push([
                  path.join(dirName, dirent.name),
                  path.join(instPath, file.filename),
                ]);
                break;
              }
            }
          }
          const childResult = searchFiles(path.join(dirName, dirent.name));
          result = result.concat(childResult);
        } else {
          if (selectedPlugin.info.installer) {
            if (dirent.name === selectedPlugin.info.installer) {
              result.push([path.join(dirName, dirent.name)]);
              break;
            }
          } else {
            for (const file of selectedPlugin.info.files) {
              if (!file.isOptional) {
                if (dirent.name === path.basename(file.filename)) {
                  result.push([
                    path.join(dirName, dirent.name),
                    path.join(instPath, file.filename),
                  ]);
                  break;
                }
              } else {
                break;
              }
            }
          }
        }
      }
      return result;
    };

    try {
      const unzippedPath = await unzip(archivePath);

      if (selectedPlugin.info.installer) {
        const exePath = searchFiles(unzippedPath);
        const command =
          '"' +
          exePath[0][0] +
          '" ' +
          selectedPlugin.info.installArg
            .replace('"$instpath"', '$instpath')
            .replace('$instpath', '"' + instPath + '"'); // Prevent double quoting
        execSync(command);
      } else {
        const searchedFiles = searchFiles(unzippedPath);
        for (const filePath of searchedFiles) {
          fs.copySync(filePath[0], filePath[1]);
        }
      }
    } catch (e) {
      buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
      setTimeout(() => {
        enableButton();
      }, 3000);
      throw new Error('An error has occurred.');
    }

    let filesCount = 0;
    let existCount = 0;
    for (const file of selectedPlugin.info.files) {
      if (!file.isOptional) {
        filesCount++;
        if (fs.existsSync(path.join(instPath, file.filename))) {
          existCount++;
        }
      }
    }

    if (filesCount === existCount) {
      apmJson.addPlugin(instPath, selectedPlugin);
      await this.setPluginsList(instPath);

      buttonTransition.message(btn, 'インストール完了', 'success');
    } else {
      buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
    }

    setTimeout(() => {
      enableButton();
    }, 3000);
  },

  /**
   * Uninstalls a plugin to installation path.
   *
   * @param {HTMLButtonElement} btn - A HTMLElement of clicked button.
   * @param {string} instPath - An installation path.
   */
  uninstallPlugin: async function (btn, instPath) {
    const enableButton = buttonTransition.loading(btn);

    if (!instPath) {
      buttonTransition.message(
        btn,
        'インストール先フォルダを指定してください。',
        'danger'
      );
      setTimeout(() => {
        enableButton();
      }, 3000);
      throw new Error('An installation path is not selected.');
    }

    if (!selectedPlugin) {
      buttonTransition.message(btn, 'プラグインを選択してください。', 'danger');
      setTimeout(() => {
        enableButton();
      }, 3000);
      throw new Error('A plugin to install is not selected.');
    }

    for (const file of selectedPlugin.info.files) {
      fs.removeSync(path.join(instPath, file.filename));
    }

    let filesCount = 0;
    let existCount = 0;
    for (const file of selectedPlugin.info.files) {
      if (!file.isOptional) {
        filesCount++;
        if (!fs.existsSync(path.join(instPath, file.filename))) {
          existCount++;
        }
      }
    }

    if (filesCount === existCount) {
      apmJson.removePlugin(instPath, selectedPlugin);
      await this.setPluginsList(instPath);

      buttonTransition.message(btn, 'アンインストール完了', 'success');
    } else {
      buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
    }

    setTimeout(() => {
      enableButton();
    }, 3000);
  },
};
