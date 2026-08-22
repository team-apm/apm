import React, { type JSX } from 'react';
import { Card, Col, Container, Form, Row, Table } from 'react-bootstrap';
import { MonacoEditorRenderer } from '../monacoEditorRenderer';
import CacheSettings from './CacheSettings';
import DataUrlSettings from './DataUrlSettings';
import ManualUpdateTable from './ManualUpdateTable';
import PreferencesSettings from './PreferencesSettings';

/**
 * The whole pane of the settings tab (旧 index.html の section#settings の
 * 中身): データ取得先・追加テキストデータ(Monaco エディタ)・環境設定・
 * ダウンロードキャッシュ・手動更新テーブル。
 * @returns {JSX.Element} The rendered component.
 */
function SettingsTab(): JSX.Element {
  return (
    <Container fluid="lg" className="py-2">
      <Row className="my-2">
        <Card>
          <Card.Body>
            <Card.Title as="h3">設定</Card.Title>
            <DataUrlSettings />
            <Row className="mb-3">
              <Form.Label htmlFor="container">追加テキストデータ</Form.Label>
              <MonacoEditorRenderer />
            </Row>
            <PreferencesSettings />
            <CacheSettings />
            <hr />
            <Row className="mb-3">
              <h4>手動更新</h4>
              <Table borderless striped>
                <thead>
                  <tr>
                    <Col as="th" scope="col" sm={3}></Col>
                    <Col as="th" scope="col" sm={3}>
                      リスト更新日時
                    </Col>
                    <Col as="th" scope="col" sm={3}>
                      最終更新日時
                    </Col>
                    <Col as="th" scope="col" sm={3}></Col>
                  </tr>
                </thead>
                <tbody className="align-middle" id="manual-update-tbody">
                  <ManualUpdateTable />
                </tbody>
              </Table>
            </Row>
          </Card.Body>
        </Card>
      </Row>
    </Container>
  );
}

export default SettingsTab;
