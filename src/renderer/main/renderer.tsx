import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min';
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../../node_modules/bootstrap-icons/font/bootstrap-icons.css';
import '../main.css';
import './index.css';
import AviutlTab from './aviutl/AviutlTab';
import NicommonsTab from './nicommons/NicommonsTab';
import OthersTab from './others/OthersTab';
import PackagesTab from './packages/PackagesTab';
import SettingsTab from './settings/SettingsTab';
import { TrpcProvider } from './TrpcProvider';

window.addEventListener('DOMContentLoaded', () => {
  // 設定タブは pane 全体を 1 ルートで描画する
  createRoot(document.getElementById('settings')).render(
    <TrpcProvider>
      <SettingsTab />
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
  // プラグイン&スクリプトタブは pane 全体を 1 ルートで描画する
  createRoot(document.getElementById('packages')).render(
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
