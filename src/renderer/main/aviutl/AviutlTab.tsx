import React, { type JSX, useSyncExternalStore } from 'react';
import { Card, Container, Form, ListGroup, Navbar } from 'react-bootstrap';
import apmIcon from '../../../../icon/apm32.png';
import {
  getInstallationPath,
  subscribeInstallationPath,
} from '../installationPath';
import BatchInstallButton from './BatchInstallButton';
import BatchInstallList from './BatchInstallList';
import ProgramRow from './ProgramRow';
import SelectInstallationPathButton from './SelectInstallationPathButton';
import TutorialAlert from './TutorialAlert';

/**
 * The whole pane of the AviUtl tab (旧 index.html の section#aviutl の中身).
 * インストール先の表示は installationPath ストアの購読で更新する(旧実装は
 * preload が #installation-path の value を直接書いていた)。
 * @returns {JSX.Element} The rendered component.
 */
function AviutlTab(): JSX.Element {
  const installationPath = useSyncExternalStore(
    subscribeInstallationPath,
    getInstallationPath,
  );
  return (
    <Container fluid="lg" className="py-2 m-w-800">
      {/* expand の既定値 true は navbar-expand を足して折り返しを止めるため、
          横幅いっぱいに広がるこの行では明示的に無効にする */}
      <Navbar expand={false}>
        <Container fluid>
          <Navbar.Brand>
            <img
              src={apmIcon}
              alt=""
              className="d-inline-block"
              width="20"
              height="20"
            />
            <span className="ms-1 align-middle">AviUtl Package Manager</span>
          </Navbar.Brand>
        </Container>
      </Navbar>
      <TutorialAlert />
      <Card className="row my-2">
        <Card.Body>
          <div className="mb-3 d-flex">
            <div
              className="flex-grow-1 border rounded-start d-flex align-items-center ps-3"
              id="addon-wrapping"
            >
              <i className="bi bi-folder2 me-3"></i>
              <Form.Control
                plaintext
                id="installation-path"
                type="text"
                placeholder="AviUtlフォルダ"
                aria-label="Installation path"
                readOnly
                // 幅に収まらないパスはフォルダ選択ボタンの下に潜って読めなくなる。
                // 省略記号も出ない(plaintext の input なので text-overflow が効かない)。
                // 幅を広げるとボタンが押し出されるため、ホバーで全体を出す
                title={installationPath}
                value={installationPath}
              />
            </div>
            <div className="d-flex">
              <SelectInstallationPathButton />
            </div>
          </div>
          <ListGroup as="ul" className="mb-3" id="batch-install-packages">
            <ListGroup.Item as="li" className="py-0 pe-0 d-flex">
              <ProgramRow
                program="aviutl"
                label="AviUtl"
                iconClass="bi-film"
                buttonRoundedClass="rounded-start-0 rounded-bottom-0"
              />
            </ListGroup.Item>
            <ListGroup.Item as="li" className="py-0 pe-0 d-flex">
              <ProgramRow
                program="exedit"
                label="拡張編集"
                iconClass="bi-calendar3-range"
                buttonRoundedClass="rounded-0"
              />
            </ListGroup.Item>
            <BatchInstallList />
          </ListGroup>
          <div className="d-flex justify-content-end">
            <BatchInstallButton />
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
}

export default AviutlTab;
