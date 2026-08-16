import React, { type JSX } from 'react';
import { TRPCReact } from '../../trpc';

/**
 * The "その他" tab: about, external links, and quitting the app.
 * 外部リンクは will-navigate ハンドラ(main プロセス)が外部ブラウザで開く。
 * @returns {JSX.Element} The rendered component.
 */
function OthersTab() {
  const { data: appName } = TRPCReact.getAppName.useQuery();
  const openAboutWindow = TRPCReact.openAboutWindow.useMutation();
  const quitApp = TRPCReact.quitApp.useMutation();

  return (
    <div className="container-lg py-2">
      <div className="row my-2">
        <div className="card">
          <div className="card-body">
            <h3 className="card-title">その他</h3>
            <div className="row mb-3">
              <p className="col-sm-6 col-form-label">
                <span className="app-name">{appName}</span>について
              </p>
              <div className="col-sm-6 btn-group-vertical">
                <button
                  type="button"
                  className="btn btn-primary"
                  id="open-about-window"
                  onClick={() => openAboutWindow.mutate()}
                >
                  このアプリについて
                </button>

                <div className="btn-group" role="group">
                  <a
                    href="https://github.com/team-apm/apm"
                    role="button"
                    className="btn btn-primary"
                  >
                    <i className="bi bi-github"></i> GitHub
                  </a>
                  <a
                    href="https://discord.gg/YEQRqnGsG2"
                    role="button"
                    className="btn btn-primary"
                  >
                    <i className="bi bi-discord"></i> Discord
                  </a>
                </div>
              </div>
            </div>
            <div className="row mb-3">
              <p className="col-sm-6 col-form-label">
                プラグイン&スクリプトデータの作成
              </p>
              <div className="col-sm-6">
                <a
                  href="https://team-apm.github.io/apm-web/"
                  role="button"
                  className="btn btn-primary w-100"
                >
                  開く <i className="bi bi-box-arrow-up-right"></i>
                </a>
              </div>
            </div>
            <div className="row mb-3">
              <p className="col-sm-6 col-form-label">
                機能要求・バグ報告（外部ブラウザが開きます）
              </p>
              <div className="col-sm-3">
                <a
                  href="https://docs.google.com/forms/d/e/1FAIpQLSf0N-X_u_abi8rrWHVDdiK3YeYuQ7J1f8bQAy6QTD-OR94DWQ/viewform?usp=sf_link"
                  role="button"
                  className="btn btn-primary w-100"
                >
                  Googleフォーム <i className="bi bi-box-arrow-up-right"></i>
                </a>
              </div>
              <div className="col-sm-3">
                <a
                  href="https://github.com/team-apm/apm/issues"
                  role="button"
                  className="btn btn-primary w-100"
                >
                  <i className="bi bi-github"></i> GitHub (要アカウント)
                  <i className="bi bi-box-arrow-up-right"></i>
                </a>
              </div>
            </div>
            <div className="row mb-3">
              <p className="col-sm-6 col-form-label"></p>
              <div className="col-sm-6">
                <button
                  type="button"
                  className="btn btn-primary w-100"
                  id="quit-app"
                  onClick={() => quitApp.mutate()}
                >
                  終了
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OthersTab;
