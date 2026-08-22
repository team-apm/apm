import React, { type JSX, useEffect, useRef } from 'react';
import { Nav, Tab } from 'react-bootstrap';
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
    // (各コンポーネントは installationPath ストアと apm-* イベントで追従する)
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

const TABS: { id: string; label: string; pane: JSX.Element }[] = [
  { id: 'aviutl', label: 'AviUtl', pane: <AviutlTab /> },
  { id: 'packages', label: 'プラグイン&スクリプト', pane: <PackagesTab /> },
  { id: 'nicommons', label: 'ニコニ・コモンズID', pane: <NicommonsTab /> },
  { id: 'settings', label: '設定', pane: <SettingsTab /> },
  { id: 'others', label: 'その他', pane: <OthersTab /> },
];

/**
 * The shell of the main window: the title bar, the tab nav, and the five
 * tab panes (旧 index.html の body 直下の構造)。
 * タブ切り替えは react-bootstrap の Tab(旧 Bootstrap の data API は廃止。
 * About 窓に続く react-bootstrap の採用)。pane は非アクティブでも
 * マウントしたままにする(旧実装の display:none と同じ。クエリや
 * イベント購読を生かすため)。
 * @returns {JSX.Element} The rendered component.
 */
function App(): JSX.Element {
  return (
    <Tab.Container defaultActiveKey="aviutl">
      <Startup />
      <nav className="bg-body-tertiary draggable">
        <TitleBarAppName />
        <Nav variant="tabs" id="nav-tab">
          {TABS.map((tab) => (
            <Nav.Link
              key={tab.id}
              as="button"
              type="button"
              eventKey={tab.id}
              id={`${tab.id}-tab`}
              className="non-draggable"
            >
              {tab.label}
            </Nav.Link>
          ))}
        </Nav>
      </nav>

      <Tab.Content as="main" id="nav-tabContent">
        {TABS.map((tab) => (
          <Tab.Pane key={tab.id} as="section" eventKey={tab.id} id={tab.id}>
            {tab.pane}
          </Tab.Pane>
        ))}
      </Tab.Content>
    </Tab.Container>
  );
}

export default App;
