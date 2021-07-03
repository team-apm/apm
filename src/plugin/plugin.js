const { ipcRenderer } = require('electron');
const fs = require('fs-extra');
const parser = require('fast-xml-parser');
const replaceText = require('../lib/replaceText');

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
  replaceText('plugin-version', pluginData.latestVersion);

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
   */
  setPluginsList: async function () {
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
        const version = document.createElement('td');

        tr.classList.add('plugin-tr');
        tr.addEventListener('click', (event) => {
          showPluginDetail(plugin);
        });
        name.innerHTML = plugin.name;
        overview.innerHTML = plugin.overview;
        developer.innerHTML = plugin.developer;
        type.innerHTML = parsePluginType(plugin.type);
        version.innerHTML = plugin.latestVersion;

        for (const td of [name, overview, developer, type, version]) {
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
    }
  },

  /**
   * Checks the plugins list.
   *
   * @param {HTMLElement} btn - A HTMLElement of button element.
   * @param {HTMLElement} overlay - A overlay of plugins list.
   */
  checkPluginsList: async function (btn, overlay) {
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
    this.setPluginsList();

    btn.removeAttribute('disabled');
    btn.innerHTML = beforeHTML;

    overlay.classList.remove('show');
    overlay.style.zIndex = -1;
  },
};
