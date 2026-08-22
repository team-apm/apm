import { expect, getMainWindow, test } from './helpers';

// Monaco は Vite の依存解決に載せず AMD ビルドを丸ごと同梱する構成のため、
// 同梱物が欠けてもビルドは通り、起動して初めて落ちる。バージョン更新のたびに
// パッケージ版で実際に触って確かめる。
type MonacoWindow = {
  monaco: {
    editor: {
      ContentWidgetPositionPreference?: unknown;
      getModels: () => {
        getValue: () => string;
        setValue: (value: string) => void;
      }[];
      getModelMarkers: (filter: object) => { message: string }[];
    };
    languages: { json?: { jsonDefaults?: unknown } };
  };
};

const PLACEHOLDER_PHRASE = 'ローカルリポジトリ';

test('設定タブの Monaco エディタが表示・入力・スキーマ検証・整形まで動く', async ({
  launchApp,
}) => {
  const app = await launchApp();
  const window = await getMainWindow(app);

  const problems: string[] = [];
  window.on('pageerror', (e) => problems.push('pageerror: ' + String(e)));
  window.on('console', (m) => {
    // nicommons のサムネイル取得失敗など、Monaco と無関係な通信エラーは除く
    // (CSP 違反は "Failed to load resource" ではなく専用の文言で出るので残る)
    if (m.type() === 'error' && !m.text().includes('Failed to load resource'))
      problems.push('console: ' + m.text());
  });

  const modelValue = () =>
    window.evaluate(() =>
      (window as unknown as MonacoWindow).monaco.editor
        .getModels()[0]
        .getValue(),
    );
  const setModelValue = (value: string) =>
    window.evaluate(
      (v) =>
        (window as unknown as MonacoWindow).monaco.editor
          .getModels()[0]
          .setValue(v),
      value,
    );

  await window.getByRole('tab', { name: '設定' }).click();

  // --- 表示 ---
  await expect(window.locator('#container .monaco-editor')).toBeVisible({
    timeout: 120_000,
  });

  // 0.55 で languages.json は非推奨になったが、AMD の editor.main が互換のため
  // 再付与している。それに依存しているので生きていることを確かめる
  expect(
    await window.evaluate(
      () =>
        !!(window as unknown as MonacoWindow).monaco.languages.json
          ?.jsonDefaults,
    ),
  ).toBe(true);

  // --- プレースホルダ(ContentWidget)---
  const placeholder = window
    .locator('#container')
    .getByText(PLACEHOLDER_PHRASE, { exact: false });
  await expect(placeholder).toBeVisible();

  // --- 入力 ---
  // 0.56 の入力受け口は textarea.inputarea ではなくなったため、実ユーザ同様に
  // 行領域をクリックしてフォーカスを取る
  const viewLines = window.locator('#container .monaco-editor .view-lines');
  await viewLines.click();
  await window.keyboard.type('[]');
  await expect.poll(modelValue).toBe('[]');
  await expect(placeholder).toHaveCount(0);

  // --- スキーマ検証(json worker が生きているか)---
  await setModelValue('[{"foo":"bar"}]');
  await expect
    .poll(
      () =>
        window.evaluate(() =>
          (window as unknown as MonacoWindow).monaco.editor
            .getModelMarkers({})
            .map((marker) => marker.message),
        ),
      { timeout: 60_000 },
    )
    .toContain('Missing property "id".');

  // --- 整形(Shift+Alt+F)---
  await setModelValue('[{"id":"a/b","name":"n"}]');
  await viewLines.click();
  await window.keyboard.press('Shift+Alt+F');
  // editorDidMount の updateOptions({ tabSize: 2 }) 込みで確かめる
  await expect
    .poll(modelValue, { timeout: 60_000 })
    .toBe('[\n  {\n    "id": "a/b",\n    "name": "n"\n  }\n]');

  // --- codicon(0.56 で .ttf ファイルから data: URI 埋め込みに変わった)---
  // font-display: block のため描画されるまで status は unloaded のままなので、
  // CSP に阻まれていないことを見るには明示的にロードさせる
  expect(
    await window.evaluate(() =>
      document.fonts.load('16px codicon').then((f) => f.length),
    ),
  ).toBeGreaterThan(0);

  expect(problems).toEqual([]);
});
