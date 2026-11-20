import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

/** How long typing in a search box rests before the list follows. */
export const searchDelayMs = 300;

/** A whole page number from the address, 1 for anything else. */
export function pageOf(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/**
 * A list's search box kept in the address (`?search=`): the box answers at once, the address follows once
 * typing rests, from the first page and with the list's other filters kept.
 */
export function useAddressSearch() {
  const [params, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const [text, setText] = useState(search);

  useEffect(() => {
    const trimmed = text.trim();
    if (trimmed === search) {
      return;
    }
    const timer = window.setTimeout(() => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete('page');
          if (trimmed) {
            next.set('search', trimmed);
          } else {
            next.delete('search');
          }
          return next;
        },
        { replace: true },
      );
    }, searchDelayMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [text, search, setParams]);

  return { text, setText, search };
}
