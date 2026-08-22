import MonacoEditor, {
  BeforeMount,
  loader,
  Monaco,
  OnMount,
} from '@monaco-editor/react';
import { Packages } from 'apm-schema';
import schema from 'apm-schema/v3/schema/packages.json';
// Type-only import to avoid bundling the entire monaco-editor package
// (enforced by @typescript-eslint/no-restricted-imports). The runtime editor
// is NOT loaded from a CDN (the CSP does not allow it): @monaco-editor/loader
// loads the AMD build that the monacoAssets plugin bundles next to index.html.
// Enum values must be taken from the `monaco` instance passed to onMount.
import type { editor } from 'monaco-editor';
import React, { useRef } from 'react';
import { TRPCReact } from '../trpc';
import { getInstallationPath } from './installationPath';
import { usePhase } from './usePhase';

const placeholderStr = `
ここに書いたパッケージデータは AviUtl フォルダ内の editorPackages.json に保存され、
パッケージ一覧に追加されます。apm-data へ登録しなくても、自分の環境にだけパッケージを
追加できます(ローカルリポジトリ)。apm-data (https://github.com/team-apm/apm-data) へ
投稿する前の動作確認にも使えます。
\t
下の例のように、全体を[]で囲む必要があります。
[
  {
    "id": "AiosCiao/VSThost4aviutl",
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
  positionPreference: editor.ContentWidgetPositionPreference;
  domNode: HTMLElement;

  /**
   * @param {string} placeholder - placeholder text
   * @param {editor.IStandaloneCodeEditor} editor - monaco editor
   * @param {editor.ContentWidgetPositionPreference} positionPreference - EXACT position preference
   */
  constructor(
    placeholder: string,
    editor: editor.IStandaloneCodeEditor,
    positionPreference: editor.ContentWidgetPositionPreference,
  ) {
    this.placeholder = placeholder;
    this.editor = editor;
    this.positionPreference = positionPreference;
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
      this.placeholder.split('\n').map((s) => {
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
      preference: [this.positionPreference],
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

// Monaco は loader のデフォルト(cdn.jsdelivr.net)ではなく、monacoAssets
// プラグインが index.html と同じ階層へ同梱する AMD ビルドから読み込む
// (CSP から CDN 許可を外すため。vite.plugins.config.ts)。
// dev サーバも同じ `/vs` で引けるよう middleware を持たせてあるので、
// 基準 URL は dev・パッケージ版とも index.html の位置でよい
loader.config({
  paths: { vs: new URL('vs', window.location.href).toString() },
});

/**
 *  A small code editor for apm-data, with validation against apm-schema.
 * SettingsTab の「追加テキストデータ」行に、エディタ列と保存ボタン列を
 * 描画する(旧 lib/buttonTransition によるボタンフロー込み)。
 * @returns {React.ReactElement} React component
 */
export const MonacoEditorRenderer: React.FC = () => {
  const modelUri = 'a://b/c.json';

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const save = usePhase();
  const utils = TRPCReact.useUtils();
  const setEditorPackagesMutation =
    TRPCReact.packages.setEditorPackages.useMutation();

  const saveEditorData = async () => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    save.start();

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
      save.finish('エラー', 'danger');
    } else {
      // editorPackages.json の読み書きは main プロセス側
      // (src/main/services/packages.ts)
      await setEditorPackagesMutation.mutateAsync({
        installationPath: getInstallationPath(),
        packages: json as Packages['packages'],
      });
      // 一覧データの再取得(旧 checkPackagesList)は ManualUpdateTable が
      // このイベントを購読して行う
      window.dispatchEvent(new Event('apm-check-packages-list'));
      save.finish('保存完了', 'success');
    }
  };
  // Ctrl+S のコマンド登録は onMount で 1 回だけ行うため、最新の実装を
  // ref 経由で参照する
  const saveEditorDataRef = useRef(saveEditorData);
  saveEditorDataRef.current = saveEditorData;

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
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.getModel().updateOptions({ tabSize: 2 });
    new PlaceholderContentWidget(
      placeholderStr,
      editor,
      monaco.editor.ContentWidgetPositionPreference.EXACT,
    );
    // インストール先は起動フロー(startup.ts)が installationPath ストアに設定して
    // apm-core-changed を発火するため、未確定なら確定を待って一度だけ読み込む
    // (旧 EditorContextBridge の setOnload / setInstPath の両者待ち合わせ相当。
    // 読み込み失敗を無視するのも旧実装と同じ)
    let loaded = false;
    const loadEditorPackages = async () => {
      if (loaded) return;
      const installationPath = getInstallationPath();
      if (!installationPath) return;
      loaded = true;
      try {
        const packages = (await utils.client.packages.getEditorPackages.query(
          installationPath,
        )) as Packages['packages'];
        if (packages.length === 0) return;
        editor.setValue(JSON.stringify(packages));
        await editor.getAction('editor.action.formatDocument').run();
      } catch {
        // nop
      }
    };
    void loadEditorPackages();
    window.addEventListener(
      'apm-core-changed',
      () => void loadEditorPackages(),
    );

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      void saveEditorDataRef.current();
    });
  };

  const saveColor =
    save.phase.kind === 'message' ? save.phase.color : 'primary';

  return (
    <>
      <div className="col-sm-9">
        <div id="container" className="border rounded">
          <MonacoEditor
            height="50vh"
            defaultLanguage="json"
            path={modelUri}
            beforeMount={editorWillMount}
            onMount={editorDidMount}
          />
        </div>
      </div>
      <div className="col-sm-3">
        <button
          type="button"
          className={`btn btn-${saveColor} w-100`}
          id="save-editor-data"
          disabled={save.phase.kind === 'loading'}
          onClick={() => void saveEditorData()}
        >
          {save.phase.kind === 'loading' ? (
            <>
              <span
                className="spinner-border spinner-border-sm"
                role="status"
                aria-hidden="true"
              ></span>
              <span className="visually-hidden">Loading...</span>
            </>
          ) : save.phase.kind === 'message' ? (
            save.phase.message
          ) : (
            '保存 (Ctrl + S)'
          )}
        </button>
      </div>
    </>
  );
};
