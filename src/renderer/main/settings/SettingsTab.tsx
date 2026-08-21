import React, { type JSX } from 'react';
import { MonacoEditorRenderer } from '../monacoEditorRenderer';
import DataUrlSettings from './DataUrlSettings';
import ManualUpdateTable from './ManualUpdateTable';
import PreferencesSettings from './PreferencesSettings';

/**
 * The whole pane of the settings tab (旧 index.html の section#settings の
 * 中身): データ取得先・追加テキストデータ(Monaco エディタ)・環境設定・
 * 手動更新テーブル。
 * @returns {JSX.Element} The rendered component.
 */
function SettingsTab(): JSX.Element {
  return (
    <div className="container-lg py-2">
      <div className="row my-2">
        <div className="card">
          <div className="card-body">
            <h3 className="card-title">設定</h3>
            <DataUrlSettings />
            <div className="row mb-3">
              <label htmlFor="container" className="form-label">
                追加テキストデータ
              </label>
              <MonacoEditorRenderer />
            </div>
            <PreferencesSettings />
            <hr />
            <div className="row mb-3">
              <h4>手動更新</h4>
              <table className="table table-borderless table-striped">
                <thead>
                  <tr>
                    <th scope="col" className="col-sm-3"></th>
                    <th scope="col" className="col-sm-3">
                      リスト更新日時
                    </th>
                    <th scope="col" className="col-sm-3">
                      最終更新日時
                    </th>
                    <th scope="col" className="col-sm-3"></th>
                  </tr>
                </thead>
                <tbody className="align-middle" id="manual-update-tbody">
                  <ManualUpdateTable />
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsTab;
