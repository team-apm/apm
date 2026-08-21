import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min';
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../../node_modules/bootstrap-icons/font/bootstrap-icons.css';
import '../main.css';
import './index.css';
import AviutlTab from './aviutl/AviutlTab';
import { MonacoEditorRenderer } from './monacoEditorRenderer';
import NicommonsTab from './nicommons/NicommonsTab';
import OthersTab from './others/OthersTab';
import PackagesTab from './packages/PackagesTab';
import DataUrlSettings from './settings/DataUrlSettings';
import ManualUpdateTable from './settings/ManualUpdateTable';
import PreferencesSettings from './settings/PreferencesSettings';
import { TrpcProvider } from './TrpcProvider';

window.addEventListener('DOMContentLoaded', () => {
  const root = createRoot(document.getElementById('container'));
  root.render(
    <TrpcProvider>
      <MonacoEditorRenderer />
    </TrpcProvider>,
  );

  createRoot(document.getElementById('settings-data-url-root')).render(
    <TrpcProvider>
      <DataUrlSettings />
    </TrpcProvider>,
  );
  createRoot(document.getElementById('settings-preferences-root')).render(
    <TrpcProvider>
      <PreferencesSettings />
    </TrpcProvider>,
  );
  // 手動更新テーブルは portal で #manual-update-tbody(tbody)へ描画する
  createRoot(document.getElementById('manual-update-react-root')).render(
    <TrpcProvider>
      <ManualUpdateTable />
    </TrpcProvider>,
  );
  createRoot(document.getElementById('others-root')).render(
    <TrpcProvider>
      <OthersTab />
    </TrpcProvider>,
  );
  createRoot(document.getElementById('nicommons-id-list')).render(
    <TrpcProvider>
      <NicommonsTab />
    </TrpcProvider>,
  );
  createRoot(document.getElementById('packages-react-root')).render(
    <TrpcProvider>
      <PackagesTab />
    </TrpcProvider>,
  );
  // AviUtl タブは pane 全体を 1 ルートで描画する(タブの切り替え自体は
  // 引き続き index.html のナビ + Bootstrap tab が section の class を切り替える)
  createRoot(document.getElementById('aviutl')).render(
    <TrpcProvider>
      <AviutlTab />
    </TrpcProvider>,
  );
});
