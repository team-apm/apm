import log from 'electron-log/renderer';
import React, { type JSX, useEffect, useRef, useState } from 'react';
import { Button, Col, Form, Row, Spinner } from 'react-bootstrap';
import { TRPCReact } from '../../trpc';

type ButtonPhase = 'idle' | 'loading' | 'success' | 'danger';

/**
 * The data files URL settings form (データ取得先・追加データ取得先).
 * 旧 setting.ts の setDataUrl と同じ流れ: 検証+保存(tRPC)→ エラーは
 * ダイアログ表示、成功時は modList.updateInfo とボタンの完了表示。
 * @returns {JSX.Element} The rendered component.
 */
function DataUrlSettings() {
  const { data } = TRPCReact.settings.getDataUrls.useQuery();
  const [mainUrl, setMainUrl] = useState<string | null>(null);
  const [extraUrls, setExtraUrls] = useState<string | null>(null);
  const [phase, setPhase] = useState<ButtonPhase>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const setDataUrls = TRPCReact.settings.setDataUrls.useMutation();
  const updateInfo = TRPCReact.modList.updateInfo.useMutation();
  const openDialog = TRPCReact.openDialog.useMutation();
  const utils = TRPCReact.useUtils();

  const mainValue = mainUrl ?? data?.main ?? '';
  const extraValue = extraUrls ?? data?.extra ?? '';

  const onSet = async () => {
    // 前回の復帰タイマーが残っていると loading 中に idle へ戻されるため消す
    clearTimeout(timer.current);
    setPhase('loading');
    try {
      const result = await setDataUrls.mutateAsync({
        mainUrl: mainValue,
        extraDataUrls: extraValue,
      });
      // 未承認オリジンの確認ダイアログでキャンセルされたときは保存されて
      // いないので、成功でも失敗でもなく入力へ戻る
      if (result.canceled) {
        setPhase('idle');
        return;
      }
      setMainUrl(result.mainUrl);
      for (const message of result.errors) {
        await openDialog.mutateAsync({
          title: 'エラー',
          message,
          type: 'error',
        });
      }
      if (result.errors.length === 0) {
        await updateInfo.mutateAsync();
        await utils.settings.getDataUrls.invalidate();
        setPhase('success');
      } else {
        setPhase('danger');
      }
    } catch (e) {
      log.error('Failed to set the data URLs.', e);
      setPhase('danger');
    }
    timer.current = setTimeout(() => setPhase('idle'), 3000);
  };

  const variant =
    phase === 'success' ? 'success' : phase === 'danger' ? 'danger' : 'primary';

  return (
    <>
      <Row className="mb-3">
        <Form.Label htmlFor="data-url" column sm={3}>
          データ取得先
        </Form.Label>
        <Col sm={6}>
          <Form.Control
            id="data-url"
            type="text"
            placeholder="空白でデフォルト"
            aria-label="Data URL"
            value={mainValue}
            onChange={(e) => setMainUrl(e.target.value)}
          />
        </Col>
        <Col sm={3}>
          <Button
            variant={variant}
            className="w-100"
            id="set-data-url"
            disabled={phase === 'loading'}
            onClick={onSet}
          >
            {phase === 'loading' ? (
              <>
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                />
                <span className="visually-hidden">Loading...</span>
              </>
            ) : phase === 'success' ? (
              '設定完了'
            ) : phase === 'danger' ? (
              'エラーが発生しました。'
            ) : (
              '設定'
            )}
          </Button>
        </Col>
      </Row>
      <Row className="mb-3">
        <Form.Label htmlFor="extra-data-url" column sm={3}>
          追加データ取得先
        </Form.Label>
        <Col sm={6}>
          <Form.Control
            as="textarea"
            id="extra-data-url"
            placeholder="例: https://example.com/packages.json"
            aria-label="Extra Data URL"
            value={extraValue}
            onChange={(e) => setExtraUrls(e.target.value)}
          />
        </Col>
        <Col sm={3}></Col>
      </Row>
    </>
  );
}

export default DataUrlSettings;
