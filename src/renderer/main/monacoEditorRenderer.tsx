import MonacoEditor, { BeforeMount, OnMount } from '@monaco-editor/react';
import { Packages } from 'apm-schema';
import schema from 'apm-schema/v3/schema/packages.json';
import React from 'react';
import * as buttonTransition from '../../lib/buttonTransition';
import { editor } from 'monaco-editor';

const placeholderStr = `
apm-data (https://github.com/team-apm/apm-data) に投稿されたパッケージデータをここにコピーアンドペーストすることで動作の確認ができます。
\t
下の例のように、全体を[]で囲む必要があります。
[
  {
    id": "AiosCiao/VSThost4aviutl",
    "name": "VSTホストプラグイン＋α",
    ...
  },
  {
    "id": "amate/InputPipePlugin",
    "name": "InputPipePlugin",
    ...
  },
  ...
]
\t
ショートカットキーは Visual Studio Code と同様です。
Ctrl+Space: サジェスト, Shift+Alt+F: フォーマット など
`;

/**
 *  Displays placeholder text when the editor is empty.
 */
class PlaceholderContentWidget {
  static ID = 'editor.widget.placeholderHint';
  placeholder: string;
  editor: editor.IStandaloneCodeEditor;
  domNode: HTMLElement;

  /**
   * @param {string} placeholder - placeholder text
   * @param {editor.IStandaloneCodeEditor} editor - monaco editor
   */
  constructor(placeholder: string, editor: editor.IStandaloneCodeEditor) {
    this.placeholder = placeholder;
    this.editor = editor;
    editor.onDidChangeModelContent(() => this.onDidChangeModelContent());
    this.onDidChangeModelContent();
  }

  /**
   * onDidChangeModelContent
   */
  onDidChangeModelContent() {
    if (this.editor.getValue() === '') {
      this.editor.addContentWidget(this);
    } else {
      this.editor.removeContentWidget(this);
    }
  }

  /**
   * getId
   * @returns {string} id
   */
  getId(): string {
    return PlaceholderContentWidget.ID;
  }

  /**
   * getDomNode
   * @returns {HTMLElement} DomElement of Placeholder
   */
  getDomNode(): HTMLElement {
    if (!this.domNode) {
      this.domNode = document.createElement('div');
      placeholderStr.split('\n').map((s) => {
        const spanElm = document.createElement('div');
        spanElm.textContent = s;
        this.domNode.appendChild(spanElm);
      });

      this.domNode.style.whiteSpace = 'pre-wrap';
      this.domNode.style.width = 'max-content';
      this.domNode.style.pointerEvents = 'none';
      this.domNode.style.fontStyle = 'italic';
      this.editor.applyFontInfo(this.domNode);
    }

    return this.domNode;
  }

  /**
   * getPosition
   * @returns {object} position
   */
  getPosition(): {
    position: { lineNumber: number; column: number };
    preference: editor.ContentWidgetPositionPreference[];
  } {
    return {
      position: { lineNumber: 1, column: 1 },
      preference: [editor.ContentWidgetPositionPreference.EXACT],
    };
  }

  /**
   * dispose
   */
  dispose() {
    this.editor.removeContentWidget(this);
  }
}

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
    editor.getModel().updateOptions({ tabSize: 2 });
    new PlaceholderContentWidget(placeholderStr, editor);
    window.editor.setOnload(async (packages: Packages['packages']) => {
      if (packages.length === 0) return;
      editor.setValue(JSON.stringify(packages));
      await editor.getAction('editor.action.formatDocument').run();
    });

    const save = async () => {
      const { enableButton } = saveButton
        ? buttonTransition.loading(saveButton, '保存 (Ctrl + S)')
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
