import type { Scripts } from 'apm-schema';
import React, { type JSX, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { compareVersion } from '../../../shared/compareVersion';
import { matchesFuzzyFilter } from '../../../shared/fuzzySearch';
import { parsePackageType, states } from '../../../shared/packageDisplay';
import {
  computeShareStringAlerts,
  parseShareString,
} from '../../../shared/shareString';
import type { PackageItem } from '../../../types/packageItem';
import { TRPCReact } from '../../trpc';

// list.js(fuzzySearch)に合わせた検索オプション。
// Ensure that searches are performed even on long strings.
const fuzzyOptions = { distance: 10000 };

type WebpageItem = Scripts['webpage'][number];

type Row =
  | { kind: 'package'; key: string; p: PackageItem }
  | { kind: 'scriptSite'; key: string; w: WebpageItem };

type SortState = { column: 'name' | 'developer'; order: 'asc' | 'desc' };

type Filter =
  | { kind: 'none' }
  | { kind: 'type'; typeFilter: string }
  | { kind: 'install'; installFilter: string };

/**
 * Returns the displayed developer text of a package.
 * @param {PackageItem} p - The package.
 * @returns {string} The developer text.
 */
const developerText = (p: PackageItem) =>
  p.info.originalDeveloper
    ? `${p.info.developer}（オリジナル：${p.info.originalDeveloper}）`
    : p.info.developer;

/**
 * Returns the displayed installation-status text of a package.
 * @param {PackageItem} p - The package.
 * @returns {string} The installation-status text.
 */
const installationStatusText = (p: PackageItem) =>
  p.installationStatus +
  (p.installationStatus === states.installed ? ': ' + p.version : '');

/**
 * Returns the displayed dependency text of a package.
 * @param {PackageItem} p - The package.
 * @param {PackageItem[]} packages - All packages (for resolving names).
 * @returns {string} The dependency text.
 */
const dependencyText = (p: PackageItem, packages: PackageItem[]) =>
  p.info.dependencies
    ?.map((ids) =>
      Array.from(
        new Set(
          ids
            .split('|')
            .map((id) => packages.find((q) => q.id === id)?.info?.name),
        ),
      ).join(' or '),
    )
    .flatMap((text) => (text ? ['🔗 ' + text] : []))
    .join(' ') ?? '';

/**
 * Returns the searchable / sortable column values of a row.
 * 旧 list.js の valueNames(columns)と同じ列構成。
 * @param {Row} row - The row.
 * @param {PackageItem[]} packages - All packages (for resolving dependency names).
 * @returns {Record<string, string>} The column values.
 */
const rowValues = (row: Row, packages: PackageItem[]) => {
  if (row.kind === 'package') {
    const p = row.p;
    return {
      packageID: p.id,
      name: p.info.name,
      overview: p.info.overview,
      developer: developerText(p),
      type: parsePackageType(p.type ?? []).join('\n'),
      latestVersion: p.info.latestVersion,
      installationStatus: installationStatusText(p),
      description: p.info.description,
      pageURL: p.info.pageURL,
      dependencyInformation: dependencyText(p, packages),
    };
  }
  const w = row.w;
  return {
    packageID: '',
    name: w.developer,
    overview: '配布サイトからスクリプトをインストール',
    developer: w.developer,
    type: 'スクリプト配布サイト',
    latestVersion: '',
    installationStatus: '',
    description: w.description ?? '',
    pageURL: w.url,
    dependencyInformation: '',
  };
};

/**
 * Case-insensitive natural compare (list.js の string-natural-compare 相当)。
 * @param {string} a - First string.
 * @param {string} b - Second string.
 * @returns {number} The comparison result.
 */
const naturalCompare = (a: string, b: string) => {
  const ax = a.toLowerCase();
  const bx = b.toLowerCase();
  const chunk = /(\d+|\D+)/g;
  const ac = ax.match(chunk) ?? [];
  const bc = bx.match(chunk) ?? [];
  const length = Math.min(ac.length, bc.length);
  for (let i = 0; i < length; i++) {
    if (ac[i] === bc[i]) continue;
    const an = Number(ac[i]);
    const bn = Number(bc[i]);
    if (!Number.isNaN(an) && !Number.isNaN(bn)) return an - bn;
    return ac[i] < bc[i] ? -1 : 1;
  }
  return ac.length - bc.length;
};

/**
 * The packages tab list: sort buttons, search alert, the package list and
 * the manually-installed-files list.
 * 旧 package.ts の setPackagesList(DOM 描画部分)+ listFilter +
 * updatableList(list.js)に相当する。データ取得は tRPC 経由で main プロセス。
 * レガシー側からの再描画通知は apm-packages-changed イベント、選択状態の
 * 受け渡しは window.packagesBridge(contextBridge)で行う。
 * @returns {JSX.Element} The rendered component.
 */
function PackagesTab(): JSX.Element {
  const [instPath, setInstPath] = useState(
    () => window.coreBridge?.getInstallationPath() ?? '',
  );
  const [searchString, setSearchString] = useState('');
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [sort, setSort] = useState<SortState>({
    column: 'name',
    order: 'asc',
  });
  const [filter, setFilter] = useState<Filter>({ kind: 'none' });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const utils = TRPCReact.useContext();
  const packagesQuery = TRPCReact.packages.getPackagesWithStatus.useQuery(
    { instPath, fixIntegrity: true },
    { refetchOnWindowFocus: false },
  );
  const scriptsQuery = TRPCReact.packages.getScriptsList.useQuery(
    { update: false },
    { refetchOnWindowFocus: false },
  );
  const coreVersionsQuery = TRPCReact.core.getApmJsonCoreVersions.useQuery(
    instPath,
    { refetchOnWindowFocus: false },
  );

  // レガシー側からの通知: インストール先変更と一覧の再取得要求
  useEffect(() => {
    const onCoreChanged = () => {
      setInstPath(window.coreBridge?.getInstallationPath() ?? '');
    };
    const onPackagesChanged = () => {
      void utils.packages.getPackagesWithStatus.invalidate();
      void utils.packages.getScriptsList.invalidate();
      void utils.core.getApmJsonCoreVersions.invalidate();
    };
    window.addEventListener('apm-core-changed', onCoreChanged);
    window.addEventListener('apm-packages-changed', onPackagesChanged);
    return () => {
      window.removeEventListener('apm-core-changed', onCoreChanged);
      window.removeEventListener('apm-packages-changed', onPackagesChanged);
    };
  }, [utils]);

  // 検索欄(レガシー DOM)の入力を購読する
  useEffect(() => {
    const searchBox = document.getElementsByClassName(
      'fuzzy-search-wrapped',
    )?.[0] as HTMLInputElement | undefined;
    if (!searchBox) return;
    const onInput = () => {
      setSearchString(searchBox.value.trim());
      setAlertDismissed(false);
    };
    searchBox.addEventListener('input', onInput);
    return () => searchBox.removeEventListener('input', onInput);
  }, []);

  // フィルタボタン(レガシー DOM)のクリックを購読する。
  // 選択中のボタンをもう一度押す、または「パッケージ」(clear)でフィルタ解除
  useEffect(() => {
    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        '#filter .type-filter, #filter .install-filter',
      ),
    );
    const onClick = (btn: HTMLButtonElement) => () => {
      const isClear =
        btn.classList.contains('selected') ||
        btn.dataset.installFilter === 'clear';
      buttons.forEach((b) => b.classList.remove('selected'));
      if (isClear) {
        setFilter({ kind: 'none' });
        return;
      }
      btn.classList.add('selected');
      if (btn.dataset.typeFilter) {
        setFilter({ kind: 'type', typeFilter: btn.dataset.typeFilter });
      } else if (btn.dataset.installFilter) {
        setFilter({
          kind: 'install',
          installFilter: btn.dataset.installFilter,
        });
      }
    };
    const listeners = buttons.map((btn) => {
      const listener = onClick(btn);
      btn.addEventListener('click', listener);
      return { btn, listener };
    });
    return () =>
      listeners.forEach(({ btn, listener }) =>
        btn.removeEventListener('click', listener),
      );
  }, []);

  const packages = useMemo(
    () => (packagesQuery.data?.packages ?? []) as PackageItem[],
    [packagesQuery.data],
  );
  const manuallyInstalledFiles = (packagesQuery.data?.manuallyInstalledFiles ??
    []) as string[];
  const webpages = (scriptsQuery.data?.webpage ?? []) as WebpageItem[];

  const rows = useMemo<Row[]>(() => {
    const packageRows = packages
      .filter(
        (p) =>
          !(p.info.isHidden && p.installationStatus === states.notInstalled),
      )
      .map((p): Row => ({ kind: 'package', key: `package:${p.id}`, p }));
    const scriptSiteRows = webpages.map(
      (w): Row => ({ kind: 'scriptSite', key: `scriptSite:${w.url}`, w }),
    );
    return [...packageRows, ...scriptSiteRows];
  }, [packages, webpages]);

  const parsedShareString = useMemo(
    () => (searchString ? parseShareString(searchString) : null),
    [searchString],
  );

  const visibleRows = useMemo(() => {
    let result = rows.map((row) => ({
      row,
      values: rowValues(row, packages),
    }));

    // フィルタ(タイプ / インストール状況)。検索と重ねて適用される
    if (filter.kind === 'type') {
      const query = parsePackageType([filter.typeFilter]);
      result = result.filter(({ values }) =>
        query.some((q) => values.type.includes(q)),
      );
    } else if (filter.kind === 'install') {
      const q = filter.installFilter;
      result = result.filter(({ values }) => {
        const value = values.installationStatus;
        if (q === 'true')
          return (
            value.startsWith(states.installed) ||
            value === states.installedButBroken
          );
        if (q === 'manual') return value === states.manuallyInstalled;
        if (q === 'false')
          return (
            value === states.notInstalled || value === states.otherInstalled
          );
        return true;
      });
    }

    // 検索。共有文字列なら ID 完全一致、それ以外は fuzzy 検索
    if (parsedShareString) {
      result = result.filter(({ values }) =>
        parsedShareString.packages.includes(values.packageID.toLowerCase()),
      );
    } else if (searchString) {
      result = result.filter(({ values }) =>
        matchesFuzzyFilter(Object.values(values), searchString, fuzzyOptions),
      );
    }

    const direction = sort.order === 'asc' ? 1 : -1;
    result.sort(
      (a, b) =>
        naturalCompare(a.values[sort.column], b.values[sort.column]) *
        direction,
    );
    return result;
  }, [rows, packages, filter, parsedShareString, searchString, sort]);

  const alertStrings = useMemo(() => {
    if (!parsedShareString || !coreVersionsQuery.data) return [];
    return computeShareStringAlerts(parsedShareString, coreVersionsQuery.data);
  }, [parsedShareString, coreVersionsQuery.data]);

  const selectRow = (row: Row) => {
    setSelectedKey(row.key);
    if (row.kind === 'package') {
      window.packagesBridge?.setSelectedEntry('package', row.p);
    } else {
      window.packagesBridge?.setSelectedEntry('script', row.w);
    }
  };

  const sortButton = (column: SortState['column'], label: string) => (
    <div
      className={
        'sort rounded-pill d-inline-block px-2 mx-1 my-auto small border' +
        (sort.column === column ? ` ${sort.order}` : '')
      }
      role="button"
      onClick={() =>
        setSort((prev) => ({
          column,
          order:
            prev.column === column && prev.order === 'asc' ? 'desc' : 'asc',
        }))
      }
    >
      {label}
    </div>
  );

  const packagesSortRoot = document.getElementById('packages-sort');
  const searchAlertRoot = document.getElementById('custom-search-alert');
  const packagesListRoot = document.getElementById('packages-list');
  const packagesList2Root = document.getElementById('packages-list2');

  return (
    <>
      {packagesSortRoot &&
        createPortal(
          <>
            {sortButton('name', '名前')}
            {sortButton('developer', '開発者')}
          </>,
          packagesSortRoot,
        )}
      {searchAlertRoot &&
        createPortal(
          alertStrings.length > 0 && !alertDismissed ? (
            <div
              className="mt-2 mb-1 alert alert-info alert-dismissible fade show"
              role="alert"
            >
              <div className="alert-text">
                {alertStrings.map((s) => (
                  <div key={s}>{s}</div>
                ))}
              </div>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={() => setAlertDismissed(true)}
              />
            </div>
          ) : null,
          searchAlertRoot,
        )}
      {packagesListRoot &&
        createPortal(
          <>
            {visibleRows.map(({ row, values }) => (
              <li
                key={row.key}
                className={
                  'list-group-item list-group-item-action text-muted' +
                  (selectedKey === row.key ? ' list-group-item-light' : '')
                }
                onClick={() => selectRow(row)}
              >
                <input
                  type="radio"
                  name="accordion"
                  checked={selectedKey === row.key}
                  readOnly
                />
                <label className="d-block">
                  <div className="row">
                    <div className="col-sm-9 clearfix">
                      <div className="d-none packageID">{values.packageID}</div>
                      <div className="float-end ms-2 type">
                        {parsePackageType(
                          row.kind === 'package' ? (row.p.type ?? []) : [],
                        ).map((e, i) => (
                          <span
                            key={i}
                            className="badge list-group-item-light d-block fw-normal"
                          >
                            {e}
                          </span>
                        ))}
                        {row.kind === 'scriptSite' && (
                          <span className="badge list-group-item-success d-block fw-normal">
                            スクリプト配布サイト
                          </span>
                        )}
                      </div>
                      <h5 className="float-none d-inline mb-1 me-2 text-break text-body name">
                        {values.name}
                      </h5>
                      <span className="text-primary text-break developer">
                        {values.developer}
                      </span>
                      <div className="text-break overview">
                        {values.overview}
                      </div>
                      <div className="accordion-detail mt-2">
                        <div className="text-break description">
                          {values.description}
                        </div>
                        <div className="text-break dependencyInformation">
                          {values.dependencyInformation}
                        </div>
                        <div className="text-break">
                          <a className="pageURL" href={values.pageURL}>
                            {values.pageURL}
                          </a>
                        </div>
                      </div>
                    </div>
                    <div className="col-sm-3">
                      <div className="text-break latestVersion">
                        {values.latestVersion}
                      </div>
                      <div className="text-break statusInformation fw-bold">
                        {row.kind === 'package' &&
                          (row.p.detached ?? []).map((d) => (
                            <a
                              key={d.id}
                              href="#"
                              className="text-danger d-block"
                              onClick={(e) => {
                                e.preventDefault();
                                void window.packagesBridge?.installPackageById(
                                  d.id,
                                );
                              }}
                            >
                              要導入: {d.info.name}
                            </a>
                          ))}
                        {row.kind === 'package' && row.p.doNotInstall && (
                          <div className="text-warning">インストール不可</div>
                        )}
                        {row.kind === 'package' &&
                          row.p.installationStatus === states.installed &&
                          compareVersion(
                            row.p.info.latestVersion,
                            row.p.version,
                          ) > 0 && (
                            <div className="text-success">
                              更新が利用可能です
                            </div>
                          )}
                      </div>
                      <div className="text-break installationStatus">
                        {values.installationStatus}
                      </div>
                    </div>
                  </div>
                </label>
              </li>
            ))}
          </>,
          packagesListRoot,
        )}
      {packagesList2Root &&
        createPortal(
          <>
            {manuallyInstalledFiles.map((file) => (
              <li
                key={file}
                className="list-group-item list-group-item-action text-muted list-group-item-secondary"
              >
                <label className="d-block">
                  <div className="row">
                    <div className="col-sm-9 clearfix">
                      <h5 className="float-none d-inline mb-1 me-2 text-break text-body name">
                        {file}
                      </h5>
                      <div className="text-break overview">
                        手動で追加されたファイル
                      </div>
                    </div>
                    <div className="col-sm-3"></div>
                  </div>
                </label>
              </li>
            ))}
          </>,
          packagesList2Root,
        )}
    </>
  );
}

export default PackagesTab;
