/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />

// 上の参照が宣言するのはテンプレート同様 main_window の分だけなので、
// apm が持つ残り 2 窓は自前で宣言する(名前は forge.config.ts の
// renderer[].name と一致させること)
declare const SPLASH_WINDOW_VITE_DEV_SERVER_URL: string;
declare const SPLASH_WINDOW_VITE_NAME: string;
declare const ABOUT_WINDOW_VITE_DEV_SERVER_URL: string;
declare const ABOUT_WINDOW_VITE_NAME: string;
