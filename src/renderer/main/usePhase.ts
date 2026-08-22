import { useEffect, useRef, useState } from 'react';

export type ActionPhase =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'message'; message: string; color: 'success' | 'danger' | 'info' };

/**
 * Manages the button state of one action button.
 * 旧 lib/buttonTransition(loading → message → 3 秒後に復帰)に相当する。
 * @returns {object} The phase and its transitions.
 */
export function usePhase() {
  const [phase, setPhase] = useState<ActionPhase>({ kind: 'idle' });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  // 前回の復帰タイマーを残したまま次の遷移をすると、3 秒前の操作の
  // タイマーが発火して loading 中に idle へ戻される(ボタンが再度押せて
  // 多重実行につながる)ため、遷移のたびに必ず消す
  const start = () => {
    clearTimeout(timer.current);
    setPhase({ kind: 'loading' });
  };
  const finish = (message: string, color: 'success' | 'danger' | 'info') => {
    clearTimeout(timer.current);
    setPhase({ kind: 'message', message, color });
    timer.current = setTimeout(() => setPhase({ kind: 'idle' }), 3000);
  };
  // 旧 openPackageFolder の成功時(メッセージなしで 3 秒後に復帰)
  const finishSilently = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setPhase({ kind: 'idle' }), 3000);
  };
  return { phase, start, finish, finishSilently };
}
