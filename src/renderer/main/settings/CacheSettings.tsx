import React, { type JSX } from 'react';
import { Button, Col, Form, Row, Spinner } from 'react-bootstrap';
import { formatBytes } from '../../../shared/formatBytes';
import { TRPCReact } from '../../trpc';
import { usePhase } from '../usePhase';

/**
 * The download cache size and a button to clear it (ダウンロードキャッシュ).
 * @returns {JSX.Element} The rendered component.
 */
function CacheSettings(): JSX.Element {
  const cacheSize = TRPCReact.settings.getCacheSize.useQuery();
  const clearCache = TRPCReact.settings.clearCache.useMutation();
  const clear = usePhase();

  const onClick = async () => {
    clear.start();
    try {
      const freed = await clearCache.mutateAsync();
      // null はダイアログでキャンセルされた場合。メッセージを出さずに戻す
      if (freed === null) {
        clear.finishSilently();
        return;
      }
      await cacheSize.refetch();
      clear.finish(`${formatBytes(freed)}を削除`, 'success');
    } catch {
      clear.finish('エラー', 'danger');
    }
  };

  const color = clear.phase.kind === 'message' ? clear.phase.color : 'primary';

  return (
    <Row className="mb-3">
      <Form.Label htmlFor="clear-cache" column sm={3}>
        ダウンロードキャッシュ
      </Form.Label>
      <Col sm={6} className="d-flex align-items-center">
        <span className="text-body-secondary">
          {cacheSize.data === undefined
            ? '計算中…'
            : `${formatBytes(cacheSize.data)} 使用中`}
        </span>
      </Col>
      <Col sm={3}>
        <Button
          variant={`outline-${color}`}
          className="w-100"
          id="clear-cache"
          disabled={clear.phase.kind === 'loading' || !cacheSize.data}
          onClick={() => void onClick()}
        >
          {clear.phase.kind === 'loading' ? (
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
          ) : clear.phase.kind === 'message' ? (
            clear.phase.message
          ) : (
            '削除'
          )}
        </Button>
      </Col>
    </Row>
  );
}

export default CacheSettings;
