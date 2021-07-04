const { ipcRenderer } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const Store = require('electron-store');
const store = new Store();
const parser = require('fast-xml-parser');
const replaceText = require('../lib/replaceText');
const unzip = require('../lib/unzip');

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
  pluginsListXmlUrl:
    'http://halshusato.starfree.jp/ato_lash/apm/data/plugins_list.xml',

  /**
   * Returns an object parsed from core.xml.
   *
   * @returns {object} - An object parsed from core.xml.
   */
  getPluginsInfo: async function () {
    const pluginsListFile = await ipcRenderer.invoke(
      'exists-temp-file',
      'plugin/plugins_list.xml'
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
      } else {
        throw valid;
      }
      return pluginsInfo;
    } else {
      throw new Error('The version file does not exist.');
    }
  },

  /**
   * Sets versions of each program in selects.
   *
   * @param {string} instPath - An installation path.
   */
  setPluginsList: async function (instPath) {
    const pluginsTable = document.getElementById('plugins-table');
    const tbody = pluginsTable.getElementsByTagName('tbody')[0];
    tbody.innerHTML = null;

    const pluginsInfo = await this.getPluginsInfo();
    if (pluginsInfo) {
      for (const plugin of pluginsInfo.plugins[0].plugin) {
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

        if (store.has('installedVersion.' + plugin.id)) {
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
            installedVersion.innerHTML = store.get(
              'installedVersion.' + plugin.id,
              '未インストール'
            );
          } else {
            installedVersion.innerHTML =
              '未インストール（ファイルの存在が確認できませんでした。）';
          }
        } else {
          installedVersion.innerHTML = '未インストール';
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

    await ipcRenderer.invoke(
      'download',
      this.pluginsListXmlUrl,
      true,
      'plugin'
    );
    this.setPluginsList(instPath);

    btn.removeAttribute('disabled');
    btn.innerHTML = beforeHTML;

    overlay.classList.remove('show');
    overlay.style.zIndex = -1;
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
        btn.removeAttribute('disabled');
        btn.innerHTML = beforeHTML;
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
        btn.removeAttribute('disabled');
        btn.innerHTML = beforeHTML;
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
          selectedPlugin.installArg.replace('$instpath', '"' + instPath + '"');
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
      store.set(
        'installedVersion.' + selectedPlugin.id,
        selectedPlugin.latestVersion
      );
      this.setPluginsList(instPath);
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
      btn.removeAttribute('disabled');
      btn.innerHTML = beforeHTML;
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
        btn.removeAttribute('disabled');
        btn.innerHTML = beforeHTML;
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
        btn.removeAttribute('disabled');
        btn.innerHTML = beforeHTML;
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
      store.delete('installedVersion.' + selectedPlugin.id);
      this.setPluginsList(instPath);
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
      btn.removeAttribute('disabled');
      btn.innerHTML = beforeHTML;
    }, 3000);
  },
};
