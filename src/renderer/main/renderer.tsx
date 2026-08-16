import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min';
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../../node_modules/bootstrap-icons/font/bootstrap-icons.css';
import '../main.css';
import './index.css';
import { MonacoEditorRenderer } from './monacoEditorRenderer';
import OthersTab from './others/OthersTab';
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
});
