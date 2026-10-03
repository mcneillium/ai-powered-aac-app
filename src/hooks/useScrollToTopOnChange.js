import { useEffect, useRef } from 'react';

/**
 * Scrolls a list back to the top whenever `key` changes (not on first render).
 *
 * The board's vocabulary grid is one FlatList whose data changes with the
 * page. Without this, the previous page's scroll offset carried over (clamped
 * to the new page's length), so a page's first row could open part-way up and
 * Home stayed shifted after a round trip: buttons moved depending on earlier
 * scrolling, which breaks motor planning.
 */
export function useScrollToTopOnChange(listRef, key) {
  const previous = useRef(key);
  useEffect(() => {
    if (previous.current === key) return;
    previous.current = key;
    listRef.current?.scrollToOffset?.({ offset: 0, animated: false });
  }, [listRef, key]);
}
