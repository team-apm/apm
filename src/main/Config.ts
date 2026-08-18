import Store from 'electron-store';

type StoreType = {
  dataVersion: '1' | '2' | '3';
  installationPath: string;
  dataURL: {
    main: string;
    extra: string;
    packages: string[];
  };
  modDate: {
    core: number;
    packages: number;
    scripts: number;
  };
  checkDate: {
    core: number;
    packages: number;
  };
  autoUpdate: 'download' | 'notify' | 'disable';
  zoomFactor: string;

  migration1to2: {
    oldDataURL: string;
    newDataURL: string;
  };
};

let instance: Config | undefined;

/**
 * Returns the process-wide Config instance.
 * 状態は electron-store がディスク(config.json)で共有するため、
 * インスタンスを 1 つにするのは初期化経路の一本化と get 毎のオーバーヘッド削減が目的。
 * @returns {Config} The Config instance.
 */
export function getConfig(): Config {
  instance ??= new Config();
  return instance;
}

export default class Config extends Store<StoreType> {
  public hasDataVersion() {
    return this.has('dataVersion');
  }

  public getDataVersion() {
    return this.get('dataVersion', '3');
  }

  public setDataVersion(version: StoreType['dataVersion']) {
    this.set('dataVersion', version);
  }

  public hasInstallationPath() {
    return this.has('installationPath');
  }

  public getInstallationPath() {
    return this.get('installationPath', '');
  }

  public setInstallationPath(path: string) {
    this.set('installationPath', path);
  }

  public dataURL = {
    hasMain: () => this.has('dataURL.main'),
    getMain: () => this.get('dataURL.main', ''),
    setMain: (url: string) => this.set('dataURL.main', url),

    hasExtra: () => this.has('dataURL.extra'),
    getExtra: () => this.get('dataURL.extra', ''),
    setExtra: (url: string) => this.set('dataURL.extra', url),

    hasPackages: () => this.has('dataURL.packages'),
    getPackages: () => this.get('dataURL.packages', [] as string[]),
    setPackages: (urls: string[]) => this.set('dataURL.packages', urls),
  };

  public modDate = {
    hasCore: () => this.has('modDate.core'),
    getCore: () => this.get('modDate.core', 0),
    setCore: (date: number) => this.set('modDate.core', date),

    hasPackages: () => this.has('modDate.packages'),
    getPackages: () => this.get('modDate.packages', 0),
    setPackages: (date: number) => this.set('modDate.packages', date),

    hasScripts: () => this.has('modDate.scripts'),
    getScripts: () => this.get('modDate.scripts', 0),
    setScripts: (date: number) => this.set('modDate.scripts', date),
  };

  public checkDate = {
    hasCore: () => this.has('checkDate.core'),
    getCore: () => this.get('checkDate.core', 0),
    setCore: (date: number) => this.set('checkDate.core', date),

    hasPackages: () => this.has('checkDate.packages'),
    getPackages: () => this.get('checkDate.packages', 0),
    setPackages: (date: number) => this.set('checkDate.packages', date),
  };

  public hasAutoUpdate() {
    return this.has('autoUpdate');
  }

  public getAutoUpdate() {
    return this.get('autoUpdate', 'notify');
  }

  public setAutoUpdate(value: StoreType['autoUpdate']) {
    this.set('autoUpdate', value);
  }

  public hasZoomFactor() {
    return this.has('zoomFactor');
  }

  public getZoomFactor() {
    // 保存値は設定タブの select の option 値(パーセント文字列)。既定値を '1' に
    // すると未設定時にどの option とも一致せず先頭の 50% が表示されてしまう
    return this.get('zoomFactor', '100');
  }

  public setZoomFactor(value: string) {
    this.set('zoomFactor', value);
  }
}
