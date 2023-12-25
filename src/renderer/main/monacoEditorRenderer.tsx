import MonacoEditor, { BeforeMount, OnMount } from '@monaco-editor/react';
import { Packages } from 'apm-schema';
import schema from 'apm-schema/v3/schema/packages.json';
import React from 'react';
import * as buttonTransition from '../../lib/buttonTransition';

self.MonacoEnvironment = null;
type MonacoEditorRendererProps = {
  saveButton: HTMLButtonElement;
};

/**
 *  A small code editor for apm-data, with validation against apm-schema.
 * @param {MonacoEditorRendererProps} root0 - props
 * @param {HTMLButtonElement} root0.saveButton - The HTML element of the Save button.
 * @returns {React.ReactElement} React component
 */
export const MonacoEditorRenderer: React.FC<MonacoEditorRendererProps> = ({
  saveButton,
}) => {
  const modelUri = 'a://b/c.json';

  const editorWillMount: BeforeMount = (monaco) => {
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      schemas: [
        {
          uri: 'http://d/e-schema.json',
          fileMatch: [modelUri],
          schema: schema.properties.packages,
        },
      ],
    });
  };

  const editorDidMount: OnMount = (editor, monaco) => {
    window.editor.setOnload(async (packages: Packages['packages']) => {
      editor.setValue(JSON.stringify(packages));
      await editor.getAction('editor.action.formatDocument').run();
    });

    const save = async () => {
      const { enableButton } = saveButton
        ? buttonTransition.loading(saveButton, '保存')
        : { enableButton: undefined };

      await editor.getAction('editor.action.formatDocument').run();
      let error =
        monaco.editor
          .getModelMarkers({})
          .filter(
            (m) =>
              m.severity === monaco.MarkerSeverity.Warning ||
              m.severity === monaco.MarkerSeverity.Error,
          ).length > 0;

      let json;
      try {
        json = JSON.parse(editor.getValue());
      } catch {
        error = true;
      }
      if (error) {
        buttonTransition.message(saveButton, 'エラー', 'danger');
        setTimeout(() => {
          enableButton();
        }, 3000);
      } else {
        await window.editor.save(json as Packages['packages']);

        buttonTransition.message(saveButton, '保存完了', 'success');
        setTimeout(() => {
          enableButton();
        }, 3000);
      }
    };

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, save);
    saveButton.addEventListener('click', save);
  };

  return (
    <MonacoEditor
      height="50vh"
      defaultLanguage="json"
      path={modelUri}
      beforeMount={editorWillMount}
      onMount={editorDidMount}
    />
  );
};
