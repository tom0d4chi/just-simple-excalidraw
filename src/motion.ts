/*
 * One source for the motion of every menu in the plugin.
 *
 * The numbers live here and nowhere else: the stylesheet only reads the custom properties
 * `MENU_MOTION_VARS` exports, and the components only read `menuDelay` / `rowDelay`. A duration
 * or a step cannot drift between the CSS and the JS because there is only one copy of it.
 *
 * The shape strip is the reference: it unfolds from its button outwards, 10 ms per item, and the
 * last item is fully in place at 140 ms (the sixth starts at 50 ms, its own animation runs 90 ms).
 */

export const MENU_IN_MS = 120;
export const MENU_OUT_MS = 100;
export const MENU_ITEM_MS = 90;
export const MENU_STEP_MS = 10;
/** Items further than this from the button share the last delay: a long list must not crawl. */
export const MENU_MAX_ITEMS = 6;

export const MENU_MOTION_VARS: Record<string, string> = {
  "--jse-menu-in": `${MENU_IN_MS}ms`,
  "--jse-menu-out": `${MENU_OUT_MS}ms`,
  "--jse-menu-item": `${MENU_ITEM_MS}ms`,
  "--jse-menu-step": `${MENU_STEP_MS}ms`
};

/** Delay for item `index` (0 = farthest from the button) of `total`. */
export function menuDelay(index: number, total: number): string {
  const rank = Math.max(0, Math.min(total, MENU_MAX_ITEMS) - index);
  return `${rank * MENU_STEP_MS}ms`;
}

/** Delay for a cell at `index` laid out in rows of `cols`: a row lands together. */
export function rowDelay(index: number, cols: number): string {
  const row = Math.floor(index / Math.max(1, cols));
  return `${Math.min(row, 2) * MENU_STEP_MS}ms`;
}
