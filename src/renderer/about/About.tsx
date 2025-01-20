import React, { type JSX } from 'react';
import { Col, Container, Image, Row } from 'react-bootstrap';
import { TRPCReact } from '../trpc';
import apmLogo from '../../../icon/apm1024.png';

/**
 * About component.
 * @returns {JSX.Element} The rendered component.
 */
function About() {
  const { data: appVersion } = TRPCReact.getAppVersion.useQuery();

  return (
    <Container fluid className="d-flex flex-column py-2 bg-dark text-white">
      <Row>
        <Col xs="9">
          <h1>
            apm
            <br />
            <span className="lead">AviUtl Package Manager</span>
          </h1>
        </Col>
        <Col xs="3">
          <Image thumbnail src={apmLogo} alt="apm Logo" />
        </Col>
      </Row>

      <Row className="flex-grow-1 my-2" id="detail">
        <Col className="bg-secondary mx-4 pt-1">
          <h2>Versions</h2>
          <ul className="list-unstyled">
            <li>apm: {appVersion}</li>
            <li>Node.js: {window.process.versions.node}</li>
            <li>Chromium: {window.process.versions.chrome}</li>
            <li>Electron: {window.process.versions.electron}</li>
          </ul>

          <h2>Copyright</h2>
          <p>Copyright (c) 2021 ato lash</p>

          <h2>Contributors</h2>
          <ul className="list-unstyled">
            <li>Mitosagi</li>
            <li></li>
          </ul>

          <h2>License</h2>
          <p>このアプリは、MIT Licenseのもとで公開されています。</p>

          <h2>Third-party Licenses</h2>
          <p>
            サードパーティーライセンスについては、apmインストールフォルダのresources/ThirdPartyNotices.txtをご覧ください。
          </p>
        </Col>
      </Row>

      <Row>
        <Col>
          <small className="text-white-50">クリックして閉じる</small>
        </Col>
      </Row>
    </Container>
  );
}

export default About;
