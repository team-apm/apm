const { ipcRenderer } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const Store = require('electron-store');
const store = new Store();
const parser = require('fast-xml-parser');
const replaceText = require('../lib/replaceText');
const unzip = require('../lib/unzip');
const setting = require('../setting/setting');

let selectedPlugin;

/**
 * @param {string} pluginType - A list of plugin types.
 * @returns {string} Parsed plugin types.
 */
function parsePluginType(pluginType) {
  const typeArray = pluginType.split(' ');
  const result = [];
  for (const type of typeArray) {
    switch (type) {
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
    replaceText('plugin-' + detail, pluginData[detail]);
  }
  replaceText('plugin-type', parsePluginType(pluginData.type));
  replaceText('plugin-latest-version', pluginData.latestVersion);

  const a = document.createElement('a');
  a.innerText = pluginData.pageURL;
  a.href = pluginData.pageURL;
  const pageSpan = document.getElementById('plugin-page');
  while (pageSpan.firstChild) {
    pageSpan.removeChild(pageSpan.firstChild);
  }
  pageSpan.appendChild(a);
}

module.exports = {
  /**
   * Initializes plugin
   */
  initPlugin: function () {
    if (!store.has('installedVersion.plugin'))
      store.set('installedVersion.plugin', []);
  },

  /**
   * Returns an object parsed from plugins_list.xml.
   *
   * @returns {Promise.<object>} - A list of object parsed from plugins_list.xml.
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
        const xmlData = fs.readFileSync(pluginsListFile.path, 'utf-8');
        let pluginsInfo = {};
        const valid = parser.validate(xmlData);
        if (valid === true) {
          const options = {
            attributeNamePrefix: '$',
            // attrNodeName: 'attr', // default is 'false'
            textNodeName: '_',
            ignoreAttributes: false,
            // ignoreNameSpace: false,
            // allowBooleanAttributes: false,
            parseNodeValue: false,
            parseAttributeValue: false,
            trimValues: true,
            // cdataTagName: '__cdata', // default is 'false'
            // cdataPositionChar: '\\c',
            // parseTrueNumberOnly: false,
            arrayMode: true, // "strict"
            // stopNodes: ['parse-me-as-string'],
          };
          // optional (it'll return an object in case it's not valid)
          pluginsInfo = parser.parse(xmlData, options);
          for (const plugin of pluginsInfo.plugins[0].plugin) {
            if (typeof plugin.files[0].file === 'string') {
              plugin.files[0].file = [plugin.files[0].file];
            }
          }
        } else {
          throw valid;
        }
        xmlList[pluginRepo] = pluginsInfo;
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
    const tbody = pluginsTable.getElementsByTagName('tbody')[0];
    tbody.innerHTML = null;

    const plugins = [];
    for (const [pluginsRepo, pluginsInfo] of Object.entries(
      await this.getPluginsInfo()
    )) {
      for (const plugin of pluginsInfo.plugins[0].plugin) {
        plugin.repo = pluginsRepo;
        plugins.push(plugin);
      }
    }

    const relationList = [];
    for (let i = 0; i < plugins.length; i++) {
      const setA = [];
      for (const file of plugins[i].files[0].file) {
        if (typeof file === 'string') {
          setA.push(file);
        }
      }
      for (let j = i + 1; j < plugins.length; j++) {
        const setB = [];
        for (const file of plugins[j].files[0].file) {
          if (typeof file === 'string') {
            setB.push(file);
          }
        }

        if (setA.some((e) => setB.includes(e))) {
          relationList.push([i, j]);
        }
      }
    }

    const installedPlugins = store.get('installedVersion.plugin');
    for (const [i, plugin] of plugins.entries()) {
      const tr = document.createElement('tr');
      const name = document.createElement('td');
      const overview = document.createElement('td');
      const developer = document.createElement('td');
      const type = document.createElement('td');
      const latestVersion = document.createElement('td');
      const installedVersion = document.createElement('td');

      tr.classList.add('plugin-tr');
      tr.addEventListener('click', (event) => {
        showPluginDetail(plugin);
        selectedPlugin = plugin;
      });
      name.innerHTML = plugin.name;
      overview.innerHTML = plugin.overview;
      developer.innerHTML = plugin.developer;
      type.innerHTML = parsePluginType(plugin.type);
      latestVersion.innerHTML = plugin.latestVersion;

      if (
        installedPlugins.some(
          (i) => i.repo === plugin.repo && i.id === plugin.id
        )
      ) {
        let filesCount = 0;
        let existCount = 0;
        for (const file of plugin.files[0].file) {
          if (typeof file === 'string') {
            filesCount++;
            if (fs.existsSync(path.join(instPath, file))) {
              existCount++;
            }
          }
        }

        if (filesCount === existCount) {
          installedVersion.innerHTML = installedPlugins.find(
            (i) => i.repo === plugin.repo && i.id === plugin.id
          ).version;
        } else {
          installedVersion.innerHTML =
            '未インストール（ファイルの存在が確認できませんでした。）';
        }
      } else {
        let otherVersion = false;
        for (const rel of relationList) {
          if (rel.includes(i)) {
            const j = rel.filter((e) => e !== i)[0];
            if (
              installedPlugins.some(
                (i) => i.repo === plugins[j].repo && i.id === plugins[j].id
              )
            ) {
              otherVersion = true;
              break;
            }
          }
        }
        installedVersion.innerHTML = otherVersion
          ? '他バージョンがインストール済み'
          : '未インストール';
      }

      for (const td of [
        name,
        overview,
        developer,
        type,
        latestVersion,
        installedVersion,
      ]) {
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
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
    btn.setAttribute('disabled', '');
    const beforeHTML = btn.innerHTML;
    btn.innerHTML =
      '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>' +
      '<span class="visually-hidden">Loading...</span>';

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
    this.setPluginsList(instPath);

    overlay.classList.remove('show');
    overlay.style.zIndex = -1;

    btn.innerHTML = beforeHTML;
    btn.removeAttribute('disabled');
  },

  /**
   * Installs a plugin to installation path.
   *
   * @param {HTMLButtonElement} btn - A HTMLElement of clicked button.
   * @param {string} instPath - An installation path.
   */
  installPlugin: async function (btn, instPath) {
    btn.setAttribute('disabled', '');
    const beforeHTML = btn.innerHTML;
    btn.innerHTML =
      '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>' +
      '<span class="visually-hidden">Loading...</span>';

    if (!instPath) {
      if (btn.classList.contains('btn-primary')) {
        btn.classList.replace('btn-primary', 'btn-danger');
        setTimeout(() => {
          btn.classList.replace('btn-danger', 'btn-primary');
        }, 3000);
      }
      btn.innerHTML = 'インストール先フォルダを指定してください。';
      setTimeout(() => {
        btn.innerHTML = beforeHTML;
        btn.removeAttribute('disabled');
      }, 3000);
      throw new Error('An installation path is not selected.');
    }

    if (!selectedPlugin) {
      if (btn.classList.contains('btn-primary')) {
        btn.classList.replace('btn-primary', 'btn-danger');
        setTimeout(() => {
          btn.classList.replace('btn-danger', 'btn-primary');
        }, 3000);
      }
      btn.innerHTML = 'プラグインを選択してください。';
      setTimeout(() => {
        btn.innerHTML = beforeHTML;
        btn.removeAttribute('disabled');
      }, 3000);
      throw new Error('A plugin to install is not selected.');
    }

    const url = selectedPlugin.downloadURL;
    const archivePath = await ipcRenderer.invoke('open-browser', url, 'plugin');

    const searchFiles = (dirName) => {
      let result = [];
      const dirents = fs.readdirSync(dirName, {
        withFileTypes: true,
      });
      for (const dirent of dirents) {
        if (dirent.isDirectory()) {
          const childResult = searchFiles(path.join(dirName, dirent.name));
          result = result.concat(childResult);
        } else {
          if (selectedPlugin.installer) {
            if (dirent.name === selectedPlugin.installer) {
              result.push([path.join(dirName, dirent.name)]);
              break;
            }
          } else {
            for (const file of selectedPlugin.files[0].file) {
              if (typeof file === 'string') {
                if (dirent.name === path.basename(file)) {
                  result.push([
                    path.join(dirName, dirent.name),
                    path.join(instPath, file),
                  ]);
                  break;
                }
              } else if (file.$optional === 'true') {
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

      if (selectedPlugin.installer) {
        const exePath = searchFiles(unzippedPath);
        const command =
          '"' +
          exePath[0][0] +
          '" ' +
          selectedPlugin.installArg
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
      if (btn.classList.contains('btn-primary')) {
        btn.classList.replace('btn-primary', 'btn-danger');
        setTimeout(() => {
          btn.classList.replace('btn-danger', 'btn-primary');
        }, 3000);
      }
      btn.innerHTML = 'エラーが発生しました。';
    }

    let filesCount = 0;
    let existCount = 0;
    for (const file of selectedPlugin.files[0].file) {
      if (typeof file === 'string') {
        filesCount++;
        if (fs.existsSync(path.join(instPath, file))) {
          existCount++;
        }
      }
    }

    if (filesCount === existCount) {
      const installedPlugins = store.get('installedVersion.plugin');
      installedPlugins.push({
        id: selectedPlugin.id,
        repo: selectedPlugin.repo,
        version: selectedPlugin.latestVersion,
      });
      store.set('installedVersion.plugin', installedPlugins);
      this.setPluginsList(instPath);

      if (btn.classList.contains('btn-primary')) {
        btn.classList.replace('btn-primary', 'btn-success');
        setTimeout(() => {
          btn.classList.replace('btn-success', 'btn-primary');
        }, 3000);
      }
      btn.innerHTML = 'インストール完了';
    } else {
      if (btn.classList.contains('btn-primary')) {
        btn.classList.replace('btn-primary', 'btn-danger');
        setTimeout(() => {
          btn.classList.replace('btn-danger', 'btn-primary');
        }, 3000);
      }
      btn.innerHTML = 'エラーが発生しました。';
    }

    setTimeout(() => {
      btn.innerHTML = beforeHTML;
      btn.removeAttribute('disabled');
    }, 3000);
  },

  /**
   * Uninstalls a plugin to installation path.
   *
   * @param {HTMLButtonElement} btn - A HTMLElement of clicked button.
   * @param {string} instPath - An installation path.
   */
  uninstallPlugin: async function (btn, instPath) {
    btn.setAttribute('disabled', '');
    const beforeHTML = btn.innerHTML;
    btn.innerHTML =
      '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>' +
      '<span class="visually-hidden">Loading...</span>';

    if (!instPath) {
      if (btn.classList.contains('btn-primary')) {
        btn.classList.replace('btn-primary', 'btn-danger');
        setTimeout(() => {
          btn.classList.replace('btn-danger', 'btn-primary');
        }, 3000);
      }
      btn.innerHTML = 'インストール先フォルダを指定してください。';
      setTimeout(() => {
        btn.innerHTML = beforeHTML;
        btn.removeAttribute('disabled');
      }, 3000);
      throw new Error('An installation path is not selected.');
    }

    if (!selectedPlugin) {
      if (btn.classList.contains('btn-primary')) {
        btn.classList.replace('btn-primary', 'btn-danger');
        setTimeout(() => {
          btn.classList.replace('btn-danger', 'btn-primary');
        }, 3000);
      }
      btn.innerHTML = 'プラグインを選択してください。';
      setTimeout(() => {
        btn.innerHTML = beforeHTML;
        btn.removeAttribute('disabled');
      }, 3000);
      throw new Error('A plugin to install is not selected.');
    }

    for (const file of selectedPlugin.files[0].file) {
      if (typeof file === 'string') {
        fs.removeSync(path.join(instPath, file));
      } else if (
        file !== null &&
        typeof file === 'object' &&
        !Array.isArray(file)
      ) {
        fs.removeSync(path.join(instPath, file._));
      }
    }

    let filesCount = 0;
    let existCount = 0;
    for (const file of selectedPlugin.files[0].file) {
      if (typeof file === 'string') {
        filesCount++;
        if (!fs.existsSync(path.join(instPath, file))) {
          existCount++;
        }
      }
    }

    if (filesCount === existCount) {
      const installedPlugins = store.get('installedVersion.plugin');
      store.set(
        'installedVersion.plugin',
        installedPlugins.filter(
          (i) => !(i.repo === selectedPlugin.repo && i.id === selectedPlugin.id)
        )
      );
      this.setPluginsList(instPath);

      if (btn.classList.contains('btn-primary')) {
        btn.classList.replace('btn-primary', 'btn-success');
        setTimeout(() => {
          btn.classList.replace('btn-success', 'btn-primary');
        }, 3000);
      }
      btn.innerHTML = 'アンインストール完了';
    } else {
      if (btn.classList.contains('btn-primary')) {
        btn.classList.replace('btn-primary', 'btn-danger');
        setTimeout(() => {
          btn.classList.replace('btn-danger', 'btn-primary');
        }, 3000);
      }
      btn.innerHTML = 'エラーが発生しました。';
    }

    setTimeout(() => {
      btn.innerHTML = beforeHTML;
      btn.removeAttribute('disabled');
    }, 3000);
  },
};
