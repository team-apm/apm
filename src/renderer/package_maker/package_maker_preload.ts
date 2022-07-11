import { execSync } from 'child_process';
import ClipboardJS from 'clipboard/src/clipboard';
import log from 'electron-log';
import { XMLBuilder } from 'fast-xml-parser';
import fs from 'fs-extra';
import path from 'path';
// 'Sortable' is not actually exported as ESModules. So, ignore the warning.
// eslint-disable-next-line import/no-named-as-default
import Sortable from 'sortablejs';
import { pathRelated } from '../../lib/apmPath';
import * as buttonTransition from '../../lib/buttonTransition';
import { openBrowser, openDialog } from '../../lib/ipcWrapper';
import unzip from '../../lib/unzip';

log.catchErrors({
  onError: () => {
    openDialog(
      'エラー',
      `予期しないエラーが発生しました。\nログファイル: ${
        log.transports.file.getFile().path
      }`,
      'error'
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
const searchFiles = (dirName: string, directory = false): string[] => {
  const dirents = fs.readdirSync(dirName, {
    withFileTypes: true,
  });
  return [].concat(
    directory
      ? [dirName]
      : dirents
          .filter((i) => i.isFile())
          .filter((i) => !imageExtention.includes(path.extname(i.name)))
          .map((i) => path.join(dirName, i.name)),
    dirents
      .filter((i) => i.isDirectory())
      .flatMap((i) => searchFiles(path.join(dirName, i.name), directory))
  );
};

window.addEventListener('load', () => {
  const xmlId = document.getElementById('xml-id') as HTMLInputElement;
  const xmlName = document.getElementById('xml-name') as HTMLInputElement;
  const xmlOverview = document.getElementById(
    'xml-overview'
  ) as HTMLInputElement;
  const xmlDescription = document.getElementById(
    'xml-description'
  ) as HTMLInputElement;
  const xmlDeveloper = document.getElementById(
    'xml-developer'
  ) as HTMLInputElement;
  const xmlOriginalDeveloper = document.getElementById(
    'xml-original-developer'
  ) as HTMLInputElement;
  const xmlLatestVersion = document.getElementById(
    'xml-latest-version'
  ) as HTMLInputElement;
  const xmlPageURL = document.getElementById(
    'xml-page-url'
  ) as HTMLInputElement;
  const xmlDownloadURL = document.getElementById(
    'xml-download-url'
  ) as HTMLInputElement;
  const xmlDownloadMirrorURL = document.getElementById(
    'xml-download-mirror-url'
  ) as HTMLInputElement;
  const xmlInstaller = document.getElementById(
    'xml-installer'
  ) as HTMLInputElement;
  const xmlInstallArg = document.getElementById(
    'xml-install-arg'
  ) as HTMLInputElement;
  const xmlDependencies = document.getElementById(
    'xml-dependencies'
  ) as HTMLInputElement;
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

  const xmlIdValidate = document.getElementById(
    'xml-id-validate'
  ) as HTMLInputElement;
  const xmlNameValidate = document.getElementById(
    'xml-name-validate'
  ) as HTMLInputElement;
  const xmlOverviewValidate = document.getElementById(
    'xml-overview-validate'
  ) as HTMLInputElement;

  const xmlDownloadURLBtn = document.getElementById(
    'xml-download-url-button'
  ) as HTMLInputElement;
  const clearTextBtn = document.getElementById(
    'clear-text-button'
  ) as HTMLInputElement;

  const xmlInstallerSwitch = document.getElementById(
    'xml-installer-switch'
  ) as HTMLInputElement;
  const xmlIntegritySwitch = document.getElementById(
    'xml-integrity-switch'
  ) as HTMLInputElement;

  const listDownload = document.getElementById('list-download');
  const listAviutl = document.getElementById('list-aviutl');
  const listPlugins = document.getElementById('list-plugins');
  const listScript = document.getElementById('list-script');

  const output = document.getElementById('output-xml');

  const clearList = () => {
    listDownload.innerHTML = null;
    Array.from(listAviutl.children)
      .filter((e: HTMLElement) => e.dataset.id !== 'exclude')
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
      (e.parentNode.parentNode as HTMLElement).style.display =
        xmlInstallerSwitch.checked ? '' : 'none';
    });
  };

  const makeXML = () => {
    xmlIdValidate.innerText = xmlId.value.match(/^[A-Za-z0-9]+\/[A-Za-z0-9]+$/)
      ? ''
      : 'idは"{作者名(半角英数)}/{プラグイン名(半角英数)}"の形式です';
    xmlNameValidate.innerText =
      `${Array.from(xmlName.value).length}/25文字` +
      (Array.from(xmlName.value).length <= 25
        ? ''
        : ' 名前は25文字以内である必要があります');
    xmlOverviewValidate.innerText =
      `${Array.from(xmlOverview.value).length}/35文字` +
      (Array.from(xmlOverview.value).length <= 35
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
        interface FileObj {
          '#text': string;
          '@_archivePath'?: string;
          '@_directory'?: boolean;
        }
        const ret: FileObj = { '#text': baseItem };
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
        originalDeveloper: xmlOriginalDeveloper.value ?? undefined,
        dependencies: xmlDependencies.value
          ? {
              dependency: xmlDependencies.value.split(' '),
            }
          : undefined,
        pageURL: xmlPageURL.value,
        downloadURL: xmlDownloadURL.value,
        downloadMirrorURL: xmlDownloadMirrorURL.value ?? undefined,
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
    output.innerText = (builder.build(xmlObject) as string)
      .trim()
      .replaceAll(/^(\s+)/gm, (str) => '\t'.repeat(Math.floor(str.length / 2)));
  };

  // input event
  xmlTexts.forEach((e) => {
    e.addEventListener('input', makeXML);
  });

  xmlInstallerSwitch.addEventListener('change', () => {
    collapseInstallerElement();
    makeXML();
  });

  xmlIntegritySwitch.addEventListener('change', () => {
    makeXML();
  });

  // click event
  new ClipboardJS('.btn-copy');

  clearTextBtn.addEventListener('click', async () => {
    clearText();
    makeXML();
  });

  xmlDownloadURLBtn.addEventListener('click', async () => {
    const { enableButton } = buttonTransition.loading(xmlDownloadURLBtn);

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

    const downloadResult = await openBrowser(xmlDownloadURL.value, 'package');
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

    let unzippedPath: string;
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
    searchFiles(unzippedPath, false)
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
  const usedPath = new Set<string>();

  const updateMovableEntry = () => {
    Array.from(listDownload.children).forEach((node: HTMLElement) => {
      const nodePath = node.dataset.id.replace('?', '');
      if (!['plugins', 'script'].includes(path.basename(nodePath))) {
        node.classList.remove('list-group-item-dark');
        node.classList.remove('ignore-elements');
      }
    });

    Array.from(listDownload.children).forEach((node: HTMLElement) => {
      const nodePath = node.dataset.id.replace('?', '');
      usedPath.forEach((used) => {
        if (pathRelated(nodePath, used)) {
          node.classList.add('list-group-item-dark');
          node.classList.add('ignore-elements');
        }
      });
    });
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
