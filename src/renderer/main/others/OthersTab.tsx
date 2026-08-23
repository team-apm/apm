import React, { type JSX } from 'react';
import {
  Button,
  ButtonGroup,
  Card,
  Col,
  Container,
  Row,
} from 'react-bootstrap';
import { TRPCReact } from '../../trpc';

/**
 * The "その他" tab: about, external links, and quitting the app.
 * 外部リンクは will-navigate ハンドラ(main プロセス)が外部ブラウザで開く。
 * @returns {JSX.Element} The rendered component.
 */
function OthersTab() {
  const { data: appName } = TRPCReact.getAppName.useQuery();
  const openAboutWindow = TRPCReact.openAboutWindow.useMutation();
  const openLogFolder = TRPCReact.openLogFolder.useMutation();
  const quitApp = TRPCReact.quitApp.useMutation();

  return (
    <Container fluid="lg" className="py-2">
      <Row className="my-2">
        <Card>
          <Card.Body>
            <Card.Title as="h3">その他</Card.Title>
            <Row className="mb-3">
              <Col as="p" sm={6} className="col-form-label">
                <span className="app-name">{appName}</span>について
              </Col>
              <ButtonGroup vertical className="col-sm-6">
                <Button
                  variant="primary"
                  id="open-about-window"
                  onClick={() => openAboutWindow.mutate()}
                >
                  このアプリについて
                </Button>

                <ButtonGroup>
                  <Button
                    variant="primary"
                    href="https://github.com/team-apm/apm"
                  >
                    <i className="bi bi-github"></i> GitHub
                  </Button>
                  <Button
                    variant="primary"
                    href="https://discord.gg/YEQRqnGsG2"
                  >
                    <i className="bi bi-discord"></i> Discord
                  </Button>
                </ButtonGroup>
              </ButtonGroup>
            </Row>
            <Row className="mb-3">
              <Col as="p" sm={6} className="col-form-label">
                プラグイン&スクリプトデータの作成
              </Col>
              <Col sm={6}>
                <Button
                  variant="primary"
                  className="w-100"
                  href="https://team-apm.github.io/apm-web/"
                >
                  開く <i className="bi bi-box-arrow-up-right"></i>
                </Button>
              </Col>
            </Row>
            <Row className="mb-3">
              <Col as="p" sm={6} className="col-form-label">
                機能要求・バグ報告（外部ブラウザが開きます）
              </Col>
              <Col sm={3}>
                <Button
                  variant="primary"
                  className="w-100"
                  href="https://docs.google.com/forms/d/e/1FAIpQLSf0N-X_u_abi8rrWHVDdiK3YeYuQ7J1f8bQAy6QTD-OR94DWQ/viewform?usp=sf_link"
                >
                  Googleフォーム <i className="bi bi-box-arrow-up-right"></i>
                </Button>
              </Col>
              <Col sm={3}>
                <Button
                  variant="primary"
                  className="w-100"
                  href="https://github.com/team-apm/apm/issues"
                >
                  <i className="bi bi-github"></i> GitHub (要アカウント)
                  <i className="bi bi-box-arrow-up-right"></i>
                </Button>
              </Col>
            </Row>
            <Row className="mb-3">
              <Col as="p" sm={6} className="col-form-label">
                バグ報告に添えるログ
              </Col>
              <Col sm={6}>
                <Button
                  variant="primary"
                  className="w-100"
                  id="open-log-folder"
                  onClick={() => openLogFolder.mutate()}
                >
                  ログフォルダを開く <i className="bi bi-folder2-open"></i>
                </Button>
              </Col>
            </Row>
            <Row className="mb-3">
              <Col as="p" sm={6} className="col-form-label"></Col>
              <Col sm={6}>
                <Button
                  variant="primary"
                  className="w-100"
                  id="quit-app"
                  onClick={() => quitApp.mutate()}
                >
                  終了
                </Button>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      </Row>
    </Container>
  );
}

export default OthersTab;
