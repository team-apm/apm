import React, { type JSX, useState } from 'react';
import { Col, Form, Row } from 'react-bootstrap';
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
      <Row className="mb-3">
        <Form.Label htmlFor="zoom-factor-select" column sm={3}>
          拡大率
        </Form.Label>
        <Col sm={6}>
          <Form.Select
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
          </Form.Select>
        </Col>
        <Col sm={3}></Col>
      </Row>
      <Row className="mb-3">
        <Form.Label htmlFor="zoom-factor-select" column sm={3}>
          apmの自動更新
        </Form.Label>
        <Col sm={6}>
          <Col>
            {AUTO_UPDATE_OPTIONS.map(([value, label]) => (
              <Form.Check
                key={value}
                type="radio"
                name="auto-update"
                id={`auto-update-${value}`}
                value={value}
                label={label}
                checked={autoUpdateValue === value}
                disabled={value === 'download' && exeVersion === false}
                onChange={() => {
                  setAutoUpdateValue(value);
                  setAutoUpdate.mutate(value);
                }}
              />
            ))}
          </Col>
        </Col>
        <Col sm={3}></Col>
      </Row>
    </>
  );
}

export default PreferencesSettings;
