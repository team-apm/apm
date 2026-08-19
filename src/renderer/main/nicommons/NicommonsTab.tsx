import React, { type JSX, useEffect, useMemo, useState } from 'react';
import { parsePackageType } from '../../../shared/packageDisplay';
import type { PackageItem } from '../../../types/packageItem';
import { TRPCReact } from '../../trpc';
import { getInstallationPath } from '../instPath';

type NicommonsItem = {
  name: string;
  developer: string;
  originalDeveloper?: string;
  typeBadges: string[];
  nicommons: string;
};

/**
 * A row of the nicommons ID list with its thumbnail from the nicommons API.
 * @param {object} props - Props.
 * @param {NicommonsItem} props.item - The item to display.
 * @param {boolean} props.checked - Whether the checkbox is checked.
 * @param {(checked: boolean) => void} props.onChange - Called when the checkbox changes.
 * @returns {JSX.Element} The rendered row.
 */
function NicommonsRow({
  item,
  checked,
  onChange,
}: {
  item: NicommonsItem;
  checked: boolean;
  onChange: (checked: boolean) => void;
}): JSX.Element {
  const dataQuery = TRPCReact.nicommons.getData.useQuery(item.nicommons, {
    refetchOnWindowFocus: false,
  });
  const nicommonsData = dataQuery.data as
    | { node?: { thumbnailURL?: string } }
    | false
    | undefined;
  const thumbnailURL =
    nicommonsData && nicommonsData.node?.thumbnailURL
      ? nicommonsData.node.thumbnailURL.replace('size=l', 'size=s')
      : null;

  return (
    <li className="list-group-item list-group-item-action">
      <label className="d-block">
        <div className="row">
          <div className="col-auto d-flex align-items-center">
            <input
              className="form-check-input m-0"
              type="checkbox"
              name="nicommons-id"
              value={item.nicommons}
              checked={checked}
              onChange={(e) => onChange(e.target.checked)}
            />
          </div>
          <div className="col-sm-1 d-flex align-items-center thumbnail">
            {thumbnailURL && (
              <img src={thumbnailURL} className="img-fluid" alt="" />
            )}
          </div>
          <div className="col">
            <h5 className="d-inline-block name">{item.name}</h5>
            <div className="text-primary d-inline-block ms-2 developer">
              {item.originalDeveloper
                ? `${item.developer}（オリジナル：${item.originalDeveloper}）`
                : item.developer}
            </div>
            <div className="d-inline-block ms-1 type">
              {item.typeBadges.map((e, i) => (
                <span
                  key={i}
                  className="badge list-group-item-light d-block fw-normal"
                >
                  {e}
                </span>
              ))}
            </div>
            <br />
            <div className="d-inline-block text-break nicommons text-muted">
              {item.nicommons}
            </div>
          </div>
        </div>
      </label>
    </li>
  );
}

/**
 * The nicommons ID list: installed packages with a nicommons ID, with
 * checkboxes that build the space-separated ID list in the textarea.
 * 旧 package.ts の displayNicommonsIdList に相当する。データ取得は tRPC 経由で
 * main プロセス。レガシー側からの再描画通知は apm-packages-changed イベント。
 * @returns {JSX.Element} The rendered component.
 */
function NicommonsTab(): JSX.Element {
  const [instPath, setInstPath] = useState(() => getInstallationPath());
  // 除外したもの(チェックを外したもの)だけを持つ。一覧の再取得時に全部
  // チェック済みへ戻る旧挙動と同じにするため、checked の集合は持たない
  const [uncheckedIds, setUncheckedIds] = useState<ReadonlySet<string>>(
    new Set(),
  );

  const utils = TRPCReact.useContext();
  const packagesQuery = TRPCReact.packages.getPackages.useQuery(instPath, {
    refetchOnWindowFocus: false,
  });
  const packages = useMemo(
    () => (packagesQuery.data ?? []) as PackageItem[],
    [packagesQuery.data],
  );

  const candidateIds = useMemo(
    () => packages.filter((p) => p.info.nicommons).map((p) => p.id),
    [packages],
  );
  const installedIdsQuery = TRPCReact.packages.getApmJsonInstalledIds.useQuery(
    { instPath, ids: candidateIds },
    { refetchOnWindowFocus: false, enabled: packagesQuery.isSuccess },
  );

  useEffect(() => {
    const onCoreChanged = () => {
      setInstPath(getInstallationPath());
    };
    const onPackagesChanged = () => {
      void utils.packages.getPackages.invalidate();
      void utils.packages.getApmJsonInstalledIds.invalidate();
      // 旧実装は再描画のたびに全チェック済みへ戻していた
      setUncheckedIds(new Set());
    };
    window.addEventListener('apm-core-changed', onCoreChanged);
    window.addEventListener('apm-packages-changed', onPackagesChanged);
    return () => {
      window.removeEventListener('apm-core-changed', onCoreChanged);
      window.removeEventListener('apm-packages-changed', onPackagesChanged);
    };
  }, [utils]);

  const items = useMemo<NicommonsItem[]>(() => {
    const installedIds = new Set(installedIdsQuery.data ?? []);
    return [
      {
        name: 'AviUtl',
        developer: 'KENくん',
        typeBadges: [],
        nicommons: 'im1696493',
      },
      {
        name: 'AviUtl Package Manager',
        developer: 'Team apm',
        typeBadges: [],
        nicommons: 'nc251912',
      },
      ...packages
        .filter((p) => installedIds.has(p.id) && p.info.nicommons)
        .map((p) => ({
          name: p.info.name,
          developer: p.info.developer,
          originalDeveloper: p.info.originalDeveloper,
          typeBadges: parsePackageType(p.type ?? []),
          nicommons: p.info.nicommons,
        })),
    ];
  }, [packages, installedIdsQuery.data]);

  // チェック状態に応じて textarea(レガシー DOM、コピーは ClipboardJS)を更新
  useEffect(() => {
    const textarea = document.getElementById(
      'nicommons-id-textarea',
    ) as HTMLTextAreaElement | null;
    if (!textarea) return;
    textarea.value = items
      .filter((item) => !uncheckedIds.has(item.nicommons))
      .map((item) => item.nicommons)
      .join(' ');
  }, [items, uncheckedIds]);

  return (
    <>
      {items.map((item) => (
        <NicommonsRow
          key={item.nicommons}
          item={item}
          checked={!uncheckedIds.has(item.nicommons)}
          onChange={(checked) =>
            setUncheckedIds((prev) => {
              const next = new Set(prev);
              if (checked) next.delete(item.nicommons);
              else next.add(item.nicommons);
              return next;
            })
          }
        />
      ))}
    </>
  );
}

export default NicommonsTab;
