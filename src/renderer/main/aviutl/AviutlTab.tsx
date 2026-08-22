import React, { type JSX, useSyncExternalStore } from 'react';
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
    <div className="container-lg py-2 m-w-800">
      <nav className="navbar navbar-light">
        <div className="container-fluid">
          <span className="navbar-brand">
            <img
              src={apmIcon}
              alt=""
              className="d-inline-block"
              width="20"
              height="20"
            />
            <span className="ms-1 align-middle">AviUtl Package Manager</span>
          </span>
        </div>
      </nav>
      <TutorialAlert />
      <div className="row my-2 card">
        <div className="card-body">
          <div className="mb-3 d-flex">
            <div
              className="flex-grow-1 border rounded-start d-flex align-items-center ps-3"
              id="addon-wrapping"
            >
              <i className="bi bi-folder2 me-3"></i>
              <input
                className="form-control-plaintext"
                id="installation-path"
                type="text"
                placeholder="AviUtlフォルダ"
                aria-label="Installation path"
                readOnly
                value={installationPath}
              />
            </div>
            <div className="d-flex">
              <SelectInstallationPathButton />
            </div>
          </div>
          <ul className="list-group mb-3" id="batch-install-packages">
            <li className="list-group-item py-0 pe-0 d-flex">
              <ProgramRow
                program="aviutl"
                label="AviUtl"
                iconClass="bi-film"
                buttonRoundedClass="rounded-start-0 rounded-bottom-0"
              />
            </li>
            <li className="list-group-item py-0 pe-0 d-flex">
              <ProgramRow
                program="exedit"
                label="拡張編集"
                iconClass="bi-calendar3-range"
                buttonRoundedClass="rounded-0"
              />
            </li>
            <BatchInstallList />
          </ul>
          <div className="d-flex justify-content-end">
            <BatchInstallButton />
          </div>
        </div>
      </div>
    </div>
  );
}

export default AviutlTab;
