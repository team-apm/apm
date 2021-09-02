const { ipcRenderer } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const Store = require('electron-store');
const store = new Store();
const List = require('list.js');
const parser = require('fast-xml-parser');
const replaceText = require('../lib/replaceText');
const unzip = require('../lib/unzip');
const setting = require('../setting/setting');
const buttonTransition = require('../lib/buttonTransition');

let selectedScript;
let listJS;

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
   * Initializes script
   */
  initScript: function () {
    if (!store.has('installedVersion.script'))
      store.set('installedVersion.script', []);
  },

  /**
   * Returns an object parsed from scripts_list.xml.
   *
   * @returns {Promise.<object>} - A list of object parsed from scripts_list.xml.
   */
  getScriptsInfo: async function () {
    const xmlList = {};

    for (const scriptRepo of setting.getScriptsDataUrl()) {
      const scriptsListFile = await ipcRenderer.invoke(
        'exists-temp-file',
        'script/scripts_list.xml',
        scriptRepo
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
          for (const script of scriptsInfo.scripts[0].script) {
            if (typeof script.files[0].file === 'string') {
              script.files[0].file = [script.files[0].file];
            }
          }
        } else {
          throw valid;
        }
        xmlList[scriptRepo] = scriptsInfo;
      }
    }
    return xmlList;
  },

  /**
   * Sets rows of each script in the table.
   *
   * @param {string} instPath - An installation path.
   */
  setScriptsList: async function (instPath) {
    const scriptsTable = document.getElementById('scripts-table');
    const thead = scriptsTable.getElementsByTagName('thead')[0];
    const tbody = scriptsTable.getElementsByTagName('tbody')[0];
    tbody.innerHTML = null;
    const bottomTbody = scriptsTable.getElementsByTagName('tbody')[1];
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
    const scripts = [];
    for (const [scriptsRepo, scriptsInfo] of Object.entries(
      await this.getScriptsInfo()
    )) {
      for (const script of scriptsInfo.scripts[0].script) {
        script.repo = scriptsRepo;
        scripts.push(script);
      }
    }

    const installedScripts = store.get('installedVersion.script');

    const getExistingFiles = () => {
      const regex = /^(?!exedit).*\.(anm|obj|cam|tra|scn)$/;
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
    for (const script of scripts) {
      if (
        installedScripts.some(
          (i) => i.repo === script.repo && i.id === script.id
        )
      ) {
        for (const file of script.files[0].file) {
          if (typeof file === 'string') {
            if (manualFiles.includes(file)) {
              manualFiles = manualFiles.filter((ef) => ef !== file);
            }
          }
          if (file.$optional !== 'true' && file.$directory === 'true') {
            manualFiles = manualFiles.filter((ef) => !ef.startsWith(file._));
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

    for (const script of scripts) {
      const [
        tr,
        name,
        overview,
        developer,
        type,
        latestVersion,
        installedVersion,
      ] = makeTrFromArray(columns);
      tr.classList.add('script-tr');
      tr.addEventListener('click', (event) => {
        showScriptDetail(script);
        selectedScript = script;
        for (const tmptr of tbody.getElementsByTagName('tr')) {
          tmptr.classList.remove('table-secondary');
        }
        tr.classList.add('table-secondary');
      });
      name.innerHTML = script.name;
      overview.innerHTML = script.overview;
      developer.innerHTML = script.developer;
      type.innerHTML = parseScriptType(script.type);
      latestVersion.innerHTML = script.latestVersion;

      if (
        installedScripts.some(
          (i) => i.repo === script.repo && i.id === script.id
        )
      ) {
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
          installedVersion.innerHTML = installedScripts.find(
            (i) => i.repo === script.repo && i.id === script.id
          ).version;
        } else {
          installedVersion.innerHTML =
            '未インストール（ファイルの存在が確認できませんでした。）';
        }
      } else {
        let otherVersion = false;
        let otherManualVersion = false;
        for (const file of script.files[0].file) {
          if (typeof file === 'string') {
            if (existingFiles.includes(file)) otherVersion = true;
            if (manualFiles.includes(file)) otherManualVersion = true;
          }
        }
        installedVersion.innerHTML = otherManualVersion
          ? '手動インストール済み'
          : otherVersion
          ? '他バージョンがインストール済み'
          : '未インストール';
      }

      tbody.appendChild(tr);
    }

    // list manually added scripts
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
      tr.classList.add('script-tr');
      name.innerHTML = ef;
      overview.innerHTML = '手動で追加されたスクリプト';
      developer.innerHTML = '';
      type.innerHTML = '';
      latestVersion.innerHTML = '';
      installedVersion.innerHTML = '';
      bottomTbody.appendChild(tr);
    }

    // sorting and filtering
    if (typeof listJS === 'undefined') {
      listJS = new List('scripts', { valueNames: columns });
    } else {
      listJS.reIndex();
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
    const enableButton = buttonTransition.loading(btn);

    overlay.style.zIndex = 1000;
    overlay.classList.add('show');

    for (const scriptRepo of setting.getScriptsDataUrl()) {
      await ipcRenderer.invoke(
        'download',
        scriptRepo,
        true,
        'script',
        scriptRepo
      );
    }
    this.setScriptsList(instPath);

    overlay.classList.remove('show');
    overlay.style.zIndex = -1;

    enableButton();
  },

  /**
   * Installs a script to installation path.
   *
   * @param {HTMLButtonElement} btn - A HTMLElement of clicked button.
   * @param {string} instPath - An installation path.
   */
  installScript: async function (btn, instPath) {
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

    if (!selectedScript) {
      buttonTransition.message(btn, 'プラグインを選択してください。', 'danger');
      setTimeout(() => {
        enableButton();
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
      buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
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
      const installedScripts = store.get('installedVersion.script');
      installedScripts.push({
        id: selectedScript.id,
        repo: selectedScript.repo,
        version: selectedScript.latestVersion,
      });
      store.set('installedVersion.script', installedScripts);
      this.setScriptsList(instPath);

      buttonTransition.message(btn, 'インストール完了', 'success');
    } else {
      buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
    }

    setTimeout(() => {
      enableButton();
    }, 3000);
  },

  /**
   * Uninstalls a script to installation path.
   *
   * @param {HTMLButtonElement} btn - A HTMLElement of clicked button.
   * @param {string} instPath - An installation path.
   */
  uninstallScript: async function (btn, instPath) {
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

    if (!selectedScript) {
      buttonTransition.message(btn, 'プラグインを選択してください。', 'danger');
      setTimeout(() => {
        enableButton();
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
      const installedScripts = store.get('installedVersion.script');
      store.set(
        'installedVersion.script',
        installedScripts.filter(
          (i) => !(i.repo === selectedScript.repo && i.id === selectedScript.id)
        )
      );
      this.setScriptsList(instPath);

      buttonTransition.message(btn, 'アンインストール完了', 'success');
    } else {
      buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
    }

    setTimeout(() => {
      enableButton();
    }, 3000);
  },
};
