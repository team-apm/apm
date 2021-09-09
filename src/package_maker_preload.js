const { ipcRenderer } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const Parser = require('fast-xml-parser').j2xParser;
const Sortable = require('sortablejs');
const ClipboardJS = require('clipboard');
const unzip = require('./lib/unzip');
const buttonTransition = require('./lib/buttonTransition');

const imageExtention = [
  '.png',
  '.jpg',
  '.gif',
  '.tiff',
  '.tif',
  '.webp',
  '.svg',
];
const searchFiles = (dirName, directory = false, ignoreExtention = []) => {
  const dirents = fs.readdirSync(dirName, {
    withFileTypes: true,
  });
  console.log(ignoreExtention);
  return [].concat(
    directory
      ? [dirName]
      : dirents
          .filter((i) => i.isFile())
          .filter((i) => !ignoreExtention.includes(path.extname(i.name)))
          .map((i) => path.join(dirName, i.name)),
    dirents
      .filter((i) => i.isDirectory())
      .flatMap((i) =>
        searchFiles(path.join(dirName, i.name), directory, ignoreExtention)
      )
  );
};

const pathRelated = (pathA, pathB) => {
  const isParent = (parent, child) => {
    const relative = path.relative(parent, child);
    return relative && relative !== '' && !relative.startsWith('..');
  };
  return isParent(pathA, pathB) || isParent(pathB, pathA);
};

window.addEventListener('load', () => {
  const xmlId = document.getElementById('xml-id');
  const xmlName = document.getElementById('xml-name');
  const xmlOverview = document.getElementById('xml-overview');
  const xmlDescription = document.getElementById('xml-description');
  const xmlDeveloper = document.getElementById('xml-developer');
  const xmlLatestVersion = document.getElementById('xml-latest-version');
  const xmlPageURL = document.getElementById('xml-page-url');
  const xmlDownloadURL = document.getElementById('xml-download-url');
  const xmlTexts = [
    xmlId,
    xmlName,
    xmlOverview,
    xmlDescription,
    xmlDeveloper,
    xmlLatestVersion,
    xmlPageURL,
    xmlDownloadURL,
  ];

  const xlmIdValidate = document.getElementById('xml-id-validate');
  const xlmNameValidate = document.getElementById('xml-name-validate');
  const xlmOverviewValidate = document.getElementById('xml-overview-validate');

  const xmlDownloadURLBtn = document.getElementById('xml-download-url-button');
  const clearTextBtn = document.getElementById('clear-text-button');

  const listDownload = document.getElementById('list-download');
  const listAviutl = document.getElementById('list-aviutl');
  const listPlugins = document.getElementById('list-plugins');
  const listScript = document.getElementById('list-script');

  const output = document.getElementById('output-xml');

  const clearList = () => {
    listDownload.innerHTML = null;
    [...listAviutl.children]
      .filter((e) => e.getAttribute('data-id') !== 'exclude')
      .forEach((e) => e.parentNode.removeChild(e));
    listPlugins.innerHTML = null;
    listScript.innerHTML = null;
  };

  const makeXML = () => {
    xlmIdValidate.innerText = xmlId.value.match(/^[A-Za-z0-9]*$/)
      ? ''
      : 'idは半角英数字である必要があります';
    xlmNameValidate.innerText =
      `${[...xmlName.value].length}/25文字` +
      ([...xmlName.value].length <= 25
        ? ''
        : ' 名前は25文字以内である必要があります');
    xlmOverviewValidate.innerText =
      `${[...xmlOverview.value].length}/35文字` +
      ([...xmlOverview.value].length <= 35
        ? ''
        : ' 概要は35文字以内である必要があります');

    output.innerHTML = null;
    const files = []
      .concat(
        sortAviutl
          .toArray()
          .filter((i) => i !== 'exclude')
          .map((i) => [path.dirname(i), path.basename(i)]),
        sortPlugins
          .toArray()
          .map((i) => [
            path.dirname(i),
            path.join('plugins', path.basename(i)),
          ]),
        sortScript
          .toArray()
          .map((i) => [path.dirname(i), path.join('script', path.basename(i))])
      )
      .map((i) => [i[0].replaceAll('\\', '/'), i[1].replaceAll('\\', '/')])
      .map((i) => {
        const dirItem = i[0];
        let baseItem = i[1];
        let isDirectory = false;
        if (baseItem.includes('?')) {
          baseItem = baseItem.replace('?', '');
          isDirectory = true;
        }
        const ret = { '#text': baseItem };
        ret['@_tmp'] = ''; // to avoid parser bugs
        if (dirItem !== '.') ret['@_archivePath'] = dirItem;
        if (isDirectory) ret['@_directory'] = true;
        return ret;
      });
    const parser = new Parser({ ignoreAttributes: false, format: true });

    output.innerText = parser
      .parse({
        package: {
          id: xmlId.value,
          name: xmlName.value,
          overview: xmlOverview.value,
          description: xmlDescription.value,
          developer: xmlDeveloper.value,
          pageURL: xmlPageURL.value,
          downloadURL: xmlDownloadURL.value,
          latestVersion: xmlLatestVersion.value,
          files: {
            file: files,
          },
        },
      })
      .trim()
      .replaceAll(' tmp=""', ''); // to avoid parser bugs
  };

  // input event
  xmlTexts.forEach((e) => {
    e.addEventListener('input', makeXML);
  });

  // click event
  new ClipboardJS('.btn-copy');

  clearTextBtn.addEventListener('click', async (event) => {
    xmlTexts.forEach((e) => {
      e.value = '';
    });
    clearList();
    makeXML();
  });

  xmlDownloadURLBtn.addEventListener('click', async (event) => {
    const enableButton = buttonTransition.loading(xmlDownloadURLBtn);

    clearList();

    if (xmlDownloadURL.value === '') {
      buttonTransition.message(
        xmlDownloadURLBtn,
        'URLを入力してください。',
        'info'
      );
      setTimeout(() => {
        enableButton();
      }, 3000);
      return;
    }

    const archivePath = await ipcRenderer.invoke(
      'open-browser',
      xmlDownloadURL.value,
      'package'
    );
    if (archivePath === 'close') {
      buttonTransition.message(
        xmlDownloadURLBtn,
        'ダウンロードがキャンセルされました。',
        'info'
      );
      setTimeout(() => {
        enableButton();
      }, 3000);
      return;
    }

    let unzippedPath;
    try {
      unzippedPath = await unzip(archivePath);
      execSync(`start "" "${unzippedPath}"`);
    } catch (e) {
      buttonTransition.message(
        xmlDownloadURLBtn,
        'エラーが発生しました。',
        'danger'
      );
      setTimeout(() => {
        enableButton();
      }, 3000);
      throw e;
    }

    // folder
    searchFiles(unzippedPath, true)
      .filter((i) => i !== unzippedPath)
      .map((i) => path.relative(unzippedPath, i).replaceAll('\\', '/'))
      .forEach((f) => {
        const entry = document.createElement('div');
        entry.innerText = f;
        entry.setAttribute('data-id', f + '?');
        entry.classList.add('list-group-item');
        if (['plugins', 'script'].includes(path.basename(f))) {
          entry.classList.add('list-group-item-secondary');
          entry.classList.add('ignore-elements');
        } else {
          entry.classList.add('list-group-item-warning');
        }

        listDownload.appendChild(entry);
      });

    // file
    searchFiles(unzippedPath, false, imageExtention)
      .filter((i) => i !== unzippedPath)
      .map((i) => path.relative(unzippedPath, i).replaceAll('\\', '/'))
      .forEach((f) => {
        const entry = document.createElement('div');
        entry.innerText = f;
        entry.setAttribute('data-id', f);
        entry.classList.add('list-group-item');

        listDownload.appendChild(entry);
      });

    setTimeout(() => {
      enableButton();
    }, 3000);
  });

  // sortable list
  new Sortable(listDownload, {
    group: 'nested',
    animation: 150,
    filter: '.ignore-elements',
    fallbackOnBody: true,
    sort: false,
    onRemove: (event) => {
      const item = event.item;
      const itemPath = item.getAttribute('data-id').replace('?', '');
      for (const node of listDownload.children) {
        const nodePath = node.getAttribute('data-id').replace('?', '');
        if (pathRelated(nodePath, itemPath)) {
          node.classList.add('list-group-item-dark');
          node.classList.add('ignore-elements');
        }
      }
    },
    onAdd: (event) => {
      const item = event.item;
      const itemPath = item.getAttribute('data-id').replace('?', '');
      for (const node of listDownload.children) {
        const nodePath = node.getAttribute('data-id').replace('?', '');
        if (pathRelated(nodePath, itemPath)) {
          node.classList.remove('list-group-item-dark');
          if (!['plugins', 'script'].includes(path.basename(nodePath))) {
            node.classList.remove('ignore-elements');
          }
        }
      }
    },
  });

  const [sortAviutl, sortPlugins, sortScript] = [
    listAviutl,
    listPlugins,
    listScript,
  ].map(
    (i) =>
      new Sortable(i, {
        group: 'nested',
        animation: 150,
        filter: '.ignore-elements',
        fallbackOnBody: true,
        invertSwap: true,
        invertedSwapThreshold: 0.6,
        emptyInsertThreshold: 8,
        onSort: makeXML,
      })
  );

  // init
  makeXML();
});
