import type { BrowserWindow } from 'electron';
import type Config from '../Config';

/**
 * ユースケース層の services が共通して受け取るコンテキスト。ダイアログ・
 * ダウンロードセッションの親になるウィンドウと設定の束ね(旧 (win, config)
 * 引数対)。tRPC の winProcedure 系 context がこの型を構造的に満たすため、
 * api 層は自前の ctx をそのまま渡せる。
 */
export type ServiceContext = {
  readonly win: BrowserWindow;
  readonly config: Config;
};
