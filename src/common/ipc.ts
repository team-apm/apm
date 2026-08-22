// レガシー IPC は preload 専用の 1 チャンネルのみ(他はすべて tRPC へ集約済み)。
// preload にも tRPC クライアントを置けば揃えられるが、1 窓に複数クライアントを
// 作るとリクエスト ID が衝突する(AGENTS.md 落とし穴)ため、エラーダイアログは
// レガシー IPC のまま維持する
export const IPC_CHANNELS = {
  OPEN_DIALOG: 'open-dialog',
};
