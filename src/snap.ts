/*
 * Snapping to the dot grid. The dots are drawn on a lattice of `gridSize` scene
 * units anchored at the scene origin, so snapping is a plain rounding — but a
 * selection moves as one block, so the offset is computed once from the block's
 * top-left corner and applied to every element of it, never element by element.
 */
const SNAP_TYPES = new Set(["rectangle", "diamond", "ellipse", "line", "arrow", "text", "frame"]);

export interface SnapElement {
  id: string;
  type: string;
  x: number;
  y: number;
  version: number;
  versionNonce: number;
  isDeleted?: boolean;
}

export interface SnapResult<T extends SnapElement> {
  elements: T[];
  changed: boolean;
}

export function snapValue(value: number, step: number): number {
  if (!step) {
    return value;
  }
  return Math.round(value / step) * step;
}

/**
 * Rounds the given elements to the lattice. `changedIds` are the ones the gesture
 * touched: everything else is returned untouched.
 */
export function snapElements<T extends SnapElement>(
  elements: readonly T[],
  step: number,
  changedIds: ReadonlySet<string>
): SnapResult<T> {
  const targets = elements.filter((element) => (
    !element.isDeleted && changedIds.has(element.id) && SNAP_TYPES.has(element.type)
  ));
  if (!step || targets.length === 0) {
    return { elements: [...elements], changed: false };
  }

  const anchorX = Math.min(...targets.map((element) => element.x));
  const anchorY = Math.min(...targets.map((element) => element.y));
  const dx = snapValue(anchorX, step) - anchorX;
  const dy = snapValue(anchorY, step) - anchorY;
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
    return { elements: [...elements], changed: false };
  }

  const moved = new Set(targets.map((element) => element.id));
  return {
    changed: true,
    elements: elements.map((element) => (
      moved.has(element.id)
        ? { ...element, x: element.x + dx, y: element.y + dy, version: element.version + 1, versionNonce: Math.floor(Math.random() * 1e9) }
        : element
    ))
  };
}
