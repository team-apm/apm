import type { Scripts } from 'apm-schema';
import React, {
  type JSX,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  Alert,
  Badge,
  Card,
  Col,
  Container,
  Form,
  ListGroup,
  Row,
  Spinner,
} from 'react-bootstrap';
import { compareVersion } from '../../../shared/compareVersion';
import { matchesSearchFilter } from '../../../shared/fuzzySearch';
import {
  conflictLabel,
  parsePackageType,
  states,
  unmetDependencyLabel,
} from '../../../shared/packageDisplay';
import {
  computeShareStringAlerts,
  parseShareString,
} from '../../../shared/shareString';
import type { PackageState } from '../../../types/packageState';
import { TRPCReact } from '../../trpc';
import {
  getInstallationPath,
  subscribeInstallationPath,
} from '../installationPath';
import PackageActions, { type SelectedEntry } from './PackageActions';
import { getPhase, subscribePhase } from './packagesListCheck';

// list.js から引き継いだ distance: 10000 は bitap のスコアから位置の項を
// 実質消し、誤字率だけで判定させる(長文の末尾でも引けるようにするため)。
// 抑制項が無くなるぶん短い語の誤字許容が効きすぎるので、誤字数の上限を
// 語の長さから決めて釣り合わせる。4 文字で 1 誤字、3 文字なら 0 誤字
const searchOptions = { distance: 10000, charsPerError: 4 };

// 部分一致だけで引く列。長くて情報密度が低く、誤字許容で引くと無関係な
// 行まで一致する。実測では "psd" が pageURL の "https:" に 1 誤字で当たり、
// 285 件中 277 件(97%)がヒットしていた
const SUBSTRING_ONLY_COLUMNS = new Set([
  'description',
  'pageURL',
  'dependencyInformation',
]);

type WebpageItem = Scripts['webpage'][number];

type Row =
  | { kind: 'package'; key: string; p: PackageState }
  | { kind: 'scriptSite'; key: string; w: WebpageItem };

type SortState = { column: 'name' | 'developer'; order: 'asc' | 'desc' };

type Filter =
  | { kind: 'none' }
  | { kind: 'type'; typeFilter: string }
  | { kind: 'install'; installFilter: string };

/**
 * Returns the displayed developer text of a package.
 * @param {PackageState} p - The package.
 * @returns {string} The developer text.
 */
const developerText = (p: PackageState) =>
  p.info.originalDeveloper
    ? `${p.info.developer}（オリジナル：${p.info.originalDeveloper}）`
    : p.info.developer;

/**
 * Returns the displayed installation-status text of a package.
 * @param {PackageState} p - The package.
 * @returns {string} The installation-status text.
 */
const installationStatusText = (p: PackageState) =>
  p.installationStatus +
  (p.installationStatus === states.installed ? ': ' + p.version : '');

/**
 * Returns the displayed dependency text of a package.
 * @param {PackageState} p - The package.
 * @param {PackageState[]} packages - All packages (for resolving names).
 * @returns {string} The dependency text.
 */
const dependencyText = (p: PackageState, packages: PackageState[]) =>
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
 * @param {PackageState[]} packages - All packages (for resolving dependency names).
 * @returns {Record<string, string>} The column values.
 */
const rowValues = (row: Row, packages: PackageState[]) => {
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
 * The whole pane of the packages tab (旧 index.html の section#packages の
 * 中身): search box, sort buttons, action buttons, filter sidebar, search
 * alert, the package list and the manually-installed-files list.
 * 旧 package.ts の setPackagesList(DOM 描画部分)+ listFilter +
 * updatableList(list.js)に相当する。データ取得は tRPC 経由で main プロセス。
 * 他コンポーネントからの再描画通知は apm-packages-changed イベントで受け取り、
 * 選択状態はこのコンポーネントが保持してアクションボタン(PackageActions)
 * と共有する。一覧のオーバーレイは packagesListCheck の phase から導出する。
 * @returns {JSX.Element} The rendered component.
 */
function PackagesTab(): JSX.Element {
  // インストール先はストアを購読する。DOM イベント経由で読み直すと、
  // 通知の発火とストア更新の順序に依存してしまう(起動フローも
  // SelectInstallationPathButton も setInstallationPath の前後で撃つ)
  const installationPath = useSyncExternalStore(
    subscribeInstallationPath,
    getInstallationPath,
  );
  const [searchString, setSearchString] = useState('');
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [sort, setSort] = useState<SortState>({
    column: 'name',
    order: 'asc',
  });
  const [filter, setFilter] = useState<Filter>({ kind: 'none' });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const utils = TRPCReact.useUtils();
  const packagesQuery = TRPCReact.packages.getPackagesWithStatus.useQuery(
    { installationPath, adoptManuallyInstalled: true },
    { refetchOnWindowFocus: false },
  );
  const scriptsQuery = TRPCReact.packages.getScriptsList.useQuery(
    { update: false },
    { refetchOnWindowFocus: false },
  );
  const coreVersionsQuery = TRPCReact.core.getLedgerCoreVersions.useQuery(
    installationPath,
    { refetchOnWindowFocus: false },
  );

  // 他コンポーネントからの一覧の再取得要求
  useEffect(() => {
    const onPackagesChanged = () => {
      void utils.packages.getPackagesWithStatus.invalidate();
      void utils.packages.getScriptsList.invalidate();
      void utils.core.getLedgerCoreVersions.invalidate();
    };
    window.addEventListener('apm-packages-changed', onPackagesChanged);
    return () => {
      window.removeEventListener('apm-packages-changed', onPackagesChanged);
    };
  }, [utils]);

  // 一覧再取得(runPackagesListCheck)の実行中はオーバーレイを表示する
  const checkPhase = useSyncExternalStore(subscribePhase, getPhase);

  const packages = useMemo(
    () => (packagesQuery.data?.packages ?? []) as PackageState[],
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
    const scriptSiteRows = webpages.map((w): Row => ({
      kind: 'scriptSite',
      key: `scriptSite:${w.url}`,
      w,
    }));
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
      result = result.filter(({ values }) => {
        const fuzzy: string[] = [];
        const substring: string[] = [];
        for (const [column, value] of Object.entries(values)) {
          (SUBSTRING_ONLY_COLUMNS.has(column) ? substring : fuzzy).push(value);
        }
        return matchesSearchFilter(
          fuzzy,
          substring,
          searchString,
          searchOptions,
        );
      });
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
  };

  const selectedEntry: SelectedEntry = useMemo(() => {
    const row = rows.find((r) => r.key === selectedKey);
    if (!row) return null;
    return row.kind === 'package'
      ? { kind: 'package', p: row.p }
      : { kind: 'scriptSite', w: row.w };
  }, [rows, selectedKey]);

  const isTypeSelected = (typeFilter: string) =>
    filter.kind === 'type' && filter.typeFilter === typeFilter;
  const isInstallSelected = (installFilter: string) =>
    filter.kind === 'install' && filter.installFilter === installFilter;
  // 選択中のボタンをもう一度押すとフィルタ解除(旧 listFilter と同一)
  const toggleTypeFilter = (typeFilter: string) =>
    setFilter(
      isTypeSelected(typeFilter)
        ? { kind: 'none' }
        : { kind: 'type', typeFilter },
    );
  const toggleInstallFilter = (installFilter: string) =>
    setFilter(
      isInstallSelected(installFilter)
        ? { kind: 'none' }
        : { kind: 'install', installFilter },
    );

  const filterButton = (
    selected: boolean,
    onClick: () => void,
    label: string,
    icon?: string,
  ) => (
    // check アイコンは CSS(.selected 以外は非表示)が表示を切り替える
    <button
      className={'dropdown-item px-0' + (selected ? ' selected' : '')}
      type="button"
      onClick={onClick}
    >
      <i className={'bi bi-check' + (icon ? ' me-1' : '')}></i>
      {icon && <i className={`bi ${icon} me-1`}></i>}
      {label}
    </button>
  );

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

  return (
    <Container fluid="lg">
      <Card className="row border-top-0 border-bottom-0 rounded-0">
        <Card.Body className="py-2">
          <div className="d-flex flex-column h-100">
            <div className="flex-shrink-1">
              <div className="d-flex mb-2">
                <div className="border rounded flex-grow-1 w-auto d-flex">
                  {/* 検索欄は非制御にして DOM の入力値をそのまま残し、
                      state には trim した文字列だけを持つ(旧実装と同一) */}
                  <Form.Control
                    className="border-0 flex-grow-1 w-auto"
                    placeholder="🔍︎ 検索  |  共有貼り付け"
                    aria-label="検索 / 共有"
                    // size は Bootstrap のサイズ指定に使われるため、
                    // HTML の size 属性(既定 20 文字幅より縮められるように
                    // する)は htmlSize で渡す
                    htmlSize={2}
                    onChange={(e) => {
                      setSearchString(e.target.value.trim());
                      setAlertDismissed(false);
                    }}
                  />
                  <div className="d-flex">
                    {sortButton('name', '名前')}
                    {sortButton('developer', '開発者')}
                  </div>
                </div>
                <div className="d-flex">
                  <PackageActions
                    installationPath={installationPath}
                    selectedEntry={selectedEntry}
                    packages={packages}
                  />
                </div>
              </div>
            </div>
            <div className="h-100 min-h-0">
              <Row className="h-100">
                <Col
                  sm="auto"
                  className="overflow-x-hidden overflow-y-auto h-100"
                >
                  {/* dropdown-menu は開閉するメニューではなく、常時表示の
                      サイドバーとして見た目だけを借りている。react-bootstrap
                      の Dropdown は開閉の振る舞いを持つコンポーネントなので
                      ここには合わず、クラスのまま使う(配下の dropdown-item /
                      dropdown-divider も同じ理由) */}
                  <ul
                    id="filter"
                    className="list-unstyled dropdown-menu d-block position-static border-0"
                  >
                    <li>
                      {/* 「パッケージ」はフィルタ解除ボタン。selected が
                          付かないため check アイコンは常に非表示(旧実装と同一) */}
                      {filterButton(
                        false,
                        () => setFilter({ kind: 'none' }),
                        'パッケージ',
                        'bi-box-seam',
                      )}
                      <ul className="list-unstyled ps-3">
                        <li>
                          {filterButton(
                            isInstallSelected('true'),
                            () => toggleInstallFilter('true'),
                            'インストール済み',
                          )}
                        </li>
                        <li>
                          {filterButton(
                            isInstallSelected('manual'),
                            () => toggleInstallFilter('manual'),
                            '手動インストール済み',
                          )}
                        </li>
                        <li>
                          {filterButton(
                            isInstallSelected('false'),
                            () => toggleInstallFilter('false'),
                            '未インストール',
                          )}
                        </li>
                      </ul>
                    </li>
                    <li>
                      <hr className="mx-2 dropdown-divider" />
                      探す
                    </li>
                    <li>
                      {filterButton(
                        isTypeSelected('plugin'),
                        () => toggleTypeFilter('plugin'),
                        'プラグイン',
                        'bi-film',
                      )}
                      <ul className="list-unstyled ps-3">
                        <li>
                          {filterButton(
                            isTypeSelected('input'),
                            () => toggleTypeFilter('input'),
                            '入力',
                          )}
                        </li>
                        <li>
                          {filterButton(
                            isTypeSelected('output'),
                            () => toggleTypeFilter('output'),
                            '出力',
                          )}
                        </li>
                        <li>
                          {filterButton(
                            isTypeSelected('filter'),
                            () => toggleTypeFilter('filter'),
                            'フィルター',
                          )}
                        </li>
                        <li>
                          {filterButton(
                            isTypeSelected('color'),
                            () => toggleTypeFilter('color'),
                            '色変換',
                          )}
                        </li>
                        <li>
                          {filterButton(
                            isTypeSelected('language'),
                            () => toggleTypeFilter('language'),
                            '言語',
                          )}
                        </li>
                      </ul>
                    </li>
                    <li>
                      {filterButton(
                        isTypeSelected('script'),
                        () => toggleTypeFilter('script'),
                        'スクリプト',
                        'bi-calendar3-range',
                      )}
                      <ul className="list-unstyled ps-3">
                        <li>
                          {filterButton(
                            isTypeSelected('animation'),
                            () => toggleTypeFilter('animation'),
                            'アニメーション効果',
                          )}
                        </li>
                        <li>
                          {filterButton(
                            isTypeSelected('object'),
                            () => toggleTypeFilter('object'),
                            'カスタムオブジェクト',
                          )}
                        </li>
                        <li>
                          {filterButton(
                            isTypeSelected('scene'),
                            () => toggleTypeFilter('scene'),
                            'シーンチェンジ',
                          )}
                        </li>
                        <li>
                          {filterButton(
                            isTypeSelected('camera'),
                            () => toggleTypeFilter('camera'),
                            'カメラ制御',
                          )}
                        </li>
                        <li>
                          {filterButton(
                            isTypeSelected('track'),
                            () => toggleTypeFilter('track'),
                            'トラックバー',
                          )}
                        </li>
                        <li>
                          {filterButton(
                            isTypeSelected('script-dist'),
                            () => toggleTypeFilter('script-dist'),
                            '配布サイトから探す',
                          )}
                        </li>
                      </ul>
                    </li>
                    <li>
                      <a
                        href="https://team-apm.github.io/apm/#%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3%E3%82%B9%E3%82%AF%E3%83%AA%E3%83%97%E3%83%88%E3%81%A8%E3%81%AF"
                        className="dropdown-item pe-0"
                      >
                        <i className="bi bi-info-circle me-1"></i>これは何？
                        <i className="bi bi-box-arrow-up-right ms-1"></i>
                      </a>
                    </li>
                    <li>
                      <hr className="mx-2 dropdown-divider" />
                      作る
                    </li>
                    <li>
                      <a
                        href="https://docs.google.com/forms/d/e/1FAIpQLSf0N-X_u_abi8rrWHVDdiK3YeYuQ7J1f8bQAy6QTD-OR94DWQ/viewform?usp=sf_link"
                        className="dropdown-item pe-0"
                      >
                        <i className="bi bi-megaphone me-1"></i>提案する
                        <i className="bi bi-box-arrow-up-right ms-1"></i>
                      </a>
                    </li>
                    <li>
                      <a
                        href="https://team-apm.github.io/apm-web/"
                        className="dropdown-item pe-0"
                      >
                        <i className="bi bi-pencil me-1"></i>作ってみる
                        <i className="bi bi-box-arrow-up-right ms-1"></i>
                      </a>
                    </li>
                  </ul>
                </Col>
                <Col className="d-flex flex-column h-100">
                  <div>
                    {alertStrings.length > 0 && !alertDismissed && (
                      <Alert
                        variant="info"
                        dismissible
                        // 既定は 'Close alert'。旧マークアップの aria-label を保つ
                        closeLabel="Close"
                        onClose={() => setAlertDismissed(true)}
                        className="mt-2 mb-1"
                      >
                        {alertStrings.map((s) => (
                          <div key={s}>{s}</div>
                        ))}
                      </Alert>
                    )}
                  </div>
                  <Row className="flex-grow-1 overflow-auto">
                    <Col id="packages-table">
                      <ListGroup
                        as="ul"
                        variant="flush"
                        className="list"
                        id="packages-list"
                      >
                        {visibleRows.map(({ row, values }) => (
                          <ListGroup.Item
                            as="li"
                            action
                            variant={
                              selectedKey === row.key ? 'light' : undefined
                            }
                            key={row.key}
                            className="text-muted"
                            onClick={() => selectRow(row)}
                          >
                            <input
                              type="radio"
                              name="accordion"
                              checked={selectedKey === row.key}
                              readOnly
                            />
                            <label className="d-block">
                              <Row>
                                <Col sm={9} className="clearfix">
                                  <div className="d-none packageID">
                                    {values.packageID}
                                  </div>
                                  <div className="float-end ms-2 type">
                                    {parsePackageType(
                                      row.kind === 'package'
                                        ? (row.p.type ?? [])
                                        : [],
                                    ).map((e, i) => (
                                      // bg の既定値 primary は bg-primary
                                      // (!important)を足して main.css の
                                      // .badge の配色を上書きするため外す
                                      <Badge
                                        key={i}
                                        bg=""
                                        className="list-group-item-light d-block fw-normal"
                                      >
                                        {e}
                                      </Badge>
                                    ))}
                                    {row.kind === 'scriptSite' && (
                                      <Badge
                                        bg=""
                                        className="list-group-item-success d-block fw-normal"
                                      >
                                        スクリプト配布サイト
                                      </Badge>
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
                                      <a
                                        className="pageURL"
                                        href={values.pageURL}
                                      >
                                        {values.pageURL}
                                      </a>
                                    </div>
                                  </div>
                                </Col>
                                <Col sm={3}>
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
                                            // アクションボタン側(PackageActions)が購読
                                            window.dispatchEvent(
                                              new CustomEvent(
                                                'apm-install-package-by-id',
                                                {
                                                  detail: d.id,
                                                },
                                              ),
                                            );
                                          }}
                                        >
                                          要導入: {d.info.name}
                                        </a>
                                      ))}
                                    {row.kind === 'package' &&
                                      row.p.doNotInstall && (
                                        <div className="text-warning">
                                          インストール不可
                                          {(row.p.unmetDependencies ?? [])
                                            .length > 0 && (
                                            <span className="d-block fw-normal">
                                              要:{' '}
                                              {(row.p.unmetDependencies ?? [])
                                                .map((group) =>
                                                  unmetDependencyLabel(
                                                    group,
                                                    (id) =>
                                                      packages.find(
                                                        (p) => p.id === id,
                                                      )?.info.name,
                                                  ),
                                                )
                                                .join('、')}
                                            </span>
                                          )}
                                          {(row.p.conflictingWith ?? [])
                                            .length > 0 && (
                                            <span className="d-block fw-normal">
                                              競合:{' '}
                                              {(row.p.conflictingWith ?? [])
                                                .map((group) =>
                                                  conflictLabel(
                                                    group,
                                                    (id) =>
                                                      packages.find(
                                                        (p) => p.id === id,
                                                      )?.info.name,
                                                  ),
                                                )
                                                .filter(
                                                  (v, i, a) =>
                                                    a.indexOf(v) === i,
                                                )
                                                .join('、')}
                                            </span>
                                          )}
                                          {row.p.installationStatus ===
                                            states.otherInstalled && (
                                            <span className="d-block fw-normal">
                                              別のバージョンが導入済み
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    {row.kind === 'package' &&
                                      row.p.installationStatus ===
                                        states.installed &&
                                      row.p.version !== undefined &&
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
                                </Col>
                              </Row>
                            </label>
                          </ListGroup.Item>
                        ))}
                      </ListGroup>
                      <ListGroup as="ul" variant="flush" id="packages-list2">
                        {manuallyInstalledFiles.map((file) => (
                          <ListGroup.Item
                            as="li"
                            action
                            variant="secondary"
                            key={file}
                            className="text-muted"
                          >
                            <label className="d-block">
                              <Row>
                                <Col sm={9} className="clearfix">
                                  <h5 className="float-none d-inline mb-1 me-2 text-break text-body name">
                                    {file}
                                  </h5>
                                  <div className="text-break overview">
                                    手動で追加されたファイル
                                  </div>
                                </Col>
                                <Col sm={3}></Col>
                              </Row>
                            </label>
                          </ListGroup.Item>
                        ))}
                      </ListGroup>
                    </Col>
                    <div
                      className={
                        'd-flex justify-content-center align-items-center fade' +
                        (checkPhase.kind === 'loading' ? ' show' : '')
                      }
                      id="packages-table-overlay"
                      style={{
                        zIndex: checkPhase.kind === 'loading' ? 1000 : -1,
                      }}
                    >
                      <Spinner animation="border" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </Spinner>
                    </div>
                  </Row>
                </Col>
              </Row>
            </div>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
}

export default PackagesTab;
