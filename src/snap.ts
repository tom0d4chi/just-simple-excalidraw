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

export interface SnapGesture {
  /** Scene coordinate of the anchor when the gesture started. */
  anchorX: number;
  anchorY: number;
  /** Raw client coordinate of the finger when the gesture started. */
  originX: number;
  originY: number;
  zoom: number;
  step: number;
}

/**
 * Where the finger has to be for the anchor to sit on the lattice. Excalidraw moves
 * elements by a delta from the pointer position it captured at pointerdown, so
 * rewriting the pointer coordinate is how a live snap is expressed without touching
 * the scene mid-gesture.
 */
export function snapClient(
  client: { clientX: number; clientY: number },
  gesture: SnapGesture
): { x: number; y: number } {
  const zoom = gesture.zoom || 1;
  const rawX = gesture.anchorX + (client.clientX - gesture.originX) / zoom;
  const rawY = gesture.anchorY + (client.clientY - gesture.originY) / zoom;
  return {
    x: gesture.originX + (snapValue(rawX, gesture.step) - gesture.anchorX) * zoom,
    y: gesture.originY + (snapValue(rawY, gesture.step) - gesture.anchorY) * zoom
  };
}
