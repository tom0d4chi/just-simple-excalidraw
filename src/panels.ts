/*
 * The backing under the column is decided from measured boxes, and a popover's box keeps
 * changing after it opens: the appearance menu grows when a family panel animates its
 * height in. A single read at toggle time therefore describes the closed box and misses
 * everything the panel has gained. Watching the boxes turns those changes into new reads.
 *
 * Kept out of the component so the browser probe and a node test can exercise the same
 * function: a missing `ResizeObserver` has to be a no-op, never a crash.
 */
export interface PanelWatch {
  /** Sync the observed set with `nodes`, which is re-derived on every measure. */
  observe: (nodes: Element[]) => void;
  disconnect: () => void;
}

export function watchPanelSizes(onChange: () => void): PanelWatch {
  if (typeof ResizeObserver !== "function") {
    return { observe: () => {}, disconnect: () => {} };
  }
  const observer = new ResizeObserver(() => onChange());
  const seen = new Set<Element>();
  return {
    observe: (nodes: Element[]) => {
      seen.forEach((node) => {
        if (!nodes.includes(node)) {
          observer.unobserve(node);
          seen.delete(node);
        }
      });
      nodes.forEach((node) => {
        if (!seen.has(node)) {
          observer.observe(node);
          seen.add(node);
        }
      });
    },
    disconnect: () => {
      observer.disconnect();
      seen.clear();
    }
  };
}
