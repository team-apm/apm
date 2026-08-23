import React, {
  type JSX,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  Badge,
  Button,
  Card,
  Col,
  Container,
  Form,
  ListGroup,
  Row,
} from 'react-bootstrap';
import { parsePackageType } from '../../../shared/packageDisplay';
import type { PackageState } from '../../../types/packageState';
import { TRPCReact } from '../../trpc';
import {
  getInstallationPath,
  subscribeInstallationPath,
} from '../installationPath';

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
    { node?: { thumbnailURL?: string } } | false | undefined;
  const thumbnailURL =
    nicommonsData && nicommonsData.node?.thumbnailURL
      ? nicommonsData.node.thumbnailURL.replace('size=l', 'size=s')
      : null;

  return (
    <ListGroup.Item as="li" action>
      <label className="d-block">
        <Row>
          <Col xs="auto" className="d-flex align-items-center">
            <Form.Check.Input
              className="m-0"
              type="checkbox"
              name="nicommons-id"
              value={item.nicommons}
              checked={checked}
              onChange={(e) => onChange(e.target.checked)}
            />
          </Col>
          <Col sm={1} className="d-flex align-items-center thumbnail">
            {thumbnailURL && (
              <img src={thumbnailURL} className="img-fluid" alt="" />
            )}
          </Col>
          <Col>
            <h5 className="d-inline-block name">{item.name}</h5>
            <div className="text-primary d-inline-block ms-2 developer">
              {item.originalDeveloper
                ? `${item.developer}（オリジナル：${item.originalDeveloper}）`
                : item.developer}
            </div>
            <div className="d-inline-block ms-1 type">
              {item.typeBadges.map((e, i) => (
                /* bg の既定値 primary は bg-primary(!important)を足して
                   main.css の .badge の配色を上書きするため空文字で外す */
                <Badge
                  key={i}
                  bg=""
                  className="list-group-item-light d-block fw-normal"
                >
                  {e}
                </Badge>
              ))}
            </div>
            <br />
            <div className="d-inline-block text-break nicommons text-muted">
              {item.nicommons}
            </div>
          </Col>
        </Row>
      </label>
    </ListGroup.Item>
  );
}

/**
 * The whole pane of the nicommons ID tab (旧 index.html の section#nicommons
 * の中身): installed packages with a nicommons ID, with checkboxes that
 * build the space-separated ID list in the textarea.
 * 旧 package.ts の displayNicommonsIdList に相当する。データ取得は tRPC 経由で
 * main プロセス。他コンポーネントからの再描画通知は apm-packages-changed イベント。
 * コピーボタンは tRPC(writeClipboardText)でコピーする(旧実装は preload が
 * 初期化する ClipboardJS。コピーされる文字列は同じ)。
 * @returns {JSX.Element} The rendered component.
 */
function NicommonsTab(): JSX.Element {
  // インストール先はストアを購読する。DOM イベント経由で読み直すと、
  // 通知の発火とストア更新の順序に依存してしまう(起動フローも
  // SelectInstallationPathButton も setInstallationPath の前後で撃つ)
  const installationPath = useSyncExternalStore(
    subscribeInstallationPath,
    getInstallationPath,
  );
  // 除外したもの(チェックを外したもの)だけを持つ。一覧の再取得時に全部
  // チェック済みへ戻る旧挙動と同じにするため、checked の集合は持たない
  const [uncheckedIds, setUncheckedIds] = useState<ReadonlySet<string>>(
    new Set(),
  );

  const utils = TRPCReact.useUtils();
  const writeClipboardMutation = TRPCReact.writeClipboardText.useMutation();
  const packagesQuery = TRPCReact.packages.getPackages.useQuery(
    installationPath,
    {
      refetchOnWindowFocus: false,
    },
  );
  const packages = useMemo(
    () => (packagesQuery.data ?? []) as PackageState[],
    [packagesQuery.data],
  );

  const candidateIds = useMemo(
    () => packages.filter((p) => p.info.nicommons).map((p) => p.id),
    [packages],
  );
  const installedIdsQuery = TRPCReact.packages.getLedgerInstalledIds.useQuery(
    { installationPath, ids: candidateIds },
    { refetchOnWindowFocus: false, enabled: packagesQuery.isSuccess },
  );

  useEffect(() => {
    const onPackagesChanged = () => {
      void utils.packages.getPackages.invalidate();
      void utils.packages.getLedgerInstalledIds.invalidate();
      // 旧実装は再描画のたびに全チェック済みへ戻していた
      setUncheckedIds(new Set());
    };
    window.addEventListener('apm-packages-changed', onPackagesChanged);
    return () => {
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
        .filter((p) => installedIds.has(p.id))
        .flatMap((p) =>
          p.info.nicommons
            ? [
                {
                  name: p.info.name,
                  developer: p.info.developer,
                  originalDeveloper: p.info.originalDeveloper,
                  typeBadges: parsePackageType(p.type ?? []),
                  nicommons: p.info.nicommons,
                },
              ]
            : [],
        ),
    ];
  }, [packages, installedIdsQuery.data]);

  const idListText = useMemo(
    () =>
      items
        .filter((item) => !uncheckedIds.has(item.nicommons))
        .map((item) => item.nicommons)
        .join(' '),
    [items, uncheckedIds],
  );

  return (
    <Container fluid="lg">
      <Card className="row border-top-0 border-bottom-0 rounded-0">
        <Card.Body className="d-flex flex-column py-2">
          <Row className="pb-2 border-bottom">
            <Col xs="auto">
              <Button
                variant="primary"
                id="copy-nicommons-id-textarea"
                onClick={() =>
                  writeClipboardMutation.mutate({ text: idListText })
                }
              >
                コピー
              </Button>
            </Col>
            <Col>
              <Form.Control
                as="textarea"
                rows={1}
                name="nicommons-id-textarea"
                id="nicommons-id-textarea"
                readOnly
                value={idListText}
              />
            </Col>
          </Row>
          <Row className="flex-grow-1 overflow-auto">
            <Col>
              <ListGroup as="ul" variant="flush" id="nicommons-id-list">
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
              </ListGroup>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </Container>
  );
}

export default NicommonsTab;
