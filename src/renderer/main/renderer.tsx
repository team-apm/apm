import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min';
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../../node_modules/bootstrap-icons/font/bootstrap-icons.css';
import '../main.css';
import './index.css';
import { MonacoEditorRenderer } from './monacoEditorRenderer';

window.addEventListener('DOMContentLoaded', () => {
  const root = createRoot(document.getElementById('container'));
  root.render(
    <MonacoEditorRenderer
      saveButton={
        document.getElementById('save-editor-data') as HTMLButtonElement
      }
    />,
  );
});
