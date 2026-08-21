import React, { type JSX } from 'react';
import AviutlTab from './aviutl/AviutlTab';
import NicommonsTab from './nicommons/NicommonsTab';
import OthersTab from './others/OthersTab';
import PackagesTab from './packages/PackagesTab';
import SettingsTab from './settings/SettingsTab';

/**
 * One tab button of the shell (旧 index.html のタブナビと同一のマークアップ).
 * @param {object} props - Props.
 * @param {string} props.target - The section id the button toggles.
 * @param {boolean} props.active - Whether the tab is initially active.
 * @param {string} props.label - The label.
 * @returns {JSX.Element} The rendered component.
 */
function TabButton({
  target,
  active,
  label,
}: {
  target: string;
  active: boolean;
  label: string;
}): JSX.Element {
  return (
    <button
      className={'non-draggable nav-link' + (active ? ' active' : '')}
      id={`${target}-tab`}
      data-bs-toggle="tab"
      data-bs-target={`#${target}`}
      type="button"
      role="tab"
      aria-controls={target}
      aria-selected={active}
    >
      {label}
    </button>
  );
}

/**
 * The shell of the main window: the title bar, the tab nav, and the five
 * tab panes (旧 index.html の body 直下の構造)。
 * このコンポーネントは状態を持たず初回の 1 回しかレンダーしない前提。
 * それを崩さないこと — タブ切り替えは従来どおり Bootstrap の tab
 * (data-bs-toggle。document 委譲のため React 描画後のボタンでも動く)が
 * ボタンと section の class を直接切り替えるため、再レンダーすると React が
 * active/show を初期状態へ巻き戻してしまう。title-bar のアプリ名も preload の
 * 初期化フローが .app-name へ直接書き込む(初期化フロー移設で解消予定)。
 * @returns {JSX.Element} The rendered component.
 */
function App(): JSX.Element {
  return (
    <>
      <nav className="bg-body-tertiary draggable">
        <div className="title-bar app-name d-flex justify-content-center align-items-center text-muted"></div>
        <div className="nav nav-tabs" id="nav-tab" role="tablist">
          <TabButton target="aviutl" active label="AviUtl" />
          <TabButton
            target="packages"
            active={false}
            label="プラグイン&スクリプト"
          />
          <TabButton
            target="nicommons"
            active={false}
            label="ニコニ・コモンズID"
          />
          <TabButton target="settings" active={false} label="設定" />
          <TabButton target="others" active={false} label="その他" />
        </div>
      </nav>

      <main className="tab-content" id="nav-tabContent">
        <section
          className="tab-pane fade show active"
          id="aviutl"
          role="tabpanel"
          aria-labelledby="aviutl"
        >
          <AviutlTab />
        </section>
        <section
          className="tab-pane fade"
          id="packages"
          role="tabpanel"
          aria-labelledby="packages"
        >
          <PackagesTab />
        </section>
        <section
          className="tab-pane fade"
          id="nicommons"
          role="tabpanel"
          aria-labelledby="nicommons"
        >
          <NicommonsTab />
        </section>
        <section
          className="tab-pane fade"
          id="settings"
          role="tabpanel"
          aria-labelledby="settings"
        >
          <SettingsTab />
        </section>
        <section
          className="tab-pane fade"
          id="others"
          role="tabpanel"
          aria-labelledby="others"
        >
          <OthersTab />
        </section>
      </main>
    </>
  );
}

export default App;
