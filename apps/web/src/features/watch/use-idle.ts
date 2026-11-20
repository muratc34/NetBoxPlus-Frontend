'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** How long the player's controls stay after the last movement or key while the video plays. */
export const idleMs = 3_000;

/**
 * Whether nothing has happened for `delayMs` while hiding is allowed (`canHide`: playing, no menu open).
 * `wake` says something happened: the pointer moved, a key was pressed, focus moved into the controls.
 */
export function useIdle(canHide: boolean, delayMs = idleMs): { idle: boolean; wake: () => void } {
  const [idle, setIdle] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const schedule = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setIdle(true);
    }, delayMs);
  }, [delayMs]);

  useEffect(() => {
    if (!canHide) {
      window.clearTimeout(timer.current);
      return;
    }
    schedule();
    return () => {
      window.clearTimeout(timer.current);
    };
  }, [canHide, schedule]);

  const wake = useCallback(() => {
    setIdle(false);
    if (canHide) {
      schedule();
    }
  }, [canHide, schedule]);

  return { idle: canHide && idle, wake };
}
