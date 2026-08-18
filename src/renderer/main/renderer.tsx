import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min';
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../../node_modules/bootstrap-icons/font/bootstrap-icons.css';
import '../main.css';
import './index.css';
import BatchInstallList from './aviutl/BatchInstallList';
import ProgramRow from './aviutl/ProgramRow';
import { MonacoEditorRenderer } from './monacoEditorRenderer';
import NicommonsTab from './nicommons/NicommonsTab';
import OthersTab from './others/OthersTab';
import PackagesTab from './packages/PackagesTab';
import DataUrlSettings from './settings/DataUrlSettings';
import PreferencesSettings from './settings/PreferencesSettings';
import { TrpcProvider } from './TrpcProvider';

window.addEventListener('DOMContentLoaded', () => {
  const root = createRoot(document.getElementById('container'));
  root.render(
    <MonacoEditorRenderer
      saveButton={
        document.getElementById('save-editor-data') as HTMLButtonElement
      }
    />,
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
  createRoot(document.getElementById('aviutl-program-root')).render(
    <TrpcProvider>
      <ProgramRow
        program="aviutl"
        label="AviUtl"
        iconClass="bi-film"
        buttonRoundedClass="rounded-start-0 rounded-bottom-0"
      />
    </TrpcProvider>,
  );
  createRoot(document.getElementById('exedit-program-root')).render(
    <TrpcProvider>
      <ProgramRow
        program="exedit"
        label="拡張編集"
        iconClass="bi-calendar3-range"
        buttonRoundedClass="rounded-0"
      />
    </TrpcProvider>,
  );
  // おすすめプラグイン一覧は portal で #batch-install-packages(ul)へ描画する
  createRoot(document.getElementById('batch-install-react-root')).render(
    <TrpcProvider>
      <BatchInstallList />
    </TrpcProvider>,
  );
});
