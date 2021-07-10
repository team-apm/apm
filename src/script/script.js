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

let selectedScript;

/**
 * @param {string} scriptType - A list of script types.
 * @returns {string} Parsed script types.
 */
function parseScriptType(scriptType) {
  const typeArray = scriptType.split(' ');
  const result = [];
  for (const type of typeArray) {
    switch (type) {
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
      case 'tracking':
        result.push('トラッキングバー');
        break;
      default:
        result.push('不明');
        break;
    }
  }
  return result.toString();
}

/**
 * Show script's details.
 *
 * @param {object} scriptData - An object of script's details.
 */
function showScriptDetail(scriptData) {
  for (const detail of ['name', 'overview', 'description', 'developer']) {
    replaceText('script-' + detail, scriptData[detail]);
  }
  replaceText('script-type', parseScriptType(scriptData.type));
  replaceText('script-latest-version', scriptData.latestVersion);

  const a = document.createElement('a');
  a.innerText = scriptData.pageURL;
  a.href = scriptData.pageURL;
  const pageSpan = document.getElementById('script-page');
  while (pageSpan.firstChild) {
    pageSpan.removeChild(pageSpan.firstChild);
  }
  pageSpan.appendChild(a);
}

module.exports = {
  /**
   * Returns a scripts list xml URL.
   *
   * @returns {string} - A plugins list xml URL.
   */
  getScriptsListXmlUrl: function () {
    const dataUrl = setting.getDataUrl();
    return path.join(dataUrl, 'scripts_list.xml');
  },

  /**
   * Returns an object parsed from scripts_list.xml.
   *
   * @returns {object} - An object parsed from scripts_list.xml.
   */
  getScriptsInfo: async function () {
    const scriptsListFile = await ipcRenderer.invoke(
      'exists-temp-file',
      'script/scripts_list.xml'
    );
    if (scriptsListFile.exists) {
      const xmlData = fs.readFileSync(scriptsListFile.path, 'utf-8');
      let scriptsInfo = {};
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
        scriptsInfo = parser.parse(xmlData, options);
      } else {
        throw valid;
      }
      return scriptsInfo;
    } else {
      throw new Error('The version file does not exist.');
    }
  },

  /**
   * Sets rows of each script in the table.
   *
   * @param {string} instPath - An installation path.
   */
  setScriptsList: async function (instPath) {
    const scriptsTable = document.getElementById('scripts-table');
    const tbody = scriptsTable.getElementsByTagName('tbody')[0];
    tbody.innerHTML = null;

    const scriptsInfo = await this.getScriptsInfo();
    if (scriptsInfo) {
      for (const script of scriptsInfo.scripts[0].script) {
        const tr = document.createElement('tr');
        const name = document.createElement('td');
        const overview = document.createElement('td');
        const developer = document.createElement('td');
        const type = document.createElement('td');
        const latestVersion = document.createElement('td');
        const installedVersion = document.createElement('td');

        tr.classList.add('script-tr');
        tr.addEventListener('click', (event) => {
          showScriptDetail(script);
          selectedScript = script;
        });
        name.innerHTML = script.name;
        overview.innerHTML = script.overview;
        developer.innerHTML = script.developer;
        type.innerHTML = parseScriptType(script.type);
        latestVersion.innerHTML = script.latestVersion;

        if (store.has('installedVersion.script.' + script.id)) {
          let filesCount = 0;
          let existCount = 0;
          for (const file of script.files[0].file) {
            if (typeof file === 'string') {
              filesCount++;
              if (fs.existsSync(path.join(instPath, file))) {
                existCount++;
              }
            }
          }

          if (filesCount === existCount) {
            installedVersion.innerHTML = store.get(
              'installedVersion.script.' + script.id,
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
   * Checks the scripts list.
   *
   * @param {HTMLButtonElement} btn - A HTMLElement of button element.
   * @param {HTMLDivElement} overlay - A overlay of scripts list.
   * @param {string} instPath - An installation path.
   */
  checkScriptsList: async function (btn, overlay, instPath) {
    btn.setAttribute('disabled', '');
    const beforeHTML = btn.innerHTML;
    btn.innerHTML =
      '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>' +
      '<span class="visually-hidden">Loading...</span>';

    overlay.style.zIndex = 1000;
    overlay.classList.add('show');

    await ipcRenderer.invoke(
      'download',
      this.getScriptsListXmlUrl(),
      true,
      'script'
    );
    this.setScriptsList(instPath);

    overlay.classList.remove('show');
    overlay.style.zIndex = -1;

    btn.innerHTML = beforeHTML;
    btn.removeAttribute('disabled');
  },

  /**
   * Installs a script to installation path.
   *
   * @param {HTMLButtonElement} btn - A HTMLElement of clicked button.
   * @param {string} instPath - An installation path.
   */
  installScript: async function (btn, instPath) {
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

    if (!selectedScript) {
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
      throw new Error('A script to install is not selected.');
    }

    const url = selectedScript.downloadURL;
    const archivePath = await ipcRenderer.invoke('open-browser', url, 'script');

    const searchFiles = (dirName) => {
      let result = [];
      const dirents = fs.readdirSync(dirName, {
        withFileTypes: true,
      });
      for (const dirent of dirents) {
        if (dirent.isDirectory()) {
          for (const file of selectedScript.files[0].file) {
            if (file.$optional !== 'true' && file.$directory === 'true') {
              if (dirent.name === path.basename(file._)) {
                result.push([
                  path.join(dirName, dirent.name),
                  path.join(instPath, file._),
                ]);
                break;
              }
            }
          }
          const childResult = searchFiles(path.join(dirName, dirent.name));
          result = result.concat(childResult);
        } else {
          if (selectedScript.installer) {
            if (dirent.name === selectedScript.installer) {
              result.push([path.join(dirName, dirent.name)]);
              break;
            }
          } else {
            for (const file of selectedScript.files[0].file) {
              if (typeof file === 'string') {
                if (dirent.name === path.basename(file)) {
                  result.push([
                    path.join(dirName, dirent.name),
                    path.join(instPath, file),
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

      if (selectedScript.installer) {
        const exePath = searchFiles(unzippedPath);
        const command =
          '"' +
          exePath[0][0] +
          '" ' +
          selectedScript.installArg.replace('$instpath', '"' + instPath + '"');
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
    for (const file of selectedScript.files[0].file) {
      if (typeof file === 'string') {
        filesCount++;
        if (fs.existsSync(path.join(instPath, file))) {
          existCount++;
        }
      }
    }

    if (filesCount === existCount) {
      store.set(
        'installedVersion.script.' + selectedScript.id,
        selectedScript.latestVersion
      );
      this.setScriptsList(instPath);

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
   * Uninstalls a script to installation path.
   *
   * @param {HTMLButtonElement} btn - A HTMLElement of clicked button.
   * @param {string} instPath - An installation path.
   */
  uninstallScript: async function (btn, instPath) {
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

    if (!selectedScript) {
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
      throw new Error('A script to install is not selected.');
    }

    for (const file of selectedScript.files[0].file) {
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
    for (const file of selectedScript.files[0].file) {
      if (typeof file === 'string') {
        filesCount++;
        if (!fs.existsSync(path.join(instPath, file))) {
          existCount++;
        }
      }
    }

    if (filesCount === existCount) {
      store.delete('installedVersion.script.' + selectedScript.id);
      this.setScriptsList(instPath);

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
