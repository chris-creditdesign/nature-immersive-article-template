/* eslint-disable consistent-return */
import { writable, derived } from "svelte/store";

export const widthCheckElement = writable();

export const wideEnough = derived(
  widthCheckElement,
  ($widthCheckElement, set) => {
    if (!$widthCheckElement) return;

    const ro = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 740) {
        set(true);
      } else {
        set(false);
      }
    });

    ro.observe($widthCheckElement);

    return () => ro.disconnect();
  },
  false
);
