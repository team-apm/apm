import React, { type JSX, useEffect, useRef } from 'react';
import { TRPCReact } from '../trpc';
import AviutlTab from './aviutl/AviutlTab';
import NicommonsTab from './nicommons/NicommonsTab';
import OthersTab from './others/OthersTab';
import PackagesTab from './packages/PackagesTab';
import SettingsTab from './settings/SettingsTab';
import { runStartupFlow } from './startup';

/**
 * Runs the startup flow (migration → 設定初期化 → インストール先確定)once
 * after the first mount. 描画はしない。
 * @returns {null} Nothing to render.
 */
function Startup(): null {
  const utils = TRPCReact.useUtils();
  const started = useRef(false);
  useEffect(() => {
    // React のマウントより後に開始すれば十分で、完了は待たない
    // (各コンポーネントは instPath ストアと apm-* イベントで追従する)
    if (started.current) return;
    started.current = true;
    void runStartupFlow(utils.client);
  }, [utils]);
  return null;
}

/**
 * The app name shown in the title bar.
 * @returns {JSX.Element} The rendered component.
 */
function TitleBarAppName(): JSX.Element {
  const { data: appName } = TRPCReact.getAppName.useQuery();
  return (
    <div className="title-bar app-name d-flex justify-content-center align-items-center text-muted">
      {appName}
    </div>
  );
}

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
 * タブ切り替えは従来どおり Bootstrap の tab(data-bs-toggle。document 委譲の
 * ため React 描画後のボタンでも動く)がボタンと section の class を直接
 * 切り替える。App 自身は状態を持たないので React がこれらを巻き戻すことは
 * ないが、状態を足すときはタブの React 化(Bootstrap data API 依存の解消)と
 * 合わせて行うこと。
 * @returns {JSX.Element} The rendered component.
 */
function App(): JSX.Element {
  return (
    <>
      <Startup />
      <nav className="bg-body-tertiary draggable">
        <TitleBarAppName />
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
