import React, { type JSX, useState } from 'react';
import { TRPCReact } from '../../trpc';

const ZOOM_OPTIONS = [
  ['50', '50%'],
  ['67', '67%'],
  ['75', '75%'],
  ['80', '80%'],
  ['90', '90%'],
  ['100', '100%（標準）'],
  ['110', '110%'],
  ['125', '125%'],
  ['150', '150%'],
  ['175', '175%'],
  ['200', '200%'],
] as const;

const AUTO_UPDATE_OPTIONS = [
  ['disable', '自動更新しない'],
  ['notify', '更新があれば通知する'],
  ['download', '自動で更新をダウンロードし、インストール前に通知する'],
] as const;

/**
 * The zoom factor and auto-update preferences (拡大率・apmの自動更新).
 * @returns {JSX.Element} The rendered component.
 */
function PreferencesSettings() {
  const { data: storedZoomFactor } =
    TRPCReact.settings.getZoomFactor.useQuery();
  const { data: storedAutoUpdate } =
    TRPCReact.settings.getAutoUpdate.useQuery();
  const { data: exeVersion } = TRPCReact.isExeVersion.useQuery();
  const changeZoomFactor = TRPCReact.settings.changeZoomFactor.useMutation();
  const setAutoUpdate = TRPCReact.settings.setAutoUpdate.useMutation();

  const [zoomFactor, setZoomFactor] = useState<string | null>(null);
  const [autoUpdate, setAutoUpdateValue] = useState<string | null>(null);

  const zoomValue = zoomFactor ?? storedZoomFactor ?? '100';
  const autoUpdateValue = autoUpdate ?? storedAutoUpdate ?? 'notify';

  return (
    <>
      <div className="row mb-3">
        <label htmlFor="zoom-factor-select" className="col-sm-3 col-form-label">
          拡大率
        </label>
        <div className="col-sm-6">
          <select
            className="form-select"
            id="zoom-factor-select"
            aria-label="Zoom level select"
            value={zoomValue}
            onChange={(e) => {
              setZoomFactor(e.target.value);
              changeZoomFactor.mutate(e.target.value);
            }}
          >
            {ZOOM_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="col-sm-3"></div>
      </div>
      <div className="row mb-3">
        <label htmlFor="zoom-factor-select" className="col-sm-3 col-form-label">
          apmの自動更新
        </label>
        <div className="col-sm-6">
          <div className="col">
            {AUTO_UPDATE_OPTIONS.map(([value, label]) => (
              <div className="form-check" key={value}>
                <input
                  className="form-check-input"
                  type="radio"
                  name="auto-update"
                  id={`auto-update-${value}`}
                  value={value}
                  checked={autoUpdateValue === value}
                  disabled={value === 'download' && exeVersion === false}
                  onChange={() => {
                    setAutoUpdateValue(value);
                    setAutoUpdate.mutate(value);
                  }}
                />
                <label
                  className="form-check-label"
                  htmlFor={`auto-update-${value}`}
                >
                  {label}
                </label>
              </div>
            ))}
          </div>
        </div>
        <div className="col-sm-3"></div>
      </div>
    </>
  );
}

export default PreferencesSettings;
