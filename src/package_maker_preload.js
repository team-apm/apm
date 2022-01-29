const { ipcRenderer } = require('electron');
const log = require('electron-log');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const { XMLBuilder } = require('fast-xml-parser');
const { Sortable } = require('sortablejs');
const ClipboardJS = require('clipboard/dist/clipboard.min');
const unzip = require('./lib/unzip');
const buttonTransition = require('./lib/buttonTransition');

log.catchErrors({
  onError: () => {
    ipcRenderer.invoke(
      'open-err-dialog',
      'エラー',
      `予期しないエラーが発生しました。\nログファイル: ${
        log.transports.file.getFile().path
      }`
    );
  },
});

const builder = new XMLBuilder({ ignoreAttributes: false, format: true });

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
  const xmlOriginalDeveloper = document.getElementById(
    'xml-original-developer'
  );
  const xmlLatestVersion = document.getElementById('xml-latest-version');
  const xmlPageURL = document.getElementById('xml-page-url');
  const xmlDownloadURL = document.getElementById('xml-download-url');
  const xmlDownloadMirrorURL = document.getElementById(
    'xml-download-mirror-url'
  );
  const xmlInstaller = document.getElementById('xml-installer');
  const xmlInstallArg = document.getElementById('xml-install-arg');
  const xmlDependencies = document.getElementById('xml-dependencies');
  const xmlTexts = [
    xmlId,
    xmlName,
    xmlOverview,
    xmlDescription,
    xmlDeveloper,
    xmlOriginalDeveloper,
    xmlLatestVersion,
    xmlPageURL,
    xmlDownloadURL,
    xmlDownloadMirrorURL,
    xmlInstaller,
    xmlInstallArg,
    xmlDependencies,
  ];

  const xmlIdValidate = document.getElementById('xml-id-validate');
  const xmlNameValidate = document.getElementById('xml-name-validate');
  const xmlOverviewValidate = document.getElementById('xml-overview-validate');

  const xmlDownloadURLBtn = document.getElementById('xml-download-url-button');
  const clearTextBtn = document.getElementById('clear-text-button');

  const xmlInstallerSwitch = document.getElementById('xml-installer-switch');
  const xmlIntegritySwitch = document.getElementById('xml-integrity-switch');

  const listDownload = document.getElementById('list-download');
  const listAviutl = document.getElementById('list-aviutl');
  const listPlugins = document.getElementById('list-plugins');
  const listScript = document.getElementById('list-script');

  const output = document.getElementById('output-xml');

  const clearList = () => {
    listDownload.innerHTML = null;
    [...listAviutl.children]
      .filter((e) => e.dataset.id !== 'exclude')
      .forEach((e) => e.parentNode.removeChild(e));
    listPlugins.innerHTML = null;
    listScript.innerHTML = null;
  };

  const clearText = () => {
    xmlTexts.forEach((e) => {
      e.value = '';
    });
    xmlInstallArg.value = '"$instpath"';
    clearList();
  };

  const collapseInstallerElement = () => {
    [xmlInstaller, xmlInstallArg].forEach((e) => {
      e.parentNode.parentNode.style.display = xmlInstallerSwitch.checked
        ? ''
        : 'none';
    });
  };

  const makeXML = () => {
    xmlIdValidate.innerText = xmlId.value.match(/^[A-Za-z0-9]+\/[A-Za-z0-9]+$/)
      ? ''
      : 'idは"{作者名(半角英数)}/{プラグイン名(半角英数)}"の形式です';
    xmlNameValidate.innerText =
      `${[...xmlName.value].length}/25文字` +
      ([...xmlName.value].length <= 25
        ? ''
        : ' 名前は25文字以内である必要があります');
    xmlOverviewValidate.innerText =
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
        if (dirItem !== '.' && !xmlInstallerSwitch.checked)
          ret['@_archivePath'] = dirItem;
        if (isDirectory) ret['@_directory'] = true;
        return ret;
      });

    const xmlObject = {
      package: {
        id: xmlId.value,
        name: xmlName.value,
        overview: xmlOverview.value,
        description: xmlDescription.value,
        developer: xmlDeveloper.value,
        originalDeveloper: xmlOriginalDeveloper.value
          ? xmlOriginalDeveloper.value
          : undefined,
        dependencies: xmlDependencies.value
          ? {
              dependency: xmlDependencies.value.split(' '),
            }
          : undefined,
        pageURL: xmlPageURL.value,
        downloadURL: xmlDownloadURL.value,
        downloadMirrorURL: xmlDownloadMirrorURL.value
          ? xmlDownloadMirrorURL.value
          : undefined,
        latestVersion: xmlLatestVersion.value,
        installer: xmlInstallerSwitch.checked ? xmlInstaller.value : undefined,
        installArg: xmlInstallerSwitch.checked
          ? xmlInstallArg.value
          : undefined,
        files: {
          file: files,
        },
        releases: xmlIntegritySwitch.checked
          ? {
              release: {
                '@_version': xmlLatestVersion.value,
                integrities: {
                  integrity: {
                    '@_target': 'FILENAME',
                    '#text': 'SRI',
                  },
                },
              },
            }
          : undefined,
      },
    };
    output.innerText = builder
      .build(xmlObject)
      .trim()
      .replaceAll(/^(\s+)/gm, (str) => '\t'.repeat(Math.floor(str.length / 2)));
  };

  // input event
  xmlTexts.forEach((e) => {
    e.addEventListener('input', makeXML);
  });

  xmlInstallerSwitch.addEventListener('change', (event) => {
    collapseInstallerElement();
    makeXML();
  });

  xmlIntegritySwitch.addEventListener('change', (event) => {
    makeXML();
  });

  // click event
  new ClipboardJS('.btn-copy');

  clearTextBtn.addEventListener('click', async (event) => {
    clearText();
    makeXML();
  });

  xmlDownloadURLBtn.addEventListener('click', async (event) => {
    const enableButton = buttonTransition.loading(xmlDownloadURLBtn);

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

    const downloadResult = await ipcRenderer.invoke(
      'open-browser',
      xmlDownloadURL.value,
      'package'
    );
    if (!downloadResult) {
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
      unzippedPath = await unzip(downloadResult.savePath);
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

    clearList();

    // folder
    searchFiles(unzippedPath, true)
      .filter((i) => i !== unzippedPath)
      .map((i) => path.relative(unzippedPath, i).replaceAll('\\', '/'))
      .forEach((f) => {
        const entry = document.createElement('div');
        entry.innerText = f;
        entry.dataset.id = f + '?';
        entry.classList.add('list-group-item');
        if (['plugins', 'script'].includes(path.basename(f))) {
          entry.classList.add('list-group-item-dark');
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
        entry.dataset.id = f;
        entry.classList.add('list-group-item');

        listDownload.appendChild(entry);
      });

    setTimeout(() => {
      enableButton();
    }, 3000);
  });

  // sortable list
  const usedPath = new Set();

  const updateMovableEntry = () => {
    for (const node of listDownload.children) {
      const nodePath = node.dataset.id.replace('?', '');
      if (!['plugins', 'script'].includes(path.basename(nodePath))) {
        node.classList.remove('list-group-item-dark');
        node.classList.remove('ignore-elements');
      }
    }

    for (const node of listDownload.children) {
      const nodePath = node.dataset.id.replace('?', '');
      usedPath.forEach((used) => {
        if (pathRelated(nodePath, used)) {
          node.classList.add('list-group-item-dark');
          node.classList.add('ignore-elements');
        }
      });
    }
  };

  new Sortable(listDownload, {
    group: 'nested',
    animation: 150,
    filter: '.ignore-elements',
    fallbackOnBody: true,
    sort: false,
    onRemove: (event) => {
      const itemPath = event.item.dataset.id.replace('?', '');
      usedPath.add(itemPath);
      updateMovableEntry();
    },
    onAdd: (event) => {
      const itemPath = event.item.dataset.id.replace('?', '');
      usedPath.delete(itemPath);
      updateMovableEntry();
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
  collapseInstallerElement();
  clearText();
  makeXML();
});
