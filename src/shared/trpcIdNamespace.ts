import type { TRPCLink } from '@trpc/client';
import type { AnyRouter } from '@trpc/server';

// main 窓では同一 webContents 上に tRPC クライアントが 2 つ動く
// (隔離ワールドのレガシー用 lib/trpcClient と、メインワールドの React 用
// TrpcProvider)。trpc-electron の main は応答を event.reply で送るため
// 両ワールドの ipcRenderer に届き、renderer 側は数値のリクエスト ID だけで
// 応答を照合する。各クライアントは 1 から採番するので、ID が衝突すると
// 他方のリクエストへの応答で resolve されてしまう(main 側の購読キー
// `sender.id-frameRoutingId:id` も同一フレームのため衝突する)。
// クライアントごとに ID 空間を奇数/偶数へ分離して衝突を根絶する。

/** The id-space parities assigned to each tRPC client in the main window. */
export const trpcIdParities = {
  /** The legacy client in the isolated world (src/lib/trpcClient.ts). */
  legacy: 1,
  /** The React client in the main world (TrpcProvider.tsx). */
  react: 0,
} as const;

/**
 * Creates a tRPC link that remaps operation ids into a distinct id space.
 * Insert it before the terminating ipcLink so that both the renderer-side
 * pending map and the main-side dedupe key operate on the remapped ids.
 * @param {number} parity - 0 or 1; the id space assigned to this client.
 * @returns {TRPCLink<AnyRouter>} The id-remapping link.
 */
export function trpcIdNamespaceLink<TRouter extends AnyRouter>(
  parity: (typeof trpcIdParities)[keyof typeof trpcIdParities],
): TRPCLink<TRouter> {
  return () =>
    ({ next, op }) =>
      next({ ...op, id: op.id * 2 + parity });
}
