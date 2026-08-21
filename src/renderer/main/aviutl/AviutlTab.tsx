import React, { type JSX } from 'react';
import BatchInstallButton from './BatchInstallButton';
import BatchInstallList from './BatchInstallList';
import ProgramRow from './ProgramRow';
import SelectInstallationPathButton from './SelectInstallationPathButton';

/**
 * The whole pane of the AviUtl tab (旧 index.html の section#aviutl の中身).
 * このコンポーネントは状態を持たず初回の 1 回しかレンダーしない前提。
 * それを崩さないこと — 以下の 2 点がレガシー(preload の初期化フロー)からの
 * 直接 DOM 操作に依存しており、再レンダーしなければ React と衝突しない:
 * - #installation-path(readonly input)の値は preload と
 *   SelectInstallationPathButton が直接書き、各所が instPath.ts で読む
 * - #tutorial-alert は初回起動時に preload が d-none を外し、閉じるボタンは
 *   Bootstrap の data-bs-dismiss が DOM ごと除去する
 * @returns {JSX.Element} The rendered component.
 */
function AviutlTab(): JSX.Element {
  return (
    <div className="container-lg py-2 m-w-800">
      <nav className="navbar navbar-light">
        <div className="container-fluid">
          <span className="navbar-brand">
            <img
              src="../../../icon/apm32.png"
              alt=""
              className="d-inline-block"
              width="20"
              height="20"
            />
            <span className="ms-1 align-middle">AviUtl Package Manager</span>
          </span>
        </div>
      </nav>
      <div id="tutorial-alert" className="row my-2 d-none">
        <div
          className="my-0 alert alert-info alert-dismissible fade show"
          role="alert"
        >
          apmへようこそ！
          <a
            href="https://team-apm.github.io/apm/#apm%E3%81%AE%E3%83%81%E3%83%A5%E3%83%BC%E3%83%88%E3%83%AA%E3%82%A2%E3%83%AB"
            className="alert-link"
          >
            チュートリアル
          </a>
          から使い方を確認できます。
          <button
            type="button"
            className="btn-close"
            data-bs-dismiss="alert"
            aria-label="Close"
          ></button>
        </div>
      </div>
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
